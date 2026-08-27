import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slettStrideeConnection, slettStrideeKonto, hentStrideeConnections } from '@/lib/stridee-api'
import {
  planBrandPurge, SLEEP_VALUE_FIELDS, HEALTH_METRIC_VALUE_FIELDS,
} from '@/lib/health-source-rules'

// Frakobling av en klokke som går via klokkesynk-leverandøren. Speiler
// Polar-frakoblingens mønster (app/api/polar/disconnect), men med ÉN
// avgjørende forskjell i hva som slettes:
//
//   ØKTENE BEHOLDES. De er brukerens originalfiler (personvern §11:
//   «Frakobling stopper all ny synk. Allerede importerte økter er dine
//   originalfiler og beholdes i dagboka») — ingen produsent krever
//   sletting av dem, i motsetning til Strava/Polar-avtalene.
//
//   HELSE- OG SØVNVERDIENE FRA MERKET SLETTES (samme §11): verdi for
//   verdi via planBrandPurge — manuelt førte verdier står urørt også når
//   de ligger i samme rad (M vinner også her), og merkeskår-radene
//   (health_brand_metrics, inkl. søvnstadiene) fjernes.
//
// GET  ?connection_id= : forhåndsvisning — HVA slettes og hva beholdes.
//                        Bekreftelsesdialogen viser dette FØR brukeren
//                        bekrefter (regel 20).
// POST {connection_id}  : utfør.
//
// Rekkefølgen i POST:
//   1. Signert DELETE hos leverandøren — connection, eller hele kontoen
//      (DELETE /v1/accounts/{user_id}) når dette er siste aktive klokke.
//      404 = allerede borte hos dem; målet er nådd.
//   2. VERIFISER med signert GET /v1/connections — vi stoler aldri på
//      DELETE-responsen alene. Står tilkoblingen fortsatt som live,
//      avbryter vi FØR noe slettes lokalt.
//   3. Brand-purge av helse/søvn for merket.
//   4. Lokal status: enkelt-connection → frakoblet + lenke-rollup;
//      siste klokke → stridee_marker_slettet (sletter lenka og roterer
//      external_user_id — samme funksjon som account.deleted-hendelsen).
//
// Webhook-hendelsene (account.disconnected/deleted) som leverandøren
// sender i etterkant er idempotente mot dette — prosesseringen oppdaterer
// rader som alt har riktig status.

interface Forhandsvisning {
  provider: string
  helse_verdier: number
  merke_rader: number
  netter_med_stadier: number
  beholdte_okter: number
}

async function finnConnection(connectionId: string, userId: string) {
  // Admin-klienten: stridee-tabellene er lese-only for authenticated, og
  // eierskapet håndheves her med eksplisitt user_id-sjekk mot lenka.
  const admin = createAdminClient()
  const { data } = await admin
    .from('stridee_connections')
    .select('connection_id, provider, status, link_id, stridee_link!inner(id, user_id, stridee_user_id, external_user_id)')
    .eq('connection_id', connectionId)
    .maybeSingle()
  if (!data) return null
  const lenke = data.stridee_link as unknown as { id: string; user_id: string; stridee_user_id: string | null; external_user_id: string }
  if (lenke.user_id !== userId) return null
  return { ...data, lenke, admin }
}

