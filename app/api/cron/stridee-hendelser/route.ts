import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prosesserKontoHendelser } from '@/lib/stridee-prosessering'
import { prosesserDataHendelser, ryddGamleHendelser } from '@/lib/stridee-import'
import { lastNedStrideeFil } from '@/lib/stridee-api'
import type { SupabaseClient } from '@supabase/supabase-js'
import { STRIDEE_AKTIV } from '@/lib/stridee'

/**
 * Prosesserer ALLE ubehandlede hendelser fra stridee_events: først konto
 * (koblinger/frakoblinger/reauth), så data (aktiviteter + wellness), til
 * slutt opprydding av behandlede hendelser eldre enn 30 dager.
 *
 * Rekkefølgen er med vilje: en account.connected i samme bunke som utøverens
 * første activity.created må behandles først, ellers ville aktiviteten
 * hoppet over som «uten lenket bruker».
 *
 * SKILT FRA WEBHOOK-HANDLEREN MED VILJE: handleren har ti sekunders frist på
 * hele responsen og gjør bare verifiser/dekrypter/lagre/ekko. Koblingen mot
 * våre brukere skjer her, etterpå — feiler den, ligger hendelsen fortsatt
 * lagret og prøves igjen uten at Stridee må sende på nytt.
 *
 * (Erstattet /api/cron/stridee-konto før noe rakk å kalle den — én cron for
 * hele hendelsesstrømmen, én registrering i Netlify.)
 */
async function handler(request: Request) {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Uautorisert' }, { status: 401 })
  }
  if (!STRIDEE_AKTIV) {
    return NextResponse.json({ ok: true, hoppet_over: 'STRIDEE_AKTIV er av' })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Mangler Supabase-env' }, { status: 500 })
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })

  // ── MIDLERTIDIG MÅLEKALL (godkjent av Sverre 27. aug): ?maal=serie leser
  //    FORMEN på ÉN Garmin-søvnserie — feltnavn, oppløsning, stadiekoding,
  //    lengder — ALDRI råverdiene i sin helhet. Kjøres manuelt én gang;
  //    FJERNES i samme bolk som hypnogrammet bygges. Ingen skriving.
  if (new URL(request.url).searchParams.get('maal') === 'serie') {
    const maalt = await maalSovnserie(db)
    console.log('[stridee-hendelser] målekall:', JSON.stringify(maalt).slice(0, 4000))
    return NextResponse.json(maalt)
  }

  const konto = await prosesserKontoHendelser(db)
  const dataRes = await prosesserDataHendelser(db)
  const ryddet = await ryddGamleHendelser(db)

  console.log(
    `[stridee-hendelser] konto: behandlet=${konto.behandlet} feilet=${konto.feilet} · ` +
    `data: behandlet=${dataRes.behandlet} feilet=${dataRes.feilet} · ryddet=${ryddet}`,
  )
  if (dataRes.detaljer.length > 0) {
    console.log(`[stridee-hendelser] ${dataRes.detaljer.join(' | ')}`)
  }
  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    konto,
    data: dataRes,
    ryddet,
  })
}

export async function GET(request: Request) { return handler(request) }
export async function POST(request: Request) { return handler(request) }

// ── Målekallet (midlertidig, se over) ────────────────────────

async function maalSovnserie(db: SupabaseClient) {
  const { data: rader } = await db
    .from('stridee_events')
    .select('id, payload')
    .eq('event_type', 'wellness.created')
    .order('received_at', { ascending: false })
    .limit(100)
  type P = { provider?: string; data?: { kind?: string; series_url?: string; summary?: { durationInSeconds?: number } } }
  const rad = (rader ?? []).find(r => {
    const p = r.payload as P
    return p?.data?.kind === 'sleep' && p?.provider === 'garmin' && typeof p?.data?.series_url === 'string'
  })
  if (!rad) return { feil: 'fant ingen garmin-søvnhendelse med series_url' }
  const p = rad.payload as P

  const svar = await lastNedStrideeFil(p.data!.series_url!)
  if (!svar.data) return { feil: svar.feil }
  let json: unknown
  try {
    json = JSON.parse(svar.data.toString('utf8'))
  } catch {
    return { feil: 'serien var ikke JSON', bytes: svar.data.length }
  }
  return {
    bytes: svar.data.length,
    sovnVarighetSek: p.data?.summary?.durationInSeconds ?? null,
    form: beskrivForm(json, 0),
  }
}

/**
 * Beskriver STRUKTUREN i et JSON-dokument uten å gjengi verdiene:
 * feltnavn, typer, lengder — og for tidskart (objekter med rene
 * tall-nøkler) nøkkel-steget (= oppløsningen) og de distinkte verdiene
 * KUN når de er få og tekstlige (stadiekoding), aldri tallseriene.
 */
function beskrivForm(v: unknown, dybde: number): unknown {
  if (v === null) return 'null'
  if (Array.isArray(v)) {
    if (v.length === 0) return 'array[0]'
    return { array: v.length, elementform: dybde > 4 ? '…' : beskrivForm(v[0], dybde + 1) }
  }
  if (typeof v === 'object') {
    const par = Object.entries(v as Record<string, unknown>)
    const tallNokler = par.length > 4 && par.every(([k]) => /^\d+$/.test(k))
    if (tallNokler) {
      const nokler = par.map(([k]) => +k).sort((a, b) => a - b)
      const steg = new Set<number>()
      for (let i = 1; i < Math.min(nokler.length, 50); i++) steg.add(nokler[i] - nokler[i - 1])
      const verdier = new Set(par.slice(0, 200).map(([, x]) => typeof x === 'string' ? x : typeof x))
      const tekstlige = [...verdier].every(x => typeof x === 'string' && !/^\d/.test(x))
      return {
        tidskart: par.length,
        forsteNokkel: nokler[0],
        sisteNokkel: nokler[nokler.length - 1],
        stegSekunder: [...steg].sort((a, b) => a - b).slice(0, 4),
        verdier: tekstlige && verdier.size <= 10 ? [...verdier] : `(${[...verdier].join('/')}, ikke gjengitt)`,
      }
    }
    if (dybde > 5) return '…'
    const ut: Record<string, unknown> = {}
    for (const [k, x] of par.slice(0, 20)) ut[k] = beskrivForm(x, dybde + 1)
    if (par.length > 20) ut['…'] = `${par.length - 20} felter til`
    return ut
  }
  return typeof v
}
