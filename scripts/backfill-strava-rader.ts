/**
 * BACKFILL: Strava-økter uten aktivitetsrader (Sverre/Cowork 13. sep 2026).
 *
 * 183 økter opprettet fra Strava mangler workout_activities fordi cronen
 * skrev desimalwatt inn i en INTEGER-kolonne og hele rad-batchen ble avvist
 * (rettet i 4ee2b73). Dette skriptet:
 *   1. finner øktene (SELECT i prod; demo-brukeren utelatt, alltid)
 *   2. henter detalj + laps + puls-stream fra Strava med brukerens lagrede
 *      token, mapper radene som cronen (rettet) og regner soner som cronen
 *   3. skriver supabase/backfill-strava-rader.sql: én DO-blokk per bruker
 *   4. rapporterer per bruker, feil med årsak og ti stikkprøver
 *
 * REGEL 35: skriptet skriver INGENTING til basen. (Unntak som ligger i
 * app-koden selv: lib/strava refreshTokenIfExpired lagrer et fornyet Strava-
 * token i strava_connections når det er utløpt - samme mekanisme som cronen.)
 *
 * Kjør:  npx tsx scripts/backfill-strava-rader.ts
 * Mellomlagring i scratchpad så en avbrutt kjøring kan fortsette.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import {
  fetchStravaActivityDetail, fetchStravaStreams, getStravaConnection,
  avrundEllerNull, syntetiskLapFraAktivitet, mapStravaSportToXpulse,
  type StravaLap, type StravaActivityDetail, type StravaStreamSet,
} from '../lib/strava'
import { getHeartZonesForUser, computeZoneSecondsFromSamples } from '../lib/heart-zones'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DEMO = '1a97ac16-6ab7-43de-b3f0-245771322699'
const MELLOMLAGER = process.env.BACKFILL_CACHE ?? '/private/tmp/claude-501/-Users-sveco/d659923d-1971-4ec7-b0a5-5c8b465ea454/scratchpad/strava/backfill-cache.json'
const SQL_FIL = 'supabase/backfill-strava-rader.sql'
// Strava: 100 leseforespørsler per 15 min for appen, og cronen bruker samme kvote.
const VENT_MS = 10_500

type Okt = { id: string; user_id: string; date: string; title: string | null; stravaId: number | null }
type Rad = Record<string, string | number | null | Record<string, number>>
type Resultat = { rader: Rad[]; harEkteLaps: boolean; antallLaps: number; sonetid: number } | { feil: string }

const sov = (ms: number) => new Promise(r => setTimeout(r, ms))
const logg = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`)

async function alleRader<T>(bygg: (fra: number, til: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const ut: T[] = []
  for (let fra = 0; ; fra += 1000) {
    const { data, error } = await bygg(fra, fra + 999)
    if (error) throw new Error(error.message)
    ut.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return ut
}

async function finnOkter(): Promise<Okt[]> {
  const ws = await alleRader<{ id: string; user_id: string; date: string; title: string | null }>((f, t) =>
    admin.from('workouts').select('id, user_id, date, title').eq('imported_from', 'strava').neq('user_id', DEMO).range(f, t))
  const harRad = new Set<string>()
  for (let i = 0; i < ws.length; i += 300) {
    const del = ws.slice(i, i + 300).map(w => w.id)
    const rader = await alleRader<{ workout_id: string }>((f, t) => admin.from('workout_activities').select('workout_id').in('workout_id', del).range(f, t))
    for (const r of rader) harRad.add(r.workout_id)
  }
  const uten = ws.filter(w => !harRad.has(w.id) && w.user_id !== DEMO)
  const imp = await alleRader<{ workout_id: string; external_id: string }>((f, t) =>
    admin.from('imported_activities').select('workout_id, external_id').eq('source', 'strava').in('workout_id', uten.map(w => w.id)).range(f, t))
  const ekstern = new Map(imp.map(i => [i.workout_id, i.external_id]))
  return uten.map(w => {
    const m = /^strava_(\d+)$/.exec(ekstern.get(w.id) ?? '')
    return { ...w, stravaId: m ? Number(m[1]) : null }
  })
}

// Radene EKSAKT som cronen (app/api/cron/strava-sync/route.ts) etter 4ee2b73.
function byggRader(workoutId: string, detail: StravaActivityDetail): { rader: Rad[]; laps: StravaLap[]; harEkteLaps: boolean } {
  const mapping = mapStravaSportToXpulse(detail.sport_type)
  const harEkteLaps = !!detail.laps && detail.laps.length > 0
  const laps: StravaLap[] = harEkteLaps ? detail.laps : [syntetiskLapFraAktivitet(detail)]
  const rader = laps.map((lap, idx) => ({
    workout_id: workoutId,
    activity_type: 'aktivitet',
    movement_name: mapping.movement,
    movement_subcategory: mapping.subcategory,
    duration_seconds: avrundEllerNull(lap.elapsed_time) ?? 0,
    distance_meters: avrundEllerNull(lap.distance),
    avg_heart_rate: lap.average_heartrate ?? null,
    max_hr: lap.max_heartrate ?? null,
    avg_watts: avrundEllerNull(lap.average_watts),
    max_watts: lap.max_watts ?? null,
    avg_speed_ms: lap.average_speed ?? null,
    max_speed_ms: lap.max_speed ?? null,
    avg_cadence: lap.average_cadence ?? null,
    elevation_gain_m: avrundEllerNull(lap.total_elevation_gain),
    sort_order: idx,
    strava_lap_index: harEkteLaps ? lap.lap_index : null,
    external_id: harEkteLaps ? `strava_lap_${lap.id}` : `strava_activity_${lap.id}`,
    zones: null as Record<string, number> | null,
  }))
  return { rader, laps, harEkteLaps }
}

// Soner som cronen: per lap-vindu fra puls-streamen med brukerens soner.
function leggPaaSoner(rader: Rad[], laps: StravaLap[], streams: StravaStreamSet, heartZones: Awaited<ReturnType<typeof getHeartZonesForUser>>): number {
  if (!streams.heartrate?.data || heartZones.length === 0) return 0
  const time = streams.time?.data ?? []
  const hrSamples = streams.heartrate.data.map((v, i) => ({ t: time[i] ?? i, hr: v }))
  let cumStart = 0, sonetid = 0
  for (let idx = 0; idx < laps.length; idx++) {
    const cumEnd = cumStart + laps[idx].elapsed_time
    const zoneSec = computeZoneSecondsFromSamples(hrSamples, heartZones, cumStart, cumEnd)
    const total = zoneSec.I1 + zoneSec.I2 + zoneSec.I3 + zoneSec.I4 + zoneSec.I5
    if (total > 0) { rader[idx].zones = { ...zoneSec, Hurtighet: 0 }; sonetid += total }
    cumStart = cumEnd
  }
  return sonetid
}

const sqlVerdi = (v: Rad[string]): string => {
  if (v == null) return 'null'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null'
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
}
const KOLONNER = ['workout_id', 'activity_type', 'movement_name', 'movement_subcategory', 'duration_seconds', 'distance_meters', 'avg_heart_rate', 'max_hr', 'avg_watts', 'max_watts', 'avg_speed_ms', 'max_speed_ms', 'avg_cadence', 'elevation_gain_m', 'sort_order', 'strava_lap_index', 'external_id', 'zones']

async function main() {
  const okter = await finnOkter()
  logg(`Strava-økter uten aktivitetsrader (uten demo): ${okter.length}`)
  const cache: Record<string, Resultat> = existsSync(MELLOMLAGER) ? JSON.parse(readFileSync(MELLOMLAGER, 'utf8')) : {}
  const perBruker = new Map<string, Okt[]>()
  for (const o of okter) perBruker.set(o.user_id, [...(perBruker.get(o.user_id) ?? []), o])
  const { data: prof } = await admin.from('profiles').select('id, email').in('id', [...perBruker.keys()])
  const epost = (id: string) => (prof ?? []).find(p => p.id === id)?.email ?? id

  let kall = 0
  for (const [userId, liste] of perBruker) {
    const conn = await getStravaConnection(admin, userId)
    const heartZones = await getHeartZonesForUser(admin, userId)
    for (const o of liste) {
      if (cache[o.id] && !('feil' in cache[o.id] && /429|fetch failed: 5/.test((cache[o.id] as { feil: string }).feil))) continue
      if (!conn) { cache[o.id] = { feil: 'ingen Strava-tilkobling' }; continue }
      if (o.stravaId == null) { cache[o.id] = { feil: 'ingen imported_activities-rad med strava-id' }; continue }
      try {
        const detail = await fetchStravaActivityDetail(admin, conn, o.stravaId); kall++; await sov(VENT_MS)
        const streams = await fetchStravaStreams(admin, conn, o.stravaId, ['time', 'heartrate']); kall++; await sov(VENT_MS)
        const { rader, laps, harEkteLaps } = byggRader(o.id, detail)
        const sonetid = leggPaaSoner(rader, laps, streams, heartZones)
        cache[o.id] = { rader, harEkteLaps, antallLaps: laps.length, sonetid }
        logg(`${epost(userId)} ${o.date} «${o.title ?? ''}»: ${rader.length} rader, sonetid ${Math.round(sonetid / 60)} min (${harEkteLaps ? 'ekte laps' : 'syntetisk'})`)
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e)
        if (/429/.test(m)) { logg('429 fra Strava - venter 15 min'); await sov(15 * 60_000); cache[o.id] = { feil: m }; continue }
        cache[o.id] = { feil: /404/.test(m) ? 'slettet på Strava (404)' : /401|403/.test(m) ? `token/scope avvist (${m})` : m }
        logg(`${epost(userId)} ${o.date}: FEIL ${cache[o.id] && 'feil' in cache[o.id] ? (cache[o.id] as { feil: string }).feil : m}`)
        await sov(VENT_MS)
      }
      writeFileSync(MELLOMLAGER, JSON.stringify(cache))
    }
  }
  writeFileSync(MELLOMLAGER, JSON.stringify(cache))

  // ── SQL ──
  const linjer: string[] = []
  linjer.push('-- BACKFILL: aktivitetsrader for Strava-økter som mistet dem (cron-feil rettet i 4ee2b73).')
  linjer.push(`-- Generert ${new Date().toISOString()} av scripts/backfill-strava-rader.ts. Demo-brukeren (${DEMO}) er utelatt.`)
  linjer.push('--')
  const kanIkke = okter.filter(o => !cache[o.id] || 'feil' in cache[o.id]).length
  linjer.push(`-- FØR (kjør først): forventet ${okter.length} Strava-økter uten aktivitetsrader totalt. ETTER: forventet ${kanIkke} (de som ikke kunne hentes, se rapporten).`)
  linjer.push('-- Spørringen (samme før og etter) - Strava-økter uten aktivitetsrader per bruker:')
  linjer.push('--   select w.user_id, count(*) from workouts w')
  linjer.push(`--   where w.imported_from = 'strava' and w.user_id <> '${DEMO}'`)
  linjer.push('--     and not exists (select 1 from workout_activities a where a.workout_id = w.id)')
  linjer.push('--   group by w.user_id order by 2 desc;')
  linjer.push('--')
  linjer.push('-- Hver DO-blokk setter inn radene for ÉN bruker og feiler (ruller alt tilbake) om antallet ikke stemmer')
  linjer.push('-- eller om økta har fått rader i mellomtida (where not exists).')
  linjer.push('begin;')
  const rapport: string[] = []
  const stikk: string[] = []
  let totalt = 0
  for (const [userId, liste] of perBruker) {
    const ok = liste.filter(o => cache[o.id] && !('feil' in cache[o.id]))
    const feil = liste.filter(o => !cache[o.id] || 'feil' in cache[o.id])
    const rader = ok.flatMap(o => (cache[o.id] as { rader: Rad[] }).rader)
    const aarsaker: Record<string, number> = {}
    for (const o of feil) { const a = cache[o.id] ? (cache[o.id] as { feil: string }).feil : 'ikke hentet'; aarsaker[a] = (aarsaker[a] ?? 0) + 1 }
    rapport.push(`  ${epost(userId)}: ${ok.length} økter får rader (${rader.length} rader), ${feil.length} kunne ikke hentes${feil.length ? ' - ' + Object.entries(aarsaker).map(([a, n]) => `${a}: ${n}`).join(', ') : ''}`)
    for (const o of ok.slice(0, 2)) { const r = cache[o.id] as { rader: Rad[]; sonetid: number }; if (stikk.length < 10) stikk.push(`  ${o.id} · ${o.date} · ${r.rader.length} rader · sonetid ${Math.round(r.sonetid / 60)} min · ${epost(userId)}`) }
    if (rader.length === 0) continue
    totalt += rader.length
    linjer.push('')
    linjer.push(`-- ${epost(userId)} (${userId}): ${ok.length} økter, ${rader.length} rader`)
    linjer.push('do $$')
    linjer.push('declare n int;')
    linjer.push('begin')
    linjer.push(`  insert into public.workout_activities (${KOLONNER.join(', ')})`)
    // workout_id må castes: tekstlitteraler i VALUES blir text, kolonnen er uuid.
    linjer.push(`  select ${KOLONNER.map(k => k === 'workout_id' ? 'workout_id::uuid' : k).join(', ')} from (values`)
    linjer.push(rader.map(r => `    (${KOLONNER.map(k => sqlVerdi(r[k])).join(', ')})`).join(',\n'))
    linjer.push(`  ) as v(${KOLONNER.join(', ')})`)
    linjer.push('  where not exists (select 1 from public.workout_activities a where a.workout_id = v.workout_id::uuid);')
    linjer.push('  get diagnostics n = row_count;')
    linjer.push(`  if n <> ${rader.length} then raise exception '${epost(userId).replace(/'/g, "''")}: satte inn % rader, forventet ${rader.length}', n; end if;`)
    linjer.push('end $$;')
  }
  linjer.push('')
  linjer.push('-- ETTER: samme spørring som FØR - skal gi bare de øktene som ikke kunne hentes fra Strava (se rapporten).')
  linjer.push('commit;')
  mkdirSync('supabase', { recursive: true })
  writeFileSync(SQL_FIL, linjer.join('\n') + '\n')

  console.log('\n══ RAPPORT ══')
  console.log(`Strava-kall brukt i denne kjøringen: ${kall}`)
  console.log(`Økter uten rader: ${okter.length}; rader i SQL-fila: ${totalt}; fil: ${SQL_FIL}`)
  console.log('Per bruker:'); for (const r of rapport) console.log(r)
  console.log('Stikkprøver (workout_id · dato · rader · sonetid):'); for (const s of stikk) console.log(s)
}

main().catch(e => { console.error(e); process.exit(1) })
