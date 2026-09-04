// FIKTIVE DATA for forsidens app-flater (design/xpulse-forside-v6-design.html).
// Forsiden monterer de EKTE komponentene med disse dataene og eksporterer
// resultatet som statisk HTML (scripts/forside-eksport.mjs). Alt her er
// oppdiktet — ingen ekte brukerdata. Ren logikk, ingen react.
import type { ActivityRow, CalendarWorkoutSummary } from './types'
import { nyAktivitetsrad } from './aktivitetsrad'
import { beregnSegmenter, type Segment, type SegmentRad } from './segmenter'
import { fraActivityRows, type PlanBlokkInn } from './plan-graf'
import type { HelseOversiktData, HelseDag } from '@/app/actions/helse-oversikt'
import type { Season, SeasonPeriod, SeasonMarking, SeasonKeyDate } from '@/app/actions/seasons'
import type { PlottTreffGruppe } from '@/app/actions/plott-treff'

// ── ØKTA TOR 3. SEP: oppv 20 · 2 × 10 min I3 / 3 min (🎯 L/S i pausene) · 3 × 5 min I4 / 2 min (🎯) · nedjogg 15 ──
export interface OktDel { type: string; sek: number; sone?: string; skudd?: 'L' | 'S' }
export const OKTA: OktDel[] = [
  { type: 'oppvarming', sek: 1200, sone: 'I1' },
  { type: 'aktivitet', sek: 600, sone: 'I3' }, { type: 'skyting_kombinert', sek: 60, skudd: 'L' }, { type: 'aktiv_pause', sek: 120 },
  { type: 'aktivitet', sek: 600, sone: 'I3' }, { type: 'skyting_kombinert', sek: 60, skudd: 'S' }, { type: 'aktiv_pause', sek: 120 },
  { type: 'aktivitet', sek: 300, sone: 'I4' }, { type: 'skyting_kombinert', sek: 45, skudd: 'L' }, { type: 'aktiv_pause', sek: 75 },
  { type: 'aktivitet', sek: 300, sone: 'I4' }, { type: 'skyting_kombinert', sek: 45, skudd: 'S' }, { type: 'aktiv_pause', sek: 75 },
  { type: 'aktivitet', sek: 300, sone: 'I4' },
  { type: 'nedjogg', sek: 900, sone: 'I1' },
]
export const OKTA_TOTAL = OKTA.reduce((a, d) => a + d.sek, 0)

const mmss = (sek: number) => `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`

/** Skjemarader (ActivityRow) — plan-grafen, kalenderchipen og båndet leser disse. */
export function oktaRader(): ActivityRow[] {
  return OKTA.map((d, i) => {
    const r = nyAktivitetsrad(d.type as ActivityRow['activity_type'], d.type.startsWith('skyting') ? '' : 'Langrenn')
    r.id = `okt-${i}`
    r.movement_subcategory = d.type.startsWith('skyting') ? '' : 'Skøyting'
    r.duration = mmss(d.sek)
    if (d.sone) r.zones = { ...r.zones, [d.sone]: mmss(d.sek) } as ActivityRow['zones']
    if (d.skudd === 'L') { r.prone_shots = '5'; r.prone_hits = i < 8 ? '5' : '5' }
    if (d.skudd === 'S') { r.standing_shots = '5'; r.standing_hits = i < 8 ? '5' : '3' }
    if (i >= 1 && i <= 6) r.gruppe_id = 'sett-a'
    if (i >= 7 && i <= 13) r.gruppe_id = 'sett-b'
    return r
  })
}

export function oktaPlanBlokker(): PlanBlokkInn[] { return fraActivityRows(oktaRader()) }

/** Klokkerader → segmenter på båndet (samme oversettelse som appen). */
export function oktaSegmenter(): Segment[] {
  const rader: SegmentRad[] = OKTA.map((d, i) => ({
    id: `okt-${i}`, activity_type: d.type, movement_name: d.type.startsWith('skyting') ? null : 'Langrenn',
    duration_seconds: d.sek, window_start_seconds: null, window_duration_seconds: null,
    prone_shots: d.skudd === 'L' ? 5 : null, prone_hits: d.skudd === 'L' ? 5 : null,
    standing_shots: d.skudd === 'S' ? 5 : null, standing_hits: d.skudd === 'S' ? (i > 8 ? 3 : 5) : null,
    harKlokkeProveniens: true, gruppeId: i >= 1 && i <= 6 ? 'sett-a' : i >= 7 && i <= 13 ? 'sett-b' : null,
  }))
  return beregnSegmenter(rader, OKTA_TOTAL)
}

