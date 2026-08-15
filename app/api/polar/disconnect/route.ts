import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { deregisterPolarUser, POLAR_MANUAL_REVOKE_URL } from '@/lib/polar'

// Frakobling av Polar. Speiler /api/strava/disconnect, men med Polars egne
// krav: avregistrering hos Polar er PÅKREVD (Polar API License Agreement —
// stans tilgang, revoker token, slett tokens fra database og servere), og
// DELETE /v3/users/{id} gjør begge deler i ett kall.
//
// GET  = forhåndsvisning (hva vil bli slettet) — brukes av bekreftelses-modalen
// POST = utfør frakobling
//
// Slettingsrekkefølge (POST):
//   1. workout_samples for Polar-importerte økter
//   2. workout_samples med source='polar' (fanger samples lagt på EKSISTERENDE
//      økter ved konflikt-sammenslåing — de har ikke imported_from='polar')
//   3. workout_activities for Polar-importerte økter
//   4. workout_activities med external_id 'polar_…' (samme sammenslåings-tilfelle)
//   5. workouts med imported_from='polar'
//   6. imported_activities med source='polar' (anti-duplikat-sporing)
//   7. DELETE /v3/users/{polar_user_id} hos Polar, med inntil 3 forsøk
//   8. Hele polar_connections-raden — ALLTID, også når steg 7 feilet
//
// KRAV a: frakobling er uavhengig av registered_at. En rad kan finnes uten
// fullført registrering, og da har vi fortsatt et token som skal revokeres.
// Ingenting her sjekker registered_at.
//
// KRAV b: feiler avregistreringen hos Polar, går brukerens frakobling likevel
// gjennom — men polar_user_id, hver enkelt HTTP-status og feilteksten
// returneres i JSON og logges. Vi mister aldri sporet stille.
//
// Lokale DB-feil håndteres motsatt: da AVBRYTER vi før tilkoblings-raden
// slettes, og returnerer hvilket steg som feilet med tellingene så langt.
// PostgREST gir én transaksjon per kall, så vi kan ikke rulle tilbake steg som
// allerede er utført — men rekkefølgen er valgt slik at et avbrudd alltid er
// trygt å gjenta: hvert steg er idempotent, og så lenge tilkoblings-raden står
// igjen kan brukeren kjøre frakoblingen på nytt.
//
// Store slettinger deles i biter: `in`-filtre havner i URL-en, og en bruker med
// mange hundre Polar-økter ville ellers sprengt URL-lengden.

const CHUNK = 150