async function tellMerkeVerdier(admin: ReturnType<typeof createAdminClient>, userId: string, brand: string): Promise<number> {
  let antall = 0
  for (const table of ['sleep_records', 'health_metrics'] as const) {
    const { data, error } = await admin.from(table).select('sources').eq('user_id', userId)
    if (error) return -1
    for (const rad of (data ?? []) as { sources: Record<string, string> | null }[]) {
      antall += Object.values(rad.sources ?? {}).filter(v => v === brand).length
    }
  }
  return antall
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const connectionId = new URL(req.url).searchParams.get('connection_id')
  if (!connectionId) return NextResponse.json({ error: 'connection_id mangler' }, { status: 400 })
  const funn = await finnConnection(connectionId, user.id)
  if (!funn) return NextResponse.json({ error: 'Fant ikke tilkoblingen' }, { status: 404 })
  const { admin } = funn

  const { count: merkeRader } = await admin
    .from('health_brand_metrics')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('brand', funn.provider)
  const { data: stadieRader } = await admin
    .from('health_brand_metrics')
    .select('metrics')
    .eq('user_id', user.id).eq('brand', funn.provider)
  const netterMedStadier = (stadieRader ?? [])
    .filter(r => (r.metrics as Record<string, unknown> | null)?.sleep_stages).length
  const { count: okter } = await admin
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('imported_from', `fit_${funn.provider}`)

  const svar: Forhandsvisning = {
    provider: funn.provider,
    helse_verdier: await tellMerkeVerdier(admin, user.id, funn.provider),
    merke_rader: merkeRader ?? 0,
    netter_med_stadier: netterMedStadier,
    beholdte_okter: okter ?? 0,
  }
  return NextResponse.json(svar)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  let body: { connection_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'ugyldig kropp' }, { status: 400 })
  }
  if (!body.connection_id) return NextResponse.json({ error: 'connection_id mangler' }, { status: 400 })

  const funn = await finnConnection(body.connection_id, user.id)
  if (!funn) return NextResponse.json({ error: 'Fant ikke tilkoblingen' }, { status: 404 })
  const { admin, lenke } = funn

  // Siste aktive klokke? Da slettes hele kontoen hos leverandøren — vi har
  // ingen grunn til å beholde en konto uten tilkoblinger, og vår
  // external_user_id roteres uansett.
  const { data: andre } = await admin
    .from('stridee_connections')
    .select('connection_id, status')
    .eq('link_id', lenke.id)
    .neq('connection_id', funn.connection_id)
  const flereIgjen = (andre ?? []).some(c => c.status !== 'frakoblet')

  // ── 1. Slett hos leverandøren
  const hosDem = flereIgjen
    ? await slettStrideeConnection(funn.connection_id)
    : lenke.stridee_user_id
      ? await slettStrideeKonto(lenke.stridee_user_id)
      : await slettStrideeConnection(funn.connection_id)
  if (!hosDem.ok) {
    return NextResponse.json({
      error: `Frakoblingen hos leverandøren feilet — ingenting er slettet hos oss. Prøv igjen. (${hosDem.feil})`,
    }, { status: 502 })
  }

  // ── 2. Verifiser mot signert GET — aldri stol på DELETE-responsen alene.
  const kontroll = await hentStrideeConnections(lenke.external_user_id)
  if (kontroll.feil) {
    return NextResponse.json({
      error: `Kunne ikke verifisere frakoblingen (${kontroll.feil}) — ingenting er slettet hos oss. Prøv igjen.`,
    }, { status: 502 })
  }
  const fortsattDer = (kontroll.data ?? []).some(c => c.id === funn.connection_id)
  if (fortsattDer) {
    return NextResponse.json({
      error: 'Leverandøren viser tilkoblingen som aktiv fortsatt — ingenting er slettet hos oss. Prøv igjen om litt.',
    }, { status: 502 })
  }

  // ── 3. Brand-purge: merkets helse- og søvnverdier. Manuelt førte står.
  const purge = { cleared: 0, deletedRows: 0, keptManual: 0 }
  for (const [table, fields] of [
    ['sleep_records', SLEEP_VALUE_FIELDS],
    ['health_metrics', HEALTH_METRIC_VALUE_FIELDS],
  ] as const) {
    const res = await purgeBrandValues(admin, table, fields, user.id, funn.provider)
    if (res.error) {
      return NextResponse.json({
        error: `Sletting av helseverdier feilet i ${table} (${res.error}). Tilkoblingen er frakoblet hos leverandøren; kjør frakoblingen på nytt for å fullføre ryddingen.`,
        delvis: purge,
      }, { status: 500 })
    }
    purge.cleared += res.cleared
    purge.deletedRows += res.deletedRows
    purge.keptManual += res.keptManual
  }
  const { count: merkeSlettet } = await admin
    .from('health_brand_metrics')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .eq('brand', funn.provider)

  // ── 4. Lokal status
  if (flereIgjen) {
    await admin.from('stridee_connections')
      .update({ status: 'frakoblet', oppdatert_at: new Date().toISOString() })
      .eq('connection_id', funn.connection_id)
    const statuser = (andre ?? []).map(c => c.status)
    const lenkeStatus = statuser.includes('reauth_required')
      ? 'reauth_required'
      : statuser.some(s => s === 'aktiv') ? 'aktiv' : 'frakoblet'
    await admin.from('stridee_link')
      .update({ status: lenkeStatus, oppdatert_at: new Date().toISOString() })
      .eq('id', lenke.id)
  } else if (lenke.stridee_user_id) {
    await admin.rpc('stridee_marker_slettet', { p_stridee_user_id: lenke.stridee_user_id })
  } else {
    await admin.from('stridee_connections')
      .update({ status: 'frakoblet', oppdatert_at: new Date().toISOString() })
      .eq('connection_id', funn.connection_id)
    await admin.from('stridee_link')
      .update({ status: 'frakoblet', oppdatert_at: new Date().toISOString() })
      .eq('id', lenke.id)
  }

  revalidatePath('/app/innstillinger/klokkesync')
  console.log(
    `[stridee-disconnect] ${funn.provider} (${flereIgjen ? 'connection' : 'siste — konto slettet'}) ` +
    `purge: ${purge.cleared} verdier, ${purge.deletedRows} tomme rader, ${merkeSlettet ?? 0} merke-rader, ` +
    `${purge.keptManual} manuelle beholdt`,
  )
  return NextResponse.json({
    ok: true,
    provider: funn.provider,
    konto_slettet: !flereIgjen,
    slettet: {
      helse_verdier: purge.cleared,
      tomme_rader: purge.deletedRows,
      merke_rader: merkeSlettet ?? 0,
    },
    beholdt_manuelle: purge.keptManual,
  })
}