/** Pulskurve, watt og høyde — én verdi per 5. sekund, formet etter øktas deler. */
export function oktaSamples() {
  const hr: Array<{ t: number; hr: number }> = []
  const watt: Array<{ t: number; w: number }> = []
  const alt: Array<{ t: number; alt: number }> = []
  const fart: Array<{ t: number; mps: number }> = []
  let t = 0
  let puls = 118
  const rnd = (i: number) => (Math.sin(i * 12.9898) * 43758.5453) % 1  // deterministisk «støy»
  for (const d of OKTA) {
    const maal = d.type === 'oppvarming' ? 148 : d.sone === 'I3' ? 166 : d.sone === 'I4' ? 178 : d.type.startsWith('skyting') ? 140 : d.type === 'nedjogg' ? 126 : 132
    const steg = 5
    for (let s = 0; s < d.sek; s += steg) {
      // Puls glir mot målet — raskt opp i drag, sakte ned i pause/skyting.
      const k = d.type.startsWith('skyting') || d.type === 'aktiv_pause' ? 0.05 : d.type === 'oppvarming' ? 0.012 : d.type === 'nedjogg' ? 0.02 : 0.08
      puls += (maal - puls) * k + rnd(t) * 1.6 - 0.8
      const v = Math.round(puls)
      hr.push({ t, hr: v })
      const w = d.type.startsWith('skyting') ? 0 : Math.max(0, Math.round((v - 100) * 3.3 + rnd(t + 7) * 18))
      watt.push({ t, w })
      alt.push({ t, alt: Math.round(420 + 22 * Math.sin(t / 420) + 10 * Math.sin(t / 97)) })
      fart.push({ t, mps: d.type.startsWith('skyting') ? 0 : Math.round((2.6 + (v - 110) / 40 + rnd(t + 3) * 0.3) * 100) / 100 })
      t += steg
    }
  }
  return {
    hr_samples: hr, watt_samples: watt, pace_samples: null, speed_samples: fart,
    altitude_samples: alt, cadence_samples: null,
  }
}

export function oktaLaps() {
  const ut: Array<{ t_start: number; index: number; label?: string }> = []
  let t = 0
  OKTA.forEach((d, i) => { ut.push({ t_start: t, index: i }); t += d.sek })
  return ut
}

export const OKTA_LAKTAT = [{ t: 1200 + 600 + 60 + 120 + 600 + 20, mmol: 2.8 }, { t: 1200 + 1560 + 300 + 45 + 75 + 300 + 20, mmol: 3.4 }]
export const OKTA_ERNAERING = [{ t: 58 * 60, type: 'gel', carbs_g: 40 }]