interface DeletedCounts {
  samples: number
  samples_merged: number
  activities: number
  activities_merged: number
  workouts: number
  imports: number
  connection: number
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const { data: conn } = await supabase
    .from('polar_connections')
    .select('polar_user_id, registered_at, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const workoutIds = await polarWorkoutIds(supabase, user.id)

  // Aktiviteter på Polar-øktene.
  let activities = 0
  for (const ids of chunks(workoutIds)) {
    const { count } = await supabase
      .from('workout_activities')
      .select('id', { count: 'exact', head: true })
      .in('workout_id', ids)
    activities += count ?? 0
  }

  // Samples: source='polar' PLUSS eventuelle samples på Polar-øktene som ikke
  // er merket (de to mengdene er disjunkte her, så summen dobbelteller ikke).
  const { count: samplesBySource } = await supabase
    .from('workout_samples')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('source', 'polar')
  let samples = samplesBySource ?? 0
  for (const ids of chunks(workoutIds)) {
    const { count } = await supabase
      .from('workout_samples')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('workout_id', ids)
      .or('source.is.null,source.neq.polar')
    samples += count ?? 0
  }

  const { count: imports } = await supabase
    .from('imported_activities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('source', 'polar')

  return NextResponse.json({
    connected: !!conn,
    polar_user_id: conn?.polar_user_id ?? null,
    registered: !!conn?.registered_at,
    connected_at: conn?.created_at ?? null,
    will_delete: {
      workouts: workoutIds.length,
      activities,
      samples,
      imports: imports ?? 0,
    },
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const deleted: DeletedCounts = {
    samples: 0, samples_merged: 0,
    activities: 0, activities_merged: 0,
    workouts: 0, imports: 0, connection: 0,
  }

  const fail = (step: string, message: string, extra: Record<string, unknown> = {}) =>
    NextResponse.json({
      ok: false,
      failed_step: step,
      error: message,
      deleted,
      ...extra,
      note: 'Frakoblingen ble avbrutt, og tilkoblingen står fortsatt. Kjør frakoblingen på nytt — hvert steg tåler gjentakelse.',
    }, { status: 500 })

  // Hent tilkoblingen FØR sletting — vi trenger token + polar_user_id til
  // avregistreringen. Merk: registered_at brukes bevisst ikke som betingelse.
  const { data: conn, error: connErr } = await supabase
    .from('polar_connections')
    .select('polar_user_id, access_token, registered_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (connErr) return fail('les tilkobling', connErr.message)

  // 0. Finn Polar-importerte økter.
  let workoutIds: string[]
  try {
    workoutIds = await polarWorkoutIds(supabase, user.id)
  } catch (e) {
    return fail('hent Polar-økter', e instanceof Error ? e.message : String(e))
  }

  // 1. Samples for Polar-øktene.
  for (const ids of chunks(workoutIds)) {
    const { count, error } = await supabase
      .from('workout_samples').delete({ count: 'exact' })
      .in('workout_id', ids).eq('user_id', user.id)
    if (error) return fail('slett samples', error.message)
    deleted.samples += count ?? 0
  }

  // 2. Samples som ble lagt på EKSISTERENDE økter ved konflikt-sammenslåing.
  // De har source='polar', men økta har ikke imported_from='polar', så de ville
  // ellers blitt liggende igjen som rå Polar-data etter frakobling.
  {
    const { count, error } = await supabase
      .from('workout_samples').delete({ count: 'exact' })
      .eq('user_id', user.id).eq('source', 'polar')
    if (error) return fail('slett sammenslåtte samples', error.message)
    deleted.samples_merged = count ?? 0
  }

  // 3. Aktiviteter (lap-rader) på Polar-øktene.
  for (const ids of chunks(workoutIds)) {
    const { count, error } = await supabase
      .from('workout_activities').delete({ count: 'exact' })
      .in('workout_id', ids)
    if (error) return fail('slett aktiviteter', error.message)
    deleted.activities += count ?? 0
  }

  // 4. Aktiviteter merket med Polar-ekstern-id på andre økter (sammenslåing).
  // workout_activities har ingen user_id — RLS-policyen scoper på eierskap av
  // økta, og denne ruten bruker brukerens egen klient, så dette treffer kun
  // brukerens egne rader.
  {
    const { count, error } = await supabase
      .from('workout_activities').delete({ count: 'exact' })
      // Understrek er LIKE-jokertegn, men det spiller ingen rolle her: eneste
      // external_id-verdier vi selv skriver er 'strava_…' og 'polar_…'.
      .like('external_id', 'polar_%')
    if (error) return fail('slett sammenslåtte aktiviteter', error.message)
    deleted.activities_merged = count ?? 0
  }

  // 5. Selve øktene.
  for (const ids of chunks(workoutIds)) {
    const { count, error } = await supabase
      .from('workouts').delete({ count: 'exact' })
      .in('id', ids).eq('user_id', user.id)
    if (error) return fail('slett økter', error.message)
    deleted.workouts += count ?? 0
  }

  // 6. Anti-duplikat-sporingen.
  {
    const { count, error } = await supabase
      .from('imported_activities').delete({ count: 'exact' })
      .eq('user_id', user.id).eq('source', 'polar')
    if (error) return fail('slett import-sporing', error.message)
    deleted.imports = count ?? 0
  }

  // 7. Avregistrer hos Polar (revokerer også tokenet). Inntil 3 forsøk.
  let deregister: {
    attempted: boolean
    ok: boolean
    status: number
    attempts: { attempt: number; status: number; body: string }[]
    message: string
  } = {
    attempted: false, ok: false, status: 0, attempts: [],
    message: 'Ikke forsøkt — fant ingen tilkobling med token.',
  }
  if (conn?.access_token && conn.polar_user_id != null) {
    const r = await deregisterPolarUser(conn.access_token, conn.polar_user_id)
    deregister = { attempted: true, ...r }
    if (r.ok) {
      console.log(`[polar-disconnect] avregistrering OK for polar-bruker ${conn.polar_user_id} (status ${r.status})`)
    } else {
      console.error(
        `[polar-disconnect] AVREGISTRERING FEILET — polar_user_id=${conn.polar_user_id}, ` +
        `user=${user.id}, siste status=${r.status}: ${r.message} — forsøk: ${JSON.stringify(r.attempts)}`,
      )
    }
  } else {
    console.warn(`[polar-disconnect] ingen token/polar_user_id for user ${user.id} — kan ikke avregistrere hos Polar`)
  }

  // 8. Slett hele raden UANSETT om steg 7 lyktes. Brukerens rett til å koble
  // fra veier tyngre enn vår mulighet til å rydde hos Polar — men resultatet av
  // steg 7 returneres, så en feilet avregistrering kan følges opp manuelt.
  const { count: cc, error: delErr } = await supabase
    .from('polar_connections').delete({ count: 'exact' })
    .eq('user_id', user.id)
  if (delErr) {
    console.error('[polar-disconnect] sletting av tilkoblings-rad feilet:', delErr.message)
    return fail('slett tilkobling', `Kunne ikke slette tilkoblings-raden: ${delErr.message}`, { deregister })
  }
  deleted.connection = cc ?? 0

  // 9. AVSLUTTENDE VERIFISERING: les tilbake at det faktisk ble tomt, i stedet
  // for å stole på at slettekallene returnerte det de skulle. Alle tall skal
  // være 0. Er de ikke det, sier vi det tydelig — frakoblingen er da
  // ufullstendig, ikke feilet, og en ny kjøring rydder resten.
  const verified = await verifyPolarGone(supabase, user.id)
  const verifiedClean = Object.values(verified).every(v => v === 0)
  if (!verifiedClean) {
    console.error(
      `[polar-disconnect] UFULLSTENDIG for user ${user.id} (polar_user_id=${conn?.polar_user_id ?? '?'}): ` +
      JSON.stringify(verified),
    )
  }

  revalidatePath('/app/innstillinger/klokkesync')

  const deregisterNote = deregister.ok
    ? 'X-PULSE er avregistrert hos Polar (tokenet er revokert).'
    : 'Avregistreringen hos Polar gikk ikke igjennom. Fjern X-PULSE selv under ' +
      'Innstillinger → Autorisasjoner i Polar Flow for å trekke tilgangen helt tilbake.'

  return NextResponse.json({
    ok: true,
    polar_user_id: conn?.polar_user_id ?? null,
    was_registered: !!conn?.registered_at,
    deleted,
    deregister,
    verified,
    verified_clean: verifiedClean,
    note: verifiedClean
      ? `Alle Polar-data er slettet, og etterkontrollen fant ingenting igjen. ${deregisterNote}`
      : `Frakoblingen er IKKE fullført: etterkontrollen fant Polar-data som fortsatt ligger igjen ` +
        `(${describeLeftovers(verified)}). Kjør frakoblingen en gang til. ${deregisterNote}`,
    manual_revoke_url: deregister.ok ? null : POLAR_MANUAL_REVOKE_URL,
  })
}

interface VerifiedCounts {
  workouts_left: number
  activities_left: number
  samples_left: number
  imports_left: number
  connection_left: number
}

// Leser tilbake etter sletting. -1 betyr «kunne ikke verifiseres» (query-feil)
// og regnes som ikke-rent, så vi aldri melder «tomt» på sviktende grunnlag.
async function verifyPolarGone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<VerifiedCounts> {
  const n = (res: { count: number | null; error: unknown }) => (res.error ? -1 : (res.count ?? 0))

  return {
    workouts_left: n(await supabase
      .from('workouts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('imported_from', 'polar')),
    activities_left: n(await supabase
      .from('workout_activities').select('id', { count: 'exact', head: true })
      .like('external_id', 'polar_%')),
    samples_left: n(await supabase
      .from('workout_samples').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('source', 'polar')),
    imports_left: n(await supabase
      .from('imported_activities').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('source', 'polar')),
    connection_left: n(await supabase
      .from('polar_connections').select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId)),
  }
}

function describeLeftovers(v: VerifiedCounts): string {
  const labels: [keyof VerifiedCounts, string][] = [
    ['workouts_left', 'økter'],
    ['activities_left', 'aktiviteter'],
    ['samples_left', 'rå-datasett'],
    ['imports_left', 'import-sporinger'],
    ['connection_left', 'tilkoblings-rad'],
  ]
  const parts = labels
    .filter(([k]) => v[k] !== 0)
    .map(([k, label]) => (v[k] === -1 ? `${label}: kunne ikke verifiseres` : `${v[k]} ${label}`))
  return parts.join(', ')
}

// Alle økter importert fra Polar for denne brukeren.
async function polarWorkoutIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('imported_from', 'polar')
  if (error) throw new Error(`workouts-query: ${error.message}`)
  return (data ?? []).map(w => w.id as string)
}

// Deler id-lista i biter så `in`-filtrene ikke sprenger URL-lengden.
// Tom liste gir ingen biter — kalleren hopper da over steget helt.
function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