// Samme purge-algoritme som Polar-frakoblingen (kopiert mønster — Polar-koden
// røres ikke, stående regel): verdi for verdi, manuell vinner, tomme rader
// slettes. Regelen selv bor i lib/health-source-rules (planBrandPurge).
async function purgeBrandValues(
  admin: ReturnType<typeof createAdminClient>,
  table: 'sleep_records' | 'health_metrics',
  fields: readonly string[],
  userId: string,
  brand: string,
): Promise<{ cleared: number; deletedRows: number; keptManual: number; error?: string }> {
  const { data, error } = await admin
    .from(table)
    .select(['id', 'sources', ...fields].join(','))
    .eq('user_id', userId)
  if (error) return { cleared: 0, deletedRows: 0, keptManual: 0, error: error.message }

  const rader = (data ?? []) as unknown as Array<Record<string, unknown> & { id: string; sources: Record<string, string> | null }>
  const slettes: string[] = []
  let cleared = 0
  let keptManual = 0

  for (const rad of rader) {
    const plan = planBrandPurge(rad, rad.sources, brand, fields)
    const antallFjernet = Object.keys(plan.patch).length
    const kildeEndret = JSON.stringify(plan.sources) !== JSON.stringify(rad.sources ?? {})
    if (antallFjernet === 0 && !kildeEndret) continue

    keptManual += plan.kept.length
    if (plan.rowIsEmpty) {
      slettes.push(rad.id)
      continue
    }
    const { error: updErr } = await admin
      .from(table)
      .update({ ...plan.patch, sources: plan.sources, updated_at: new Date().toISOString() })
      .eq('id', rad.id)
    if (updErr) return { cleared, deletedRows: 0, keptManual, error: updErr.message }
    cleared += antallFjernet
  }

  let deletedRows = 0
  for (let i = 0; i < slettes.length; i += 150) {
    const bit = slettes.slice(i, i + 150)
    const { count, error: delErr } = await admin
      .from(table).delete({ count: 'exact' })
      .in('id', bit).eq('user_id', userId)
    if (delErr) return { cleared, deletedRows, keptManual, error: delErr.message }
    deletedRows += count ?? 0
  }

  return { cleared, deletedRows, keptManual }
}