// ── KALENDERUKA (uke 34) — samme økt torsdag ──
function kort(id: string, felter: Partial<CalendarWorkoutSummary>): CalendarWorkoutSummary {
  return {
    id, title: '', date: '2026-08-17', workout_type: 'easy', is_planned: false, is_completed: true, is_important: false,
    live_started_at: null, coach_name: null, updated_at: null, sport: 'cross_country_skiing', primary_movement: null,
    duration_minutes: 60, distance_km: null, time_of_day: null, sort_order: 0, created_by_coach_id: null,
    competition_type: null, position_overall: null, start_time: null, blokker: [], punkter: [],
    shooting_seconds: 0, planned_shooting_seconds: 0, total_meters: 0, planned_total_meters: 0, zone_seconds: {}, planned_zone_seconds: {},
    ...felter,
  } as unknown as CalendarWorkoutSummary
}
/** Chipen leser total_seconds / planned_total_seconds — utledes av minuttene. */
function medTid(w: CalendarWorkoutSummary): CalendarWorkoutSummary {
  const sek = (w.duration_minutes ?? 0) * 60
  const skyting = w.title.includes('3 × 5 min') ? 210 : 0
  return { ...w, total_seconds: sek - skyting, planned_total_seconds: sek - skyting, shooting_seconds: skyting, planned_shooting_seconds: skyting } as CalendarWorkoutSummary
}
const enkel = (type: string, sek: number, sone: string): PlanBlokkInn[] => fraActivityRows([(() => { const r = nyAktivitetsrad(type as ActivityRow['activity_type'], 'Løping'); r.duration = mmss(sek); r.zones = { ...r.zones, [sone]: mmss(sek) } as ActivityRow['zones']; return r })()])
export function kalenderUke(): Array<{ dato: string; dag: string; okter: CalendarWorkoutSummary[] }> {
  return kalenderUkeRaa().map(d => ({ ...d, okter: d.okter.map(medTid) }))
}
function kalenderUkeRaa(): Array<{ dato: string; dag: string; okter: CalendarWorkoutSummary[] }> {
  const rader6x6 = (() => {
    const ut: ActivityRow[] = []
    const legg = (type: string, sek: number, sone?: string) => { const r = nyAktivitetsrad(type as ActivityRow['activity_type'], 'Rulleski'); r.duration = mmss(sek); if (sone) r.zones = { ...r.zones, [sone]: mmss(sek) } as ActivityRow['zones']; ut.push(r) }
    legg('oppvarming', 1500, 'I1'); for (let i = 0; i < 6; i++) { legg('aktivitet', 360, 'I3'); if (i < 5) legg('aktiv_pause', 120) } legg('nedjogg', 900, 'I1')
    return fraActivityRows(ut)
  })()
  return [
    { dato: '2026-08-17', dag: 'MANDAG 17.', okter: [kort('m1', { title: 'Rolig 60 min', sport: 'running', primary_movement: 'Løping', duration_minutes: 60, blokker: enkel('aktivitet', 3600, 'I1') })] },
    { dato: '2026-08-18', dag: 'TIRSDAG 18.', okter: [kort('t1', { title: '6 × 6 min I3 / 2 min', primary_movement: 'Rulleski', duration_minutes: 86, rpe: 7, blokker: rader6x6 } as Partial<CalendarWorkoutSummary>), kort('t2', { title: 'Styrke basis', sport: 'endurance', primary_movement: 'Styrke', duration_minutes: 45, blokker: [] })] },
    { dato: '2026-08-19', dag: 'ONSDAG 19.', okter: [kort('o1', { title: 'Hvile', is_planned: true, is_completed: false, duration_minutes: 0, blokker: [] })] },
    { dato: '2026-08-20', dag: 'TORSDAG 20.', okter: [kort('to1', { title: '2 × 10 min I3 / 3 min + 3 × 5 min I4', sport: 'biathlon', primary_movement: 'Skøyting', duration_minutes: 78, blokker: oktaPlanBlokker() })] },
    { dato: '2026-08-21', dag: 'FREDAG 21.', okter: [kort('f1', { title: 'Rolig 90 min', is_planned: true, is_completed: false, primary_movement: 'Løping', duration_minutes: 90, blokker: enkel('aktivitet', 5400, 'I1') })] },
    { dato: '2026-08-22', dag: 'LØRDAG 22.', okter: [kort('l1', { title: 'Lett + 4 spurter', is_planned: true, is_completed: false, duration_minutes: 50, blokker: (() => { const ut: ActivityRow[] = []; const legg = (type: string, sek: number, sone?: string) => { const r = nyAktivitetsrad(type as ActivityRow['activity_type'], 'Løping'); r.duration = mmss(sek); if (sone) r.zones = { ...r.zones, [sone]: mmss(sek) } as ActivityRow['zones']; ut.push(r) }; legg('oppvarming', 1800, 'I1'); for (let i = 0; i < 4; i++) { legg('aktivitet', 60, 'I5'); if (i < 3) legg('aktiv_pause', 180) } legg('nedjogg', 600, 'I1'); return fraActivityRows(ut) })() })] },
    { dato: '2026-08-23', dag: 'SØNDAG 23.', okter: [kort('s1', { title: '🏁 NC Simostranda', workout_type: 'competition', competition_type: 'jaktstart', is_planned: true, is_completed: false, duration_minutes: 45, blokker: [] } as unknown as Partial<CalendarWorkoutSummary>)] },
  ]
}

// ── HELSE — 30 dager ──
export function helseData(): HelseOversiktData {
  const dager: HelseDag[] = []
  const idag = new Date('2026-09-04')
  for (let i = 29; i >= 0; i--) {
    const d = new Date(idag); d.setDate(idag.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const tr = (30 - i) / 30
    const s = Math.sin(i * 1.7)
    const dyp = 80 + Math.round(12 * Math.sin(i * 0.9)), lett = 210 + Math.round(20 * s), rem = 100 + Math.round(15 * Math.cos(i * 0.7)), vaken = 8 + Math.round(6 * Math.abs(s))
    dager.push({
      date: iso, resting_hr: Math.round(47 - 3 * tr + s), hrv_ms: Math.round(86 + 10 * tr + 4 * s), steps: 9000 + Math.round(3000 * s),
      daily_distance_m: null, stairs_climbed: null, sleep_score: Math.round(74 + 9 * tr + 3 * s), total_sleep_minutes: dyp + lett + rem,
      deep_minutes: dyp, light_minutes: lett, rem_minutes: rem, awake_minutes: vaken, sleep_start: '22:48', sleep_end: '06:30',
      body_weight_kg: null, kilder: i === 0 ? { resting_hr: 'manual', hrv_ms: 'garmin', sleep_score: 'garmin' } : { resting_hr: 'garmin', hrv_ms: 'garmin', sleep_score: 'garmin' },
      day_form: i % 5 === 2 ? null : Math.max(2, Math.min(5, Math.round(3.8 + 0.9 * s))),   // dagsform er 1–5 (stjernene i skjemaet)
    })
  }
  const siste = dager[dager.length - 1]
  siste.resting_hr = 44; siste.hrv_ms = 95; siste.sleep_score = 82; siste.total_sleep_minutes = 462; siste.day_form = 4
  return { harData: true, kilde: { navn: 'Garmin', tidspunkt: '2026-09-04T07:12:00Z' }, dager, sisteNatt: { date: siste.date, stadier: null, nap_minutes: null }, merke: null }
}

// ── ÅRSPLAN 2026/27 · uke 40 → 14 ──
export function aarsplan(): { season: Season; periods: SeasonPeriod[]; markings: SeasonMarking[]; keyDates: SeasonKeyDate[] } {
  const season = { id: 's1', user_id: 'x', name: '2026/27', start_date: '2026-09-28', end_date: '2027-04-04', goal_main: 'NM', goal_details: null, kpi_notes: null, annual_shot_goal: null, created_at: '' } as unknown as Season
  const per = (id: string, name: string, s: string, e: string, intensity: SeasonPeriod['intensity'], i: number) => ({ id, season_id: 's1', name, focus: null, start_date: s, end_date: e, intensity, notes: null, sort_order: i, created_at: '' } as unknown as SeasonPeriod)
  const periods = [
    per('p1', 'Grunnperiode', '2026-09-28', '2026-11-08', 'rolig', 0),
    per('p2', 'Spesifikk', '2026-11-09', '2026-12-06', 'medium', 1),
    per('p3', 'Konkurranse', '2026-12-07', '2027-01-03', 'hard', 2),
    per('p4', 'Mellom', '2027-01-04', '2027-01-17', 'rolig', 3),
    per('p5', 'Konkurranse', '2027-01-18', '2027-03-14', 'hard', 4),
  ]
  const markings = [
    { id: 'm1', season_id: 's1', is_training_camp: true, is_altitude: true, name: 'Livigno', location: 'Livigno', altitude_meters: 1800, notes: null, start_date: '2026-10-12', end_date: '2026-10-25', source_period_id: null, created_at: '' },
    { id: 'm2', season_id: 's1', is_training_camp: true, is_altitude: false, name: 'Oberhof · varme', location: 'Oberhof', altitude_meters: null, notes: null, start_date: '2027-01-04', end_date: '2027-01-10', source_period_id: null, created_at: '' },
  ] as unknown as SeasonMarking[]
  const keyDates = [
    { id: 'k1', season_id: 's1', event_type: 'competition_b', event_date: '2026-11-21', name: 'Beitostølen', sport: 'biathlon', location: 'Beitostølen', distance_format: null },
    { id: 'k2', season_id: 's1', event_type: 'competition_a', event_date: '2026-12-12', name: 'NC Simostranda', sport: 'biathlon', location: 'Simostranda', distance_format: null },
    { id: 'k3', season_id: 's1', event_type: 'competition_a', event_date: '2027-01-23', name: 'NM', sport: 'biathlon', location: null, distance_format: null },
  ] as unknown as SeasonKeyDate[]
  return { season, periods, markings, keyDates }
}

// ── PLOTT TREFF · serie 2 · stående · 4/5, bom blink 2 høyre oppe ──
export function plottTreffGruppe(): PlottTreffGruppe {
  return {
    activityId: 'okt-5', activityType: 'skyting_kombinert', shootingType: null, erTest: false, testRef: null, sortOrder: 5,
    startSek: 1200 + 600 + 60 + 120 + 600, sluttSek: 1200 + 600 + 60 + 120 + 600 + 60,
    serier: [{
      id: 's2', db_id: 's2', position: 'S', shots: '5', hits: '4', time_seconds: '28.4', avg_heart_rate: '168', max_heart_rate: '', note: '',
      shot_plot: [{ x: 0.53, y: 0.48 }, { x: 0.72, y: 0.35 }, { x: 0.45, y: 0.53 }, { x: 0.57, y: 0.55 }, { x: 0.48, y: 0.43 }],
      points: '', vind_retning: 'H', vind_styrke: 3, sikt: 'god',
    }],
  } as unknown as PlottTreffGruppe
}

// ── STANDARDØKTA: 3 × 20 min I3 / 3 min · oppv 15 · nedjogg 12 ──
export function standardoktBlokker(): PlanBlokkInn[] {
  const ut: ActivityRow[] = []
  const legg = (type: string, sek: number, sone?: string) => { const r = nyAktivitetsrad(type as ActivityRow['activity_type'], 'Løping'); r.duration = mmss(sek); if (sone) r.zones = { ...r.zones, [sone]: mmss(sek) } as ActivityRow['zones']; ut.push(r) }
  legg('oppvarming', 900, 'I1'); for (let i = 0; i < 3; i++) { legg('aktivitet', 1200, 'I3'); if (i < 2) legg('aktiv_pause', 180) } legg('nedjogg', 720, 'I1')
  return fraActivityRows(ut)
}
