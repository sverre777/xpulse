// Seeder en realistisk skiskytersesong for DEMO-brukeren.
// Kjør: npx tsx scripts/seed-testbruker.ts
//
// VIKTIG: denne brukeren er SYNTETISK. Radene ser ut som ekte tredjepartsdata
// (klokkesynk, Stridee-proveniens, samples). Brukeren må ekskluderes eksplisitt
// fra ethvert treningssett, kundetall og analysegrunnlag (regel 2).
//
// Alt avledet regnes med appens egne helpere, ikke med nye formler her:
//  · sonenøkler          ALL_ZONE_NAMES (lib/heart-zones)
//  · skyteaggregater     seriesToLegacyAggregates (lib/shooting)
//  · øktnivå-totaler     summert fra aktivitetsradene, som app/actions/workouts.ts
// zones er SEKUNDER (phase64). Feil her gir 60x volum i analysen.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { ALL_ZONE_NAMES } from '../lib/heart-zones'
import { seriesToLegacyAggregates } from '../lib/shooting'
import { SHOT_DISC_R, SHOT_INNER_R_REAL } from '../lib/shooting'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)

const USER = '1a97ac16-6ab7-43de-b3f0-245771322699'
const I_DAG = '2026-09-10'
const HIST_FRA = '2026-05-01', HIST_TIL = '2026-09-09'
const PLAN_TIL = '2026-10-10'

// ── Deterministisk tilfeldighet, så en ny kjøring gir samme sesong ──
let frø = 20260910
function rnd(): number { frø = (frø * 1103515245 + 12345) & 0x7fffffff; return frø / 0x7fffffff }
const mellom = (a: number, b: number) => a + rnd() * (b - a)
const heltall = (a: number, b: number) => Math.round(mellom(a, b))
const velg = <T,>(a: T[]): T => a[Math.min(a.length - 1, Math.floor(rnd() * a.length))]
const sjanse = (p: number) => rnd() < p

// ── Datohjelpere (rene datoer, ingen tidssone) ──
const d = (iso: string) => new Date(`${iso}T12:00:00Z`)
const iso = (x: Date) => x.toISOString().slice(0, 10)
const plussDager = (x: string, n: number) => { const y = d(x); y.setUTCDate(y.getUTCDate() + n); return iso(y) }
const dagNr = (x: string) => d(x).getUTCDay()            // 0 = søndag
const mellomDager = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / 86400000)
function* datoer(fra: string, til: string) { for (let x = fra; x <= til; x = plussDager(x, 1)) yield x }

const mmss = (sek: number) => `${String(Math.floor(sek / 3600)).padStart(2, '0')}:${String(Math.floor(sek % 3600 / 60)).padStart(2, '0')}:${String(sek % 60).padStart(2, '0')}`

// ── Sesongens perioder ──
const PERIODER = [
  { navn: 'Grunntrening 1', fra: '2026-05-01', til: '2026-06-30', intensity: 'rolig', fokus: 'Mengde, teknikk og basisskyting' },
  { navn: 'Grunntrening 2', fra: '2026-07-01', til: '2026-08-15', intensity: 'medium', fokus: 'Den harde mengdeperioden' },
  { navn: 'Spesifikk høst', fra: '2026-08-16', til: '2026-10-15', intensity: 'medium', fokus: 'Mer kombinasjon, NM rulleski' },
  { navn: 'Intensitet og form', fra: '2026-10-16', til: '2026-11-12', intensity: 'hard', fokus: 'Høyde i Ramsau, snø og spissing' },
  { navn: 'Konkurranse 1', fra: '2026-11-13', til: '2026-12-20', intensity: 'hard', fokus: 'Sesongstart og ASKO Cup' },
  { navn: 'Mellomperiode', fra: '2026-12-21', til: '2027-01-05', intensity: 'rolig', fokus: 'Mengde inn igjen i romjula' },
  { navn: 'Konkurranse 2', fra: '2027-01-06', til: '2027-03-31', intensity: 'hard', fokus: 'Norgescup og NM' },
  { navn: 'Overgang', fra: '2027-04-01', til: '2027-04-30', intensity: 'rolig', fokus: 'Alternativ trening og hvile' },
]

const SAMLINGER = [
  { navn: 'Sognefjellet', fra: '2026-06-08', til: '2026-06-15', hoyde: null as number | null, sted: 'Sognefjellet' },
  { navn: 'Torsby rulleski', fra: '2026-07-20', til: '2026-07-27', hoyde: null, sted: 'Torsby' },
  { navn: 'Sjusjøen', fra: '2026-09-14', til: '2026-09-24', hoyde: 850, sted: 'Sjusjøen' },
  { navn: 'Ramsau', fra: '2026-10-12', til: '2026-10-26', hoyde: 1700, sted: 'Ramsau' },
  { navn: 'Sjusjøen snøsamling', fra: '2026-11-01', til: '2026-11-10', hoyde: 850, sted: 'Sjusjøen' },
]

// event_type i prod: competition_a|b|c, test, camp, other. 'testlop' finnes IKKE.
const NOKKELDATOER = [
  { dato: '2026-08-07', type: 'competition_c', navn: 'Blink Festival, seniorløp', sted: 'Sandnes', notat: 'dato ikke verifisert' },
  { dato: '2026-09-06', type: 'competition_c', navn: 'Toten Rulleskiskytterfestival fellesstart', sted: 'Karidalen', notat: null },
  { dato: '2026-09-19', type: 'competition_b', navn: 'NM rulleskiskyting sprint', sted: 'Lygna', notat: null },
  { dato: '2026-09-20', type: 'competition_b', navn: 'NM rulleskiskyting fellesstart', sted: 'Lygna', notat: null },
  { dato: '2026-10-10', type: 'test', navn: 'Terskeltest laktat rulleski', sted: 'Lygna', notat: null },
  { dato: '2026-11-14', type: 'competition_a', navn: 'Sesongstart Skiskyting 2026', sted: 'Geilo', notat: null, topp: true },
  { dato: '2026-11-28', type: 'competition_b', navn: 'ASKO Cup Geilo sprint', sted: 'Geilo', notat: null },
  { dato: '2026-11-29', type: 'competition_b', navn: 'ASKO Cup Geilo fellesstart', sted: 'Geilo', notat: null },
  { dato: '2026-12-12', type: 'competition_b', navn: 'ASKO Cup Beitostølen normal', sted: 'Beitostølen', notat: null },
  { dato: '2026-12-13', type: 'competition_b', navn: 'ASKO Cup Beitostølen sprint', sted: 'Beitostølen', notat: null },
  { dato: '2027-01-09', type: 'competition_a', navn: 'ASKO Cup Liatoppen sprint', sted: 'Ål', notat: null },
  { dato: '2027-01-10', type: 'competition_b', navn: 'ASKO Cup Liatoppen fellesstart', sted: 'Ål', notat: null },
  { dato: '2027-01-23', type: 'competition_a', navn: 'ASKO Cup Oppdal normal', sted: 'Oppdal', notat: null },
  { dato: '2027-01-24', type: 'competition_b', navn: 'ASKO Cup Oppdal sprint', sted: 'Oppdal', notat: null },
  { dato: '2027-03-14', type: 'competition_b', navn: 'ASKO Cup Markane', sted: 'Markane', notat: 'dato ikke verifisert' },
  { dato: '2027-03-27', type: 'competition_a', navn: 'NM senior', sted: 'ikke fastsatt', notat: 'dato ikke verifisert' },
  { dato: '2027-04-17', type: 'competition_c', navn: 'NNM Alta supersprint', sted: 'Alta', notat: null },
  { dato: '2027-04-18', type: 'competition_c', navn: 'NNM Alta fellesstart', sted: 'Alta', notat: null },
]

const MND_PLAN: Record<string, { timer: number; skudd: number }> = {
  '2026-05': { timer: 88, skudd: 900 }, '2026-06': { timer: 92, skudd: 950 },
  '2026-07': { timer: 105, skudd: 1000 }, '2026-08': { timer: 95, skudd: 950 },
  '2026-09': { timer: 78, skudd: 800 }, '2026-10': { timer: 72, skudd: 750 },
  '2026-11': { timer: 68, skudd: 600 }, '2026-12': { timer: 62, skudd: 550 },
  '2027-01': { timer: 68, skudd: 600 }, '2027-02': { timer: 63, skudd: 550 },
  '2027-03': { timer: 60, skudd: 500 }, '2027-04': { timer: 48, skudd: 250 },
}

// Tester gjennom sesongen. workout_test_data + personal_records.
const TESTER: { dato: string; type: string; resultat: number; enhet: string; navn: string; sub?: string; laktattrapp?: boolean }[] = [
  { dato: '2026-05-12', type: 'vo2max', resultat: 78.4, enhet: 'ml/kg/min', navn: 'VO2max labtest' },
  { dato: '2026-05-20', type: 'standplass_10', resultat: 17, enhet: 'treff', navn: 'Standplass 10 skudd' },
  { dato: '2026-06-03', type: 'lt2', resultat: 9.42, enhet: 'min', navn: '3000 m løpstest', sub: 'Løping' },
  { dato: '2026-06-16', type: 'lt2', resultat: 21.4, enhet: 'km/t', navn: 'Terskeltest laktat rulleski', sub: 'Rulleski', laktattrapp: true },
  { dato: '2026-07-08', type: 'standplass_10', resultat: 18, enhet: 'treff', navn: 'Standplass 10 skudd' },
  { dato: '2026-08-11', type: 'lt2', resultat: 22.6, enhet: 'km/t', navn: 'Terskeltest laktat rulleski', sub: 'Rulleski', laktattrapp: true },
  { dato: '2026-08-19', type: 'standplass_10', resultat: 19, enhet: 'treff', navn: 'Standplass 10 skudd' },
  { dato: '2026-09-02', type: 'vo2max', resultat: 80.1, enhet: 'ml/kg/min', navn: 'VO2max labtest' },
]

const SYK_FRA = '2026-06-22', SYK_TIL = '2026-06-28'
const erSyk = (dato: string) => dato >= SYK_FRA && dato <= SYK_TIL
const iSamling = (dato: string) => SAMLINGER.find(s => dato >= s.fra && dato <= s.til) ?? null

// ── Typer ──
type Akt = {
  activity_type: string; movement_name: string; movement_subcategory?: string | null
  sort_order: number; duration_seconds: number; distance_meters?: number | null
  avg_heart_rate?: number | null; max_hr?: number | null; zones?: Record<string, number> | null
  elevation_gain_m?: number | null; avg_watts?: number | null; resistance_level?: number | null
  incline_percent?: number | null; rpe?: number | null; notes?: string | null
  shooting_type?: string | null; shooting_is_test?: boolean; shooting_surface?: string | null
  shooting_test_ref?: string | null; window_start_seconds?: number | null
  window_duration_seconds?: number | null; is_dry_training?: boolean
  serier?: Serie[]; ovelser?: { navn: string; sett: { reps: number; kg: number | null }[] }[]
  laktat?: { mmol: number; nar: string }[]
}
type Serie = {
  series_no: number; position: 'L' | 'S'; shots: number; hits: number; time_seconds: number
  avg_heart_rate: number | null; max_heart_rate: number | null
  shot_plot: ({ x: number; y: number } | null)[]
  vind_retning?: string | null; vind_styrke?: number | null; sikt?: string | null
}
type Okt = {
  dato: string; tittel: string; workout_type: string; tid?: string
  planlagt: boolean; akt: Akt[]; notat?: string | null; rpe?: number | null
  klokke: boolean; hoyde?: number | null; viktig?: boolean
  planMin?: number | null; planKm?: number | null
  utstyr?: string[]   // navn, kobles etterpå
  test?: { type: string; resultat: number; enhet: string; navn?: string } | null
}

// ── Soner ──
const tomSone = (): Record<string, number> => Object.fromEntries(ALL_ZONE_NAMES.map(z => [z, 0]))
function sone(felt: Record<string, number>): Record<string, number> {
  const ut = tomSone()
  for (const [k, v] of Object.entries(felt)) ut[k] = Math.round(v)
  return ut
}

// ── Skyting ──
const HR_LIGG = SHOT_INNER_R_REAL   // treffområde liggende
function plott(treff: boolean, pos: 'L' | 'S', spredning: number, vindSkyv: number): { x: number; y: number } {
  const maks = pos === 'L' ? HR_LIGG : SHOT_DISC_R
  const r = treff ? mellom(0, maks * 0.85) : mellom(maks * 1.12, maks * 1.8)
  const vinkel = rnd() * Math.PI * 2
  return {
    x: Math.max(0.02, Math.min(0.98, 0.5 + Math.cos(vinkel) * r * spredning + vindSkyv)),
    y: Math.max(0.02, Math.min(0.98, 0.5 + Math.sin(vinkel) * r)),
  }
}
function lagSerie(nr: number, pos: 'L' | 'S', treffProsent: number, puls: number | null, vind: boolean): Serie {
  const skudd = 5
  let treff = 0
  const plot: ({ x: number; y: number } | null)[] = []
  const vindSkyv = vind ? mellom(-0.06, 0.06) : 0
  for (let i = 0; i < skudd; i++) {
    const t = sjanse(treffProsent)
    if (t) treff++
    plot.push(plott(t, pos, mellom(0.7, 1.15), vindSkyv))
  }
  return {
    series_no: nr, position: pos, shots: skudd, hits: treff,
    time_seconds: pos === 'L' ? heltall(22, 30) : heltall(20, 28),
    avg_heart_rate: puls, max_heart_rate: puls ? puls + heltall(3, 9) : null,
    shot_plot: plot,
    vind_retning: vind ? velg(['H', 'V']) : null,
    vind_styrke: vind ? heltall(1, 4) : null,
    sikt: vind ? velg(['god', 'lett_taake']) : null,
  }
}
const TREFF: Record<string, { L: [number, number]; S: [number, number] }> = {
  basisskyting: { L: [0.92, 0.98], S: [0.85, 0.92] },
  rolig_komb: { L: [0.88, 0.94], S: [0.78, 0.86] },
  hard_komb: { L: [0.82, 0.90], S: [0.70, 0.82] },
  hurtighet_komb: { L: [0.80, 0.88], S: [0.68, 0.80] },
  konkurranse: { L: [0.80, 0.88], S: [0.66, 0.80] },
}

let sorterer = 0
function skyterad(type: string, pos: 'L' | 'S', antallSerier: number, puls: number | null, vind: boolean, daarligDag: boolean, vindu?: { start: number; lengde: number }): Akt {
  const omr = TREFF[type] ?? TREFF.basisskyting
  const [lo, hi] = pos === 'L' ? omr.L : omr.S
  let p = mellom(lo, hi)
  if (daarligDag && pos === 'S') p = mellom(0.50, 0.60)
  const serier: Serie[] = []
  for (let i = 0; i < antallSerier; i++) serier.push(lagSerie(i + 1, pos, p, puls, vind))
  // 45-75 s per serie: skytetid pluss inn- og utgang paa standplass.
  const sek = serier.reduce((s, x) => s + x.time_seconds, 0) + antallSerier * heltall(23, 45)
  // 'konkurranse' er kun en treff-profil her; lovlige db-verdier er de fem i
  // phase85. Konkurranseskyting lagres som hard_komb.
  const dbType = type === 'konkurranse' ? 'hard_komb' : type
  return {
    activity_type: pos === 'L' ? 'skyting_liggende' : 'skyting_staaende',
    movement_name: 'Skiskyting', sort_order: sorterer++,
    duration_seconds: sek, shooting_type: dbType, shooting_surface: 'papp',
    avg_heart_rate: puls, max_hr: puls ? puls + heltall(4, 10) : null,
    window_start_seconds: vindu?.start ?? null, window_duration_seconds: vindu?.lengde ?? null,
    serier,
  }
}

// ── Laktat ───────────────────────────────────────────────────
// Norske skiskyttere måler jevnlig, ikke bare på tester. Verdiene henger på
// sonen OG på formen: litt høyere på samme fart i juli når belastningen er
// høyest, litt lavere i formtoppene i august og september.
function formfaktor(dato: string): number {
  if (dato >= '2026-07-01' && dato <= '2026-07-31') return 1.12
  if (dato >= '2026-08-03' && dato <= '2026-08-09') return 0.9
  if (dato >= '2026-09-01' && dato <= '2026-09-09') return 0.88
  return 1
}
function laktatFor(sone: string, dato: string, sent: boolean): number {
  const f = formfaktor(dato)
  const omr: Record<string, [number, number]> = {
    I1: [0.8, 1.4], I2: [1.0, 1.6], I3: [2.4, 4.2], I4: [5.0, 8.5], I5: [9, 13],
  }
  const [lo, hi] = omr[sone] ?? [1, 2]
  const v = sent ? mellom((lo + hi) / 2, hi) : mellom(lo, (lo + hi) / 2)
  return Math.round(v * f * 10) / 10
}

// ── Bevegelsesformer ──
const RULLESKI = (sub: 'Skøyting' | 'Klassisk') => ({ movement_name: 'Rulleski', movement_subcategory: sub })
const LOPING = { movement_name: 'Løping', movement_subcategory: null as string | null }
const LANGRENN = (sub: 'Skøyting' | 'Klassisk') => ({ movement_name: 'Langrenn', movement_subcategory: sub })
const SKIERG = { movement_name: 'SkiErg', movement_subcategory: null as string | null }
const SYKKEL = { movement_name: 'Sykling', movement_subcategory: null as string | null }
const STYRKE = { movement_name: 'Styrke', movement_subcategory: null as string | null }

const fartKmt = (form: string, sone: string) => {
  const base: Record<string, number> = { Rulleski: 20, Løping: 11.5, Langrenn: 18, Sykling: 28, SkiErg: 0 }
  const f = base[form] ?? 12
  const mult = sone === 'I1' ? 0.86 : sone === 'I2' ? 0.94 : sone === 'I3' ? 1.05 : sone === 'I4' ? 1.13 : 1.2
  return f * mult
}
const pulsFor = (s: string) => ({ I1: heltall(118, 132), I2: heltall(133, 147), I3: heltall(152, 163), I4: heltall(166, 176), I5: heltall(178, 188), Hurtighet: heltall(140, 165) }[s] ?? 130)

function rad(t: string, form: { movement_name: string; movement_subcategory: string | null }, sek: number, s: string, ekstra: Partial<Akt> = {}): Akt {
  const km = form.movement_name === 'Styrke' || form.movement_name === 'SkiErg' ? 0 : fartKmt(form.movement_name, s) * sek / 3600
  const puls = pulsFor(s)
  return {
    activity_type: t, movement_name: form.movement_name, movement_subcategory: form.movement_subcategory,
    sort_order: sorterer++, duration_seconds: sek,
    distance_meters: km > 0 ? Math.round(km * 1000) : null,
    avg_heart_rate: puls, max_hr: puls + heltall(4, 12),
    zones: sone({ [s]: sek }),
    elevation_gain_m: km > 0 ? Math.round(km * mellom(6, 14)) : null,
    ...ekstra,
  }
}

// ── Øktbyggere ───────────────────────────────────────────────
type Form = { movement_name: string; movement_subcategory: string | null }

function nyOkt(dato: string, tittel: string, type: string, akt: Akt[], o: Partial<Okt> = {}): Okt {
  return {
    dato, tittel, workout_type: type, planlagt: dato > HIST_TIL, akt,
    klokke: o.klokke ?? true, tid: o.tid ?? velg(['08:15', '09:40', '10:30', '16:45', '17:30']),
    ...o,
  } as Okt
}

function rolig(dato: string, form: Form, min: number, tittel?: string): Okt {
  sorterer = 0
  const sek = min * 60
  const i2 = Math.round(sek * mellom(0.15, 0.35))
  const a = rad('aktivitet', form, sek, 'I1')
  a.zones = sone({ I1: sek - i2, I2: i2 })
  return nyOkt(dato, tittel ?? `Rolig ${form.movement_name.toLowerCase()} ${Math.round(min / 60 * 10) / 10} t`, 'easy', [a], { rpe: heltall(2, 4) })
}

function langtur(dato: string, form: Form, min: number, medHurtighet: boolean): Okt {
  sorterer = 0
  const sek = min * 60
  const hurt = medHurtighet ? heltall(6, 8) : 0
  const hovedSek = sek - hurt * 70
  const i2 = Math.round(hovedSek * mellom(0.25, 0.45))
  const rader: Akt[] = []
  const hoved = rad('aktivitet', form, hovedSek, 'I1')
  hoved.zones = sone({ I1: hovedSek - i2, I2: i2 })
  rader.push(hoved)
  for (let i = 0; i < hurt; i++) {
    const drag = heltall(8, 12)
    rader.push(rad('aktivitet', form, drag, 'Hurtighet', { notes: `Hurtighet ${drag} s` }))
    rader.push(rad('aktiv_pause', form, 70 - drag, 'I1'))
  }
  // Kontrollmaaling paa noen rolige langturer: viser at I1 faktisk ligger lavt.
  if (sjanse(0.22)) rader[0].laktat = [{ mmol: laktatFor('I1', dato, false), nar: mmss(Math.round(hovedSek * 0.7)) }]
  return nyOkt(dato, `Langtur ${form.movement_name.toLowerCase()} ${Math.round(min / 60 * 10) / 10} t`, 'long_run', rader, { rpe: heltall(3, 5) })
}

function intervall(dato: string, form: Form, drag: number, dragMin: number, s: 'I3' | 'I4' | 'I5', skyting: string | null, daarlig: boolean): Okt {
  sorterer = 0
  const rader: Akt[] = []
  const oppv = heltall(18, 25) * 60
  const o = rad('oppvarming', form, oppv, 'I1')
  o.zones = sone({ I1: Math.round(oppv * 0.7), I2: Math.round(oppv * 0.3) })
  rader.push(o)
  if (skyting) rader.push(skyterad(skyting, 'L', 1, heltall(120, 135), false, false))
  let klokke = oppv
  for (let i = 0; i < drag; i++) {
    const dsek = Math.round(dragMin * 60)
    rader.push(rad('aktivitet', form, dsek, s, { rpe: s === 'I5' ? 9 : s === 'I4' ? 8 : 6, notes: `Drag ${i + 1}` }))
    klokke += dsek
    if (skyting) {
      const sr = skyterad(skyting, i % 2 === 0 ? 'L' : 'S', sjanse(0.22) ? 2 : 1, heltall(150, 172), sjanse(0.35), daarlig, { start: klokke, lengde: 60 })
      rader.push(sr); klokke += sr.duration_seconds
    }
    if (i < drag - 1) {
      const psek = Math.round(dragMin * 60 * mellom(0.4, 0.6))
      rader.push(rad('aktiv_pause', form, psek, 'I1')); klokke += psek
    }
  }
  const ned = heltall(12, 18) * 60
  rader.push(rad('nedjogg', form, ned, 'I1'))
  // Laktat som rutine: I3 etter drag 2 og siste, I4 etter foerste og siste.
  const dragRader = rader.filter(r => r.activity_type === 'aktivitet' && r.notes?.startsWith('Drag'))
  if (dragRader.length >= 2 && sjanse(s === 'I5' ? 0.35 : 0.8)) {
    const foerste = s === 'I3' ? dragRader[Math.min(1, dragRader.length - 1)] : dragRader[0]
    const siste = dragRader[dragRader.length - 1]
    const nar = (r: Akt) => {
      let t = 0
      for (const x of rader) { if (x === r) break; t += x.duration_seconds }
      return mmss(t + r.duration_seconds)
    }
    foerste.laktat = [{ mmol: laktatFor(s, dato, false), nar: nar(foerste) }]
    if (siste !== foerste) siste.laktat = [{ mmol: laktatFor(s, dato, true), nar: nar(siste) }]
  }
  const navn = `${drag} x ${dragMin} min ${s}${skyting ? ' m/ skyting' : ''}`
  return nyOkt(dato, navn, s === 'I3' ? 'threshold' : 'interval', rader, { rpe: s === 'I5' ? 9 : s === 'I4' ? 8 : 7 })
}

const STYRKEOVELSER = [
  { navn: 'Knebøy', kg: [90, 130] }, { navn: 'Markløft', kg: [110, 150] },
  { navn: 'Nedtrekk', kg: [55, 80] }, { navn: 'Sittende roing', kg: [55, 75] },
  { navn: 'Utfall', kg: [40, 60] }, { navn: 'Hoftehev', kg: [60, 90] },
]
function styrke(dato: string): Okt {
  sorterer = 0
  const sek = heltall(50, 70) * 60
  const valgte = [velg(STYRKEOVELSER), velg(STYRKEOVELSER), velg(STYRKEOVELSER), velg(STYRKEOVELSER)]
    .filter((v, i, a) => a.findIndex(x => x.navn === v.navn) === i)
  const a: Akt = {
    activity_type: 'aktivitet', movement_name: 'Styrke', sort_order: 0, duration_seconds: sek,
    avg_heart_rate: heltall(105, 125), max_hr: heltall(140, 158), zones: sone({ I1: sek }),
    ovelser: valgte.map(o => ({
      navn: o.navn,
      sett: Array.from({ length: heltall(3, 4) }, () => ({ reps: heltall(4, 8), kg: heltall(o.kg[0], o.kg[1]) })),
    })),
  }
  return nyOkt(dato, 'Styrke maks', 'strength', [a], { klokke: false, rpe: heltall(5, 7) })
}

function basistrening(dato: string): Okt {
  sorterer = 0
  const sek = heltall(25, 40) * 60
  return nyOkt(dato, 'Basistrening kjerne', 'technical', [{
    activity_type: 'annet', movement_name: 'Styrke', sort_order: 0, duration_seconds: sek,
    avg_heart_rate: heltall(95, 112), max_hr: heltall(125, 140), zones: sone({ I1: sek }),
  }], { klokke: false, rpe: heltall(3, 5) })
}

function basisskyting(dato: string, serier: number, daarlig: boolean): Okt {
  sorterer = 0
  const rader: Akt[] = []
  const oppv = heltall(10, 16) * 60
  rader.push(rad('oppvarming', LOPING, oppv, 'I1'))
  const puls = heltall(95, 118)
  for (let i = 0; i < serier; i++) {
    rader.push(skyterad('basisskyting', i % 2 === 0 ? 'L' : 'S', 1, puls + heltall(-5, 8), sjanse(0.25), daarlig))
  }
  const skudd = serier * 5
  return nyOkt(dato, `Basisskyting ${skudd} skudd`, 'basis_shooting', rader, { klokke: false, rpe: heltall(2, 4) })
}

function torrtrening(dato: string): Okt {
  sorterer = 0
  const sek = heltall(15, 30) * 60
  return nyOkt(dato, 'Tørrtrening', 'basis_shooting', [{
    activity_type: 'skyting_basis', movement_name: 'Skiskyting', sort_order: 0,
    duration_seconds: sek, shooting_type: 'torrtrening', is_dry_training: true,
    zones: sone({ I1: sek }), avg_heart_rate: heltall(70, 90),
  }], { klokke: false, rpe: 2 })
}

function konkurranse(dato: string, navn: string, form: Form, min: number, daarlig: boolean): Okt {
  sorterer = 0
  const rader: Akt[] = []
  const oppv = heltall(25, 35) * 60
  rader.push(rad('oppvarming', form, oppv, 'I1'))
  rader.push(skyterad('konkurranse', 'L', 1, heltall(120, 132), false, false))
  let klokke = oppv
  const runder = 4
  const rundeSek = Math.round(min * 60 / runder)
  for (let i = 0; i < runder; i++) {
    rader.push(rad('aktivitet', form, rundeSek, i === 0 ? 'I4' : 'I4', { notes: `Runde ${i + 1}`, rpe: 9 }))
    klokke += rundeSek
    if (i < runder - 1) {
      const sr = skyterad('konkurranse', i % 2 === 0 ? 'L' : 'S', 1, heltall(160, 178), sjanse(0.5), daarlig, { start: klokke, lengde: 55 })
      rader.push(sr); klokke += sr.duration_seconds
    }
  }
  rader.push(rad('nedjogg', form, heltall(12, 20) * 60, 'I1'))
  return nyOkt(dato, navn, 'competition', rader, { rpe: 10, viktig: true })
}

// ── Ukeplan ──────────────────────────────────────────────────
// Hovedform følger sesongen: rulleski dominerer, løping hele sommeren,
// sykling kun på langturer mai-august, SkiErg om høsten.
function hovedform(dato: string): Form {
  const m = dato.slice(0, 7)
  if (dato >= '2026-11-15') return LANGRENN(sjanse(0.7) ? 'Skøyting' : 'Klassisk')
  if (sjanse(0.5)) return RULLESKI(sjanse(0.7) ? 'Skøyting' : 'Klassisk')
  if (m >= '2026-09' && sjanse(0.2)) return SKIERG
  return LOPING
}

function ukeTimer(dato: string): number {
  const m = dato.slice(0, 7)
  const plan = MND_PLAN[m]?.timer ?? 70
  const uker = 4.35
  let t = plan / uker
  const ukeNr = Math.floor(mellomDager(HIST_FRA, dato) / 7)
  if (ukeNr % 4 === 3) t *= 0.7                       // nedtrappingsuke hver 4.
  if (iSamling(dato)) t *= 1.18                       // samling gir mer
  if (erSyk(dato)) t *= 0.25
  if (dato >= '2026-09-15' && dato <= '2026-09-21') t *= 0.65   // NM-nedtrapping
  return t
}

function byggDag(dato: string, ukeMin: number, brukt: { min: number }): Okt[] {
  const ut: Okt[] = []
  const dag = dagNr(dato)
  const daarligDag = sjanse(0.06)
  const konk = NOKKELDATOER.find(k => k.dato === dato && k.type.startsWith('competition'))
  const test = NOKKELDATOER.find(k => k.dato === dato && k.type === 'test')

  if (erSyk(dato)) {
    if (sjanse(0.4)) ut.push(rolig(dato, LOPING, heltall(30, 45), 'Rolig tur, kjenner meg dårlig'))
    return ut
  }
  if (konk) {
    ut.push(konkurranse(dato, konk.navn, RULLESKI('Skøyting'), heltall(22, 35), daarligDag))
    ut.push(rolig(dato, LOPING, heltall(35, 55), 'Rolig nedjogg etter løp'))
    return ut
  }
  const fastTest = TESTER.find(t => t.dato === dato)
  if (fastTest) {
    if (fastTest.type === 'standplass_10') {
      const o = basisskyting(dato, 2, false)
      o.tittel = fastTest.navn
      o.workout_type = 'test'
      o.akt.filter(a => a.serier?.length).forEach(a => { a.shooting_is_test = true; a.shooting_test_ref = 'nssf1' })
      o.test = { type: fastTest.type, resultat: fastTest.resultat, enhet: fastTest.enhet }
      ut.push(o)
      return ut
    }
    const form = fastTest.sub === 'Løping' ? LOPING : RULLESKI('Skøyting')
    const o = intervall(dato, form, fastTest.laktattrapp ? 6 : 3, fastTest.laktattrapp ? 5 : 4, 'I4', null, false)
    o.tittel = fastTest.navn
    o.workout_type = 'test'
    o.test = { type: fastTest.type, resultat: fastTest.resultat, enhet: fastTest.enhet }
    if (fastTest.laktattrapp) {
      const trapp = [1.1, 1.6, 2.2, 3.1, 4.4, 6.8]
      const dragR = o.akt.filter(a => a.activity_type === 'aktivitet' && a.notes?.startsWith('Drag'))
      let t = 0
      for (const r of o.akt) {
        t += r.duration_seconds
        const j = dragR.indexOf(r)
        if (j >= 0) r.laktat = [{ mmol: Math.round(trapp[Math.min(j, trapp.length - 1)] * formfaktor(dato) * 10) / 10, nar: mmss(t) }]
      }
    }
    ut.push(o)
    return ut
  }
  if (test) {
    ut.push(intervall(dato, RULLESKI('Skøyting'), 6, 5, 'I4', null, false))
    ut[0].tittel = 'Terskeltest laktat rulleski'
    ut[0].workout_type = 'test'
    ut[0].test = { type: 'lt2', resultat: heltall(21, 24), enhet: 'km/t', navn: 'Terskeltest rulleski' }
    const trapp = [1.1, 1.6, 2.2, 3.1, 4.4, 6.8]
    const dragR = ut[0].akt.filter(a => a.activity_type === 'aktivitet' && a.notes?.startsWith('Drag'))
    let t = 0
    for (const r of ut[0].akt) {
      t += r.duration_seconds
      const j = dragR.indexOf(r)
      if (j >= 0) r.laktat = [{ mmol: Math.round(trapp[Math.min(j, trapp.length - 1)] * formfaktor(dato) * 10) / 10, nar: mmss(t) }]
    }
    return ut
  }

  // Dagsmålet styres av ukemålet, ikke av faste tak. En 20-timers uke er
  // ca. 200 min per dag fordelt på seks treningsdager, ofte som to økter.
  const hviledag = dag === 0 && sjanse(0.5)
  if (hviledag) return ut
  const treningsdager = 6.5
  const dagMaal = Math.round(ukeMin / treningsdager)
  let igjen = dagMaal

  switch (dag) {
    case 2: {  // tirsdag: hard intervall med skyting
      const s = sjanse(0.18) ? 'I5' : 'I4'
      const drag = s === 'I5' ? heltall(10, 14) : heltall(6, 9)
      const lengde = s === 'I5' ? mellom(0.5, 1) : mellom(5, 8)
      const komb = dato >= '2026-08-16' ? 'hard_komb' : sjanse(0.55) ? 'rolig_komb' : null
      const o = intervall(dato, RULLESKI('Skøyting'), drag, Math.round(lengde * 10) / 10, s as 'I4' | 'I5', komb, daarligDag)
      ut.push(o); igjen -= Math.round(o.akt.reduce((a, b) => a + b.duration_seconds, 0) / 60)
      break
    }
    case 4: {  // torsdag: terskel I3 med skyting
      const komb = dato >= '2026-08-01' ? (sjanse(0.6) ? 'hard_komb' : 'rolig_komb') : 'rolig_komb'
      const o = intervall(dato, sjanse(0.55) ? RULLESKI('Klassisk') : LOPING, heltall(5, 7), heltall(12, 16), 'I3', komb, daarligDag)
      ut.push(o); igjen -= Math.round(o.akt.reduce((a, b) => a + b.duration_seconds, 0) / 60)
      break
    }
    case 6: {  // lørdag: langtur
      const sommer = dato <= '2026-08-31'
      const form = sommer && sjanse(0.22) ? SYKKEL : hovedform(dato)
      const min = Math.max(150, Math.min(280, Math.round(dagMaal * 1.35)))
      const o = langtur(dato, form, min, form.movement_name !== 'Sykling')
      ut.push(o); igjen -= min
      break
    }
    case 3: {  // onsdag: annenhver uke en kortere terskeløkt til
      const uke = Math.floor(mellomDager(HIST_FRA, dato) / 7)
      if (uke % 2 === 0) {
        const o = intervall(dato, hovedform(dato), heltall(4, 5), heltall(8, 10), 'I3', sjanse(0.5) ? 'rolig_komb' : null, daarligDag)
        ut.push(o); igjen -= Math.round(o.akt.reduce((a, b) => a + b.duration_seconds, 0) / 60)
      } else {
        const min = Math.max(55, Math.min(150, Math.round(igjen * 0.62)))
        const o = rolig(dato, hovedform(dato), min)
        ut.push(o); igjen -= min
      }
      break
    }
    default: {
      const min = Math.max(55, Math.min(150, Math.round(igjen * 0.62)))
      const o = rolig(dato, hovedform(dato), min)
      ut.push(o); igjen -= min
    }
  }

  // Skyting, styrke og basis bygges FØR påfyllet og teller mot dagsmålet -
  // ellers sprekker ukevolumet med en time hver dag.
  const ekstra: Okt[] = []
  if (dag === 1 || dag === 4 || (dag === 5 && sjanse(0.7))) ekstra.push(basisskyting(dato, heltall(6, 9), daarligDag))
  else if (sjanse(0.18)) ekstra.push(basisskyting(dato, heltall(4, 7), daarligDag))
  if (dag === 3 || (dag === 5 && sjanse(0.6))) ekstra.push(styrke(dato))
  if (dag === 0 || (dag === 5 && sjanse(0.5))) ekstra.push(basistrening(dato))
  if (sjanse(0.38) && !ekstra.some(o => o.workout_type === 'basis_shooting')) ekstra.push(torrtrening(dato))
  for (const e of ekstra) igjen -= Math.round(e.akt.reduce((a, b) => a + b.duration_seconds, 0) / 60)

  // Økt nummer to samme dag: rolig påfyll når dagsmålet ikke er nådd.
  if (igjen >= 45) {
    const min = Math.max(45, Math.min(110, igjen))
    const o = rolig(dato, sjanse(0.5) ? LOPING : hovedform(dato), min, `Rolig ${sjanse(0.5) ? 'morgen' : 'kveld'}søkt`)
    o.tid = velg(['06:45', '07:15', '19:30', '20:00'])
    ut.push(o); igjen -= min
  }
  ut.push(...ekstra)
  return ut
}

// ── Genererer hele perioden ──────────────────────────────────
const alleOkter: Okt[] = []
{
  let brukt = { min: 0 }
  let ukeStart = ''
  for (const dato of datoer(HIST_FRA, PLAN_TIL)) {
    if (dagNr(dato) === 1 || ukeStart === '') { ukeStart = dato; brukt = { min: 0 } }
    const ukeMin = Math.round(ukeTimer(dato) * 60)
    const okter = byggDag(dato, ukeMin, brukt)
    for (const o of okter) {
      const min = Math.round(o.akt.reduce((s, a) => s + a.duration_seconds, 0) / 60)
      brukt.min += min
      // Plan mot faktisk: historikken avviker fra planen på en realistisk måte.
      if (!o.planlagt) {
        const r = rnd()
        let f = 1
        if (r > 0.85 && r <= 0.95) f = mellom(0.7, 0.9)        // ~10 % kortere
        else if (r > 0.95) f = mellom(1.08, 1.25)              // ~5 % lengre
        o.planMin = Math.round(min / f)
        o.planKm = null
      }
      alleOkter.push(o)
    }
  }
}

// ── Helse avledet av belastningen ────────────────────────────
// HRV genereres FRA belastningen, ikke uavhengig av den: den faller 1-3 dager
// etter harde dager, stiger i nedtrapping, og har en langsom grunnlinje oppover
// gjennom sesongen. Korrelasjonen mot ukebelastningen sjekkes til slutt.
type Helse = { date: string; resting_hr: number; hrv_ms: number; sheet?: number; sleep_hours: number; sleep_quality: number; body_weight_kg: number; day_form: number }

function belastningPerDag(): Map<string, number> {
  const m = new Map<string, number>()
  for (const o of alleOkter) {
    if (o.planlagt) continue
    let b = 0
    for (const a of o.akt) {
      const z = a.zones ?? {}
      b += (z.I1 ?? 0) * 1 + (z.I2 ?? 0) * 1.4 + (z.I3 ?? 0) * 2.4 + (z.I4 ?? 0) * 3.6 + (z.I5 ?? 0) * 5 + (z.Hurtighet ?? 0) * 2
    }
    m.set(o.dato, (m.get(o.dato) ?? 0) + b / 3600)
  }
  return m
}

const helse: Helse[] = []
{
  const bel = belastningPerDag()
  const dagerListe = [...datoer(HIST_FRA, HIST_TIL)]
  // Grunnlinje: 70 i mai -> 86 i september
  const grunnlinje = (dato: string) => 74 + (mellomDager(HIST_FRA, dato) / mellomDager(HIST_FRA, HIST_TIL)) * 10
  // FORRIGE UKES samlede belastning er den tunge termen. Uten den blir
  // korrelasjonen ukebelastning -> HRV positiv, fordi grunnlinja stiger
  // gjennom sesongen og drukner dag-til-dag-effekten.
  const ukeNr = (dato: string) => Math.floor(mellomDager(HIST_FRA, dato) / 7)
  const ukeBel = new Map<number, number>()
  for (const [dato, b] of bel) ukeBel.set(ukeNr(dato), (ukeBel.get(ukeNr(dato)) ?? 0) + b)
  const snittUke = [...ukeBel.values()].reduce((s2, v) => s2 + v, 0) / Math.max(1, ukeBel.size)
  const forrigeUke = (dato: string) => (ukeBel.get(ukeNr(dato) - 1) ?? snittUke) - snittUke
  let vekt = 74.2
  for (const dato of dagerListe) {
    const i = dagerListe.indexOf(dato)
    // Etterslep: belastningen de tre foregående dagene trykker HRV ned.
    const trykk = (bel.get(plussDager(dato, -1)) ?? 0) * 1.6
      + (bel.get(plussDager(dato, -2)) ?? 0) * 1.1
      + (bel.get(plussDager(dato, -3)) ?? 0) * 0.6
    let hrv = grunnlinje(dato) - trykk * 1.2 - forrigeUke(dato) * 10.0 + mellom(-3, 3)

    const s = iSamling(dato)
    if (s) {
      const dagIS = mellomDager(s.fra, dato)
      if (dagIS >= 2 && dagIS <= 4) hrv -= mellom(12, 15)
      else if (dagIS > 4) hrv -= mellom(4, 8)
      if (s.hoyde) hrv -= mellom(3, 7)
    }
    if (erSyk(dato)) hrv = mellom(45, 55)
    const etterSyk = mellomDager(SYK_TIL, dato)
    if (etterSyk > 0 && etterSyk <= 10) hrv = Math.min(hrv, 55 + etterSyk * 2.2 + mellom(-3, 3))

    // Formtopp 1: nedtrappingsuka 03.-09. august. Blandes inn (0,65) i stedet
    // for å overstyre, så belastningssignalet fortsatt er der.
    if (dato >= '2026-08-03' && dato <= '2026-08-09') hrv = hrv * 0.28 + mellom(94, 103) * 0.72
    // Formtopp 2: 01.-09. september, stigende
    if (dato >= '2026-09-01' && dato <= '2026-09-09') {
      const k = mellomDager('2026-09-01', dato) / 8
      hrv = hrv * 0.28 + (84 + k * 16 + mellom(-3, 3)) * 0.72
      if (dato === '2026-09-07' || dato === '2026-09-08') hrv -= mellom(6, 10)  // konkurransedupp
    }
    hrv = Math.max(42, Math.min(104, hrv))

    // Hvilepuls beveger seg motsatt vei av HRV
    let hvile = Math.round(52 - (hrv - 45) * 0.24 + mellom(-1, 1))
    if (erSyk(dato)) hvile = heltall(50, 53)
    hvile = Math.max(37, Math.min(54, hvile))

    // Søvn og dagsform følger HRV
    const norm = (hrv - 45) / 57
    let sovn = 6.6 + norm * 2.0 + mellom(-0.3, 0.3)
    if (erSyk(dato)) sovn = mellom(5.5, 7)
    const kval = Math.max(1, Math.min(5, Math.round(1 + norm * 4 + mellom(-0.4, 0.4))))
    const form = erSyk(dato) ? heltall(1, 2) : Math.max(1, Math.min(5, Math.round(1 + norm * 4 + mellom(-0.5, 0.5))))

    // Vekt: jevn nedgang 74,2 -> 72,4, aldri mer enn 0,4 kg per dag
    const maal = 74.2 - (i / (dagerListe.length - 1)) * 1.8
    vekt = Math.max(maal - 0.35, Math.min(maal + 0.35, vekt + mellom(-0.25, 0.22)))

    helse.push({
      date: dato, resting_hr: hvile, hrv_ms: Math.round(hrv),
      sleep_hours: Math.round(Math.max(5.2, Math.min(9.2, sovn)) * 10) / 10,
      sleep_quality: kval, body_weight_kg: Math.round(vekt * 10) / 10, day_form: form,
    })
  }
}

// ── Utstyr ───────────────────────────────────────────────────
type Utstyr = {
  navn: string; category: string; brand: string; model?: string; subtype?: string | null
  start_km?: number | null; wheel_type?: string | null; resistance?: number | null
  length_cm?: number | null; usage_type?: string | null; purchase_date?: string
  ski?: { ski_type: string; length_cm: number; camber: string; current_slip: string; current_wax: string; usage_type: string }
  slip?: { grind: string; dato: string; av: string }[]
}
const UTSTYR: Utstyr[] = [
  { navn: 'Rossignol X-ium S3 konkurranse', category: 'ski', brand: 'Rossignol', model: 'X-ium S3', purchase_date: '2025-10-12',
    ski: { ski_type: 'skoyting', length_cm: 192, camber: 'medium', current_slip: 'C2-14', current_wax: 'HF blå', usage_type: 'konkurranse' },
    slip: [{ grind: 'C2-14', dato: '2026-04-20', av: 'Team Fastwax' }, { grind: 'SL2', dato: '2025-11-02', av: 'Team Fastwax' }] },
  { navn: 'Rossignol X-ium S2 kald', category: 'ski', brand: 'Rossignol', model: 'X-ium S2', purchase_date: '2025-10-12',
    ski: { ski_type: 'skoyting', length_cm: 192, camber: 'hard', current_slip: 'P5-1', current_wax: 'HF grønn', usage_type: 'konkurranse' },
    slip: [{ grind: 'P5-1', dato: '2026-03-14', av: 'Team Fastwax' }, { grind: 'C2-14', dato: '2025-10-30', av: 'Skiservice Lygna' }] },
  { navn: 'Rossignol X-ium trening skøyt', category: 'ski', brand: 'Rossignol', model: 'X-ium WCS', purchase_date: '2024-11-08',
    ski: { ski_type: 'skoyting', length_cm: 190, camber: 'myk', current_slip: 'SL2', current_wax: 'LF fiolett', usage_type: 'trening' },
    slip: [{ grind: 'SL2', dato: '2025-12-01', av: 'Skiservice Lygna' }] },
  { navn: 'Rossignol X-ium klassisk konkurranse', category: 'ski', brand: 'Rossignol', model: 'X-ium Classic', purchase_date: '2025-10-12',
    ski: { ski_type: 'klassisk', length_cm: 207, camber: 'medium', current_slip: 'C1-12', current_wax: 'VR45', usage_type: 'konkurranse' },
    slip: [{ grind: 'C1-12', dato: '2026-04-20', av: 'Team Fastwax' }, { grind: 'M2', dato: '2025-11-02', av: 'Team Fastwax' }] },
  { navn: 'Rossignol X-ium klassisk trening', category: 'ski', brand: 'Rossignol', model: 'X-ium Classic R-Skin', purchase_date: '2024-11-08',
    ski: { ski_type: 'klassisk', length_cm: 205, camber: 'myk', current_slip: 'M2', current_wax: 'Skin', usage_type: 'trening' },
    slip: [{ grind: 'M2', dato: '2025-11-20', av: 'Skiservice Lygna' }] },
  { navn: 'Swenor Skate Elite', category: 'rulleski', brand: 'Swenor', model: 'Skate Elite', subtype: 'Skøyting', start_km: 1240, wheel_type: 'gummi', resistance: 2, purchase_date: '2025-04-02' },
  { navn: 'Swenor Skate Long Run', category: 'rulleski', brand: 'Swenor', model: 'Skate LR', subtype: 'Skøyting', start_km: 2100, wheel_type: 'gummi', resistance: 3, purchase_date: '2024-05-14' },
  { navn: 'Swenor Fibreglass klassisk', category: 'rulleski', brand: 'Swenor', model: 'Fibreglass', subtype: 'Klassisk', start_km: 1680, wheel_type: 'gummi', resistance: 2, purchase_date: '2024-05-14' },
  { navn: 'Marwe 620XC klassisk', category: 'rulleski', brand: 'Marwe', model: '620XC', subtype: 'Klassisk', start_km: 430, wheel_type: 'gummi', resistance: 1, purchase_date: '2026-04-28' },
  { navn: 'Nike Vaporfly 3', category: 'lopesko', brand: 'Nike', model: 'Vaporfly 3', start_km: 210, purchase_date: '2026-03-02' },
  { navn: 'Nike Pegasus 41', category: 'lopesko', brand: 'Nike', model: 'Pegasus 41', start_km: 640, purchase_date: '2025-09-15' },
  { navn: 'Hoka Speedgoat 6', category: 'lopesko', brand: 'Hoka', model: 'Speedgoat 6', start_km: 380, purchase_date: '2025-11-20' },
  { navn: 'Hoka Clifton 10', category: 'lopesko', brand: 'Hoka', model: 'Clifton 10', start_km: 820, purchase_date: '2025-06-01' },
  { navn: 'Swix Triac 4.0 skøyt', category: 'skistaver', brand: 'Swix', model: 'Triac 4.0', length_cm: 157, purchase_date: '2025-10-01' },
  { navn: 'Swix Triac 4.0 klassisk', category: 'skistaver', brand: 'Swix', model: 'Triac 4.0', length_cm: 147, purchase_date: '2025-10-01' },
  { navn: 'Garmin Fenix 8', category: 'klokke', brand: 'Garmin', model: 'Fenix 8', purchase_date: '2026-01-10' },
  { navn: 'Trek Domane SL6', category: 'sykkel', brand: 'Trek', model: 'Domane SL6', start_km: 3400, purchase_date: '2024-06-20' },
]

// ── Skriving ─────────────────────────────────────────────────
const maa = <T,>(r: { data: T; error: unknown }, hva: string): T => {
  if (r.error) throw new Error(`${hva}: ${(r.error as { message: string }).message}`)
  return r.data
}
const tell = async (t: string, k = 'user_id') =>
  (await admin.from(t).select('id', { count: 'exact', head: true }).eq(k, USER)).count ?? 0

async function tellAlt(): Promise<Record<string, number>> {
  const ut: Record<string, number> = {}
  for (const t of ['workouts', 'seasons', 'equipment', 'daily_health', 'ski_tests', 'imported_activities', 'workout_samples', 'personal_records', 'workout_test_data', 'monthly_volume_plans']) {
    ut[t] = await tell(t)
  }
  const { data: w } = await admin.from('workouts').select('id').eq('user_id', USER).limit(2000)
  const ider = (w ?? []).map(x => x.id)
  let akt = 0, serier = 0
  for (let i = 0; i < ider.length; i += 200) {
    const del = ider.slice(i, i + 200)
    const { count: ac } = await admin.from('workout_activities').select('id', { count: 'exact', head: true }).in('workout_id', del)
    akt += ac ?? 0
    const { data: a } = await admin.from('workout_activities').select('id').in('workout_id', del).limit(1000)
    if (a?.length) {
      for (let j = 0; j < a.length; j += 200) {
        const { count } = await admin.from('workout_shooting_series').select('id', { count: 'exact', head: true }).in('activity_id', a.slice(j, j + 200).map(x => x.id))
        serier += count ?? 0
      }
    }
  }
  ut.workout_activities = akt
  ut.workout_shooting_series = serier
  return ut
}

async function slettAlt() {
  const { data: w } = await admin.from('workouts').select('id').eq('user_id', USER).limit(3000)
  const ider = (w ?? []).map(x => x.id)
  for (let i = 0; i < ider.length; i += 100) {
    const del = ider.slice(i, i + 100)
    await admin.from('imported_activities').delete().in('workout_id', del)
    await admin.from('workout_samples').delete().in('workout_id', del)
    await admin.from('workout_equipment').delete().in('workout_id', del)
    await admin.from('workout_test_data').delete().in('workout_id', del)
    await admin.from('ski_tests').delete().in('workout_id', del)
    await admin.from('workouts').delete().in('id', del)   // aktiviteter kaskaderer
  }
  await admin.from('imported_activities').delete().eq('user_id', USER)
  await admin.from('workout_samples').delete().eq('user_id', USER)
  await admin.from('personal_records').delete().eq('user_id', USER)
  await admin.from('workout_test_data').delete().eq('user_id', USER)
  await admin.from('daily_health').delete().eq('user_id', USER)
  await admin.from('monthly_volume_plans').delete().eq('user_id', USER)
  const { data: st } = await admin.from('ski_tests').select('id').eq('user_id', USER)
  for (const t of st ?? []) await admin.from('ski_test_entries').delete().eq('test_id', t.id)
  await admin.from('ski_tests').delete().eq('user_id', USER)
  await admin.from('equipment').delete().eq('user_id', USER)   // ski_data/grinds kaskaderer
  const { data: s } = await admin.from('seasons').select('id').eq('user_id', USER)
  for (const x of s ?? []) {
    await admin.from('season_markings').delete().eq('season_id', x.id)
    await admin.from('season_key_dates').delete().eq('season_id', x.id)
    await admin.from('season_periods').delete().eq('season_id', x.id)
  }
  await admin.from('seasons').delete().eq('user_id', USER)
  const { data: lenke } = await admin.from('stridee_link').select('id').eq('user_id', USER)
  for (const x of lenke ?? []) await admin.from('stridee_connections').delete().eq('link_id', x.id)
  await admin.from('stridee_link').delete().eq('user_id', USER)
}

async function seed() {
  console.log('FØR:', JSON.stringify(await tellAlt()))
  await slettAlt()
  console.log('ETTER SLETTING:', JSON.stringify(await tellAlt()))

  // ── Sesong ──
  const sesong = maa(await admin.from('seasons').insert({
    user_id: USER, name: '2026/27', start_date: '2026-05-01', end_date: '2027-04-30',
    goal_main: 'Topp 6 sammenlagt Norgescup og uttak til IBU Cup',
    goal_details: 'Treff liggende 90 %, stående 82 %, 900 timer',
    kpi_notes: '8 500 skudd, VO2max over 78, terskelfart rulleski +3 %',
    annual_shot_goal: 8500,
  }).select('id').single(), 'sesong') as { id: string }

  maa(await admin.from('season_periods').insert(PERIODER.map((p, i) => ({
    season_id: sesong.id, name: p.navn, focus: p.fokus, start_date: p.fra, end_date: p.til,
    intensity: p.intensity, sort_order: i,
  })).map(x => x)).select('id'), 'perioder')

  maa(await admin.from('season_markings').insert(SAMLINGER.map(s => ({
    season_id: sesong.id, name: s.navn, location: s.sted, start_date: s.fra, end_date: s.til,
    is_training_camp: true, is_altitude: s.hoyde != null, altitude_meters: s.hoyde,
  }))).select('id'), 'samlinger')

  maa(await admin.from('season_key_dates').insert(NOKKELDATOER.map(k => ({
    season_id: sesong.id, event_type: k.type, event_date: k.dato, name: k.navn,
    sport: 'biathlon', location: k.sted, notes: k.notat,
    is_peak_target: (k as { topp?: boolean }).topp === true,
  }))).select('id'), 'nøkkeldatoer')

  maa(await admin.from('monthly_volume_plans').insert(Object.entries(MND_PLAN).map(([m, v]) => ({
    user_id: USER, season_id: sesong.id, year: Number(m.slice(0, 4)), month: Number(m.slice(5, 7)),
    planned_hours: v.timer, planned_shots: v.skudd,
  }))).select('id'), 'månedsplaner')

  // ── Utstyr ──
  const utstyrId = new Map<string, string>()
  for (const u of UTSTYR) {
    const rad = maa(await admin.from('equipment').insert({
      user_id: USER, name: u.navn, category: u.category, brand: u.brand, model: u.model ?? null,
      sport: 'biathlon', subtype: u.subtype ?? null, start_km: u.start_km ?? 0,
      wheel_type: u.wheel_type ?? null, resistance: u.resistance ?? null,
      length_cm: u.length_cm ?? null, purchase_date: u.purchase_date ?? null, status: 'active',
    }).select('id').single(), `utstyr ${u.navn}`) as { id: string }
    utstyrId.set(u.navn, rad.id)
    if (u.ski) {
      maa(await admin.from('equipment_ski_data').insert({
        equipment_id: rad.id, ski_type: u.ski.ski_type, length_cm: u.ski.length_cm,
        camber: u.ski.camber, current_slip: u.ski.current_slip, current_wax: u.ski.current_wax,
        usage_type: u.ski.usage_type, slip_date: u.slip?.[0]?.dato ?? null, slip_by: u.slip?.[0]?.av ?? null,
      }).select('equipment_id'), 'ski-data')
    }
    if (u.slip) {
      maa(await admin.from('equipment_grinds').insert(u.slip.map(g => ({
        equipment_id: rad.id, grind: g.grind, grind_date: g.dato, ground_by: g.av,
      }))).select('id'), 'slip')
    }
  }
  return { sesong, utstyrId }
}

// ── Øktene inn i basen ───────────────────────────────────────
function velgUtstyr(o: Okt): string[] {
  const ut: string[] = []
  const former = new Set(o.akt.map(a => a.movement_name))
  if (former.has('Rulleski')) {
    const klassisk = o.akt.some(a => a.movement_subcategory === 'Klassisk')
    ut.push(klassisk ? velg(['Swenor Fibreglass klassisk', 'Marwe 620XC klassisk']) : velg(['Swenor Skate Elite', 'Swenor Skate Long Run']))
    ut.push(klassisk ? 'Swix Triac 4.0 klassisk' : 'Swix Triac 4.0 skøyt')
  }
  if (former.has('Løping')) ut.push(velg(['Nike Pegasus 41', 'Hoka Clifton 10', 'Hoka Speedgoat 6', 'Nike Vaporfly 3']))
  if (former.has('Sykling')) ut.push('Trek Domane SL6')
  if (former.has('Langrenn')) ut.push(velg(['Rossignol X-ium S3 konkurranse', 'Rossignol X-ium trening skøyt', 'Rossignol X-ium klassisk trening']))
  if (o.klokke) ut.push('Garmin Fenix 8')
  return ut
}

// Pulskurven er ÉN kilde: samples, seriepuls og rapporten leser den samme
// kurven. Standplass er det som avslører syntetiske data - pulsen skal falle
// 20-35 slag gjennom serien, lavest mot siste skudd, og bruke 30-60 s på å
// komme opp igjen etterpå. Fallet er større når utøveren er sliten (sent i
// økta) og litt større liggende enn stående.
type Kurve = {
  samples: { t: number; val: number }[]
  start: number[]                       // starttid per aktivitetsrad
  standplass: { i: number; inn: number; lav: number; etter60: number | null; avg: number; maks: number }[]
}
function byggKurve(o: Okt): Kurve {
  const start: number[] = []
  let t = 0
  for (const a of o.akt) { start.push(t); t += a.duration_seconds }
  const totalt = t
  const samples: { t: number; val: number }[] = []
  const standplass: Kurve['standplass'] = []
  let forrige = o.akt[0]?.avg_heart_rate ?? 120

  o.akt.forEach((a, i) => {
    const erSkyting = a.activity_type.startsWith('skyting_') && !a.is_dry_training
    const maal = a.avg_heart_rate ?? 120
    const fra = start[i]
    if (erSkyting) {
      const sliten = fra / Math.max(1, totalt)                 // 0 tidlig, 1 sent
      const ligg = a.activity_type === 'skyting_liggende'
      const fall = (20 + sliten * 15 + (ligg ? 4 : 0)) * mellom(0.9, 1.1)
      const inn = forrige
      let lav = inn
      for (let x = 0; x < a.duration_seconds; x += 10) {
        const k = x / Math.max(10, a.duration_seconds)
        const v = Math.round(inn - fall * Math.min(1, k * 1.15) + mellom(-2, 2))
        lav = Math.min(lav, v)
        samples.push({ t: fra + x, val: Math.max(70, v) })
      }
      const vindu = samples.filter(p => p.t >= fra && p.t < fra + a.duration_seconds)
      standplass.push({
        i, inn, lav, etter60: null,
        avg: Math.round(vindu.reduce((s2, p) => s2 + p.val, 0) / Math.max(1, vindu.length)),
        maks: Math.max(...vindu.map(p => p.val)),
      })
      forrige = lav
    } else {
      const rampe = standplass.length && standplass[standplass.length - 1].i === i - 1 ? heltall(30, 60) : 0
      for (let x = 0; x < a.duration_seconds; x += 10) {
        const v = rampe && x < rampe
          ? forrige + (maal - forrige) * (x / rampe)
          : maal
        samples.push({ t: fra + x, val: Math.max(70, Math.round(v + mellom(-4, 4))) })
      }
      forrige = maal
    }
  })
  // Puls 60 s etter at utøveren gikk ut av standplass
  for (const sp of standplass) {
    const slutt = start[sp.i] + o.akt[sp.i].duration_seconds
    const p = samples.find(x => x.t >= slutt + 60)
    sp.etter60 = p?.val ?? null
  }
  return { samples, start, standplass }
}

function lagSamples(o: Okt, kurve: Kurve): { t: number; val: number }[] | null {
  const totalt = o.akt.reduce((s, a) => s + a.duration_seconds, 0)
  if (!o.klokke || totalt < 45 * 60) return null
  return kurve.samples
}

async function skrivOkter(utstyrId: Map<string, string>) {
  let nr = 0
  for (const o of alleOkter) {
    nr++
    const totSek = o.akt.reduce((s, a) => s + a.duration_seconds, 0)
    const totKm = o.akt.reduce((s, a) => s + (a.distance_meters ?? 0), 0) / 1000
    const totHoyde = o.akt.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)
    const pulsRader = o.akt.filter(a => a.avg_heart_rate && (a.zones || a.activity_type !== 'pause'))
    const snittPuls = pulsRader.length
      ? Math.round(pulsRader.reduce((s, a) => s + (a.avg_heart_rate ?? 0) * a.duration_seconds, 0) / pulsRader.reduce((s, a) => s + a.duration_seconds, 0))
      : null
    const maksPuls = Math.max(0, ...o.akt.map(a => a.max_hr ?? 0)) || null
    const samlet = tomSone()
    for (const a of o.akt) for (const [k, v] of Object.entries(a.zones ?? {})) samlet[k] = (samlet[k] ?? 0) + v

    const kurve = byggKurve(o)
    // Skytingen plasseres i TID med window_start_seconds/-duration (phase113),
    // eksakt der raden ligger i tidslinja. Radene flislegges også fra
    // duration_seconds i sort_order (alle har lap-proveniens), så de to er
    // enige - vinduet er satt eksplisitt fordi øktgrafen leser det.
    o.akt.forEach((a, i) => {
      if (a.activity_type.startsWith('skyting_') && !a.is_dry_training) {
        a.window_start_seconds = kurve.start[i]
        a.window_duration_seconds = a.duration_seconds
      }
    })
    // Seriepulsen SKAL stemme med kurven i samme vindu, ikke settes uavhengig.
    for (const sp of kurve.standplass) {
      const serier = o.akt[sp.i].serier ?? []
      for (const se of serier) { se.avg_heart_rate = sp.avg; se.max_heart_rate = sp.maks }
      o.akt[sp.i].avg_heart_rate = sp.avg
      o.akt[sp.i].max_hr = sp.maks
    }
    const eksternId = o.klokke ? `demo_${o.dato.replace(/-/g, '')}_${nr}` : null
    const w = maa(await admin.from('workouts').insert({
      user_id: USER, title: o.tittel, sport: 'biathlon', date: o.dato, time_of_day: o.tid,
      workout_type: o.workout_type,
      is_planned: o.planlagt, is_completed: !o.planlagt,
      duration_minutes: Math.round(totSek / 60),
      distance_km: totKm > 0 ? Math.round(totKm * 100) / 100 : null,
      elevation_meters: totHoyde > 0 ? totHoyde : null,
      avg_heart_rate: snittPuls, max_heart_rate: maksPuls,
      rpe: o.planlagt ? null : o.rpe ?? null,
      notes: o.notat ?? null,
      is_important: o.viktig ?? false,
      is_altitude_training: o.hoyde != null, altitude_meters: o.hoyde ?? null,
      imported_from: o.klokke && !o.planlagt ? 'fit_garmin' : null,
      planned_minutes: o.planMin ?? null, planned_km: o.planKm ?? null,
      planned_zones: o.planlagt ? samlet : null,
      actual_minutes: o.planlagt ? null : Math.round(totSek / 60),
      actual_km: o.planlagt ? null : (totKm > 0 ? Math.round(totKm * 100) / 100 : null),
      actual_zones: o.planlagt ? null : samlet,
      completed_at: o.planlagt ? null : `${o.dato}T${o.tid}:00+02:00`,
    }).select('id').single(), `økt ${o.dato}`) as { id: string }

    const rader = o.akt.map((a, i) => {
      const agg = a.serier?.length ? seriesToLegacyAggregates(a.serier.map(s => ({ position: s.position, shots: s.shots, hits: s.hits }))) : null
      return {
        workout_id: w.id, activity_type: a.activity_type, movement_name: a.movement_name,
        movement_subcategory: a.movement_subcategory ?? null, sort_order: i,
        duration_seconds: a.duration_seconds, distance_meters: a.distance_meters ?? null,
        avg_heart_rate: a.avg_heart_rate ?? null, max_heart_rate: a.max_hr ?? null, max_hr: a.max_hr ?? null,
        zones: a.zones ?? null, elevation_gain_m: a.elevation_gain_m ?? null,
        avg_watts: a.avg_watts ?? null, resistance_level: a.resistance_level ?? null,
        incline_percent: a.incline_percent ?? null, rpe: a.rpe ?? null, notes: a.notes ?? null,
        shooting_type: a.shooting_type ?? null, shooting_is_test: a.shooting_is_test ?? false,
        shooting_surface: a.shooting_surface ?? null, shooting_test_ref: a.shooting_test_ref ?? null,
        window_start_seconds: a.window_start_seconds ?? null, window_duration_seconds: a.window_duration_seconds ?? null,
        is_dry_training: a.is_dry_training ?? false,
        external_id: eksternId ? `${eksternId}_lap${i}` : null,
        strava_lap_index: eksternId ? i : null,
        ...(agg ?? {}),
      }
    })
    const lagdeAkt = maa(await admin.from('workout_activities').insert(rader).select('id, sort_order'), 'aktiviteter') as { id: string; sort_order: number }[]
    const idPerSort = new Map(lagdeAkt.map(x => [x.sort_order, x.id]))

    const serieRader: Record<string, unknown>[] = []
    const ovelseRader: { activity_id: string; exercise_name: string; sort_order: number; sett: { reps: number; kg: number | null }[] }[] = []
    const laktatRader: Record<string, unknown>[] = []
    o.akt.forEach((a, i) => {
      const aid = idPerSort.get(i)!
      for (const s of a.serier ?? []) serieRader.push({
        activity_id: aid, series_no: s.series_no, position: s.position, shots: s.shots, hits: s.hits,
        time_seconds: s.time_seconds, avg_heart_rate: s.avg_heart_rate, max_heart_rate: s.max_heart_rate,
        shot_plot: s.shot_plot, vind_retning: s.vind_retning ?? null, vind_styrke: s.vind_styrke ?? null, sikt: s.sikt ?? null,
      })
      for (const [j, ov] of (a.ovelser ?? []).entries()) ovelseRader.push({ activity_id: aid, exercise_name: ov.navn, sort_order: j, sett: ov.sett })
      for (const [j, l] of (a.laktat ?? []).entries()) laktatRader.push({ activity_id: aid, value_mmol: l.mmol, measured_at: l.nar, sort_order: j })
    })
    if (serieRader.length) maa(await admin.from('workout_shooting_series').insert(serieRader).select('id'), 'serier')
    if (laktatRader.length) maa(await admin.from('workout_activity_lactate_measurements').insert(laktatRader).select('id'), 'laktat')
    for (const ov of ovelseRader) {
      const e = maa(await admin.from('workout_activity_exercises').insert({ activity_id: ov.activity_id, exercise_name: ov.exercise_name, sort_order: ov.sort_order }).select('id').single(), 'øvelse') as { id: string }
      maa(await admin.from('workout_activity_exercise_sets').insert(ov.sett.map((s, k) => ({
        exercise_id: e.id, set_number: k + 1, reps: s.reps, weight_kg: s.kg,
      }))).select('id'), 'sett')
    }

    // Klokkesynk-proveniens
    if (eksternId && !o.planlagt) {
      maa(await admin.from('imported_activities').insert({
        user_id: USER, source: 'stridee', external_id: eksternId, workout_id: w.id,
      }).select('id'), 'import')
      const s = lagSamples(o, kurve)
      if (s) maa(await admin.from('workout_samples').insert({
        workout_id: w.id, user_id: USER, hr_samples: s, source: 'fit',
      }).select('id'), 'samples')
    }
    // Utstyr
    const u = velgUtstyr(o).map(n => utstyrId.get(n)).filter(Boolean) as string[]
    if (u.length) maa(await admin.from('workout_equipment').insert(u.map(id => ({ workout_id: w.id, equipment_id: id }))).select('workout_id'), 'utstyrskobling')
    // Test
    if (o.test) {
      maa(await admin.from('workout_test_data').insert({
        workout_id: w.id, user_id: USER, sport: 'biathlon', test_type: o.test.type,
        primary_result: o.test.resultat, primary_unit: o.test.enhet,
        subcategory: TESTER.find(t => t.dato === o.dato)?.sub ?? null,
      }).select('id'), 'testdata')
      if (!o.planlagt) maa(await admin.from('personal_records').insert({
        user_id: USER, sport: 'biathlon', record_type: o.test.type, value: o.test.resultat,
        unit: o.test.enhet, achieved_at: o.dato, workout_id: w.id, is_manual: false,
      }).select('id'), 'PR')
    }
  }
}

// ── Skitester, helse, Stridee-kobling og rapport ─────────────
async function skrivResten(utstyrId: Map<string, string>) {
  // Helse
  for (let i = 0; i < helse.length; i += 200) {
    maa(await admin.from('daily_health').insert(helse.slice(i, i + 200).map(h => ({
      user_id: USER, date: h.date, resting_hr: h.resting_hr, hrv_ms: h.hrv_ms,
      sleep_hours: h.sleep_hours, sleep_quality: h.sleep_quality,
      body_weight_kg: h.body_weight_kg, day_form: h.day_form,
    }))).select('id'), 'helse')
  }

  // Skitester (november-desember, planlagt del av sesongen)
  const skiIder = ['Rossignol X-ium S3 konkurranse', 'Rossignol X-ium S2 kald', 'Rossignol X-ium trening skøyt', 'Rossignol X-ium klassisk konkurranse', 'Rossignol X-ium klassisk trening']
    .map(n => ({ navn: n, id: utstyrId.get(n)! })).filter(x => x.id)
  const tester = [
    { dato: '2026-11-03', type: 'tidtaker', sted: 'Sjusjøen', luft: -6, sno: -8, snoType: 'nysno', forhold: 'kaldt og tørt' },
    { dato: '2026-11-20', type: 'parallell', sted: 'Geilo', luft: -2, sno: -3, snoType: 'finkornet', forhold: 'overskyet' },
    { dato: '2026-12-11', type: 'tidtaker', sted: 'Beitostølen', luft: -11, sno: -13, snoType: 'nysno', forhold: 'klarvær' },
  ]
  for (const t of tester) {
    const st = maa(await admin.from('ski_tests').insert({
      user_id: USER, test_date: t.dato, test_type: t.type, location: t.sted,
      air_temp: t.luft, snow_temp: t.sno, snow_type: t.snoType, conditions: t.forhold,
    }).select('id').single(), 'skitest') as { id: string }
    const rangert = [...skiIder].sort(() => rnd() - 0.5)
    maa(await admin.from('ski_test_entries').insert(rangert.map((s, i) => ({
      test_id: st.id, ski_id: s.id, rank_in_test: i + 1,
      time_seconds: 42 + i + Math.round(rnd() * 2), rating: Math.max(1, 10 - i),
      wax_used: velg(['HF blå', 'HF grønn', 'LF fiolett']), slip_used: velg(['C2-14', 'P5-1', 'SL2']),
    }))).select('id'), 'skitest-rader')
  }

  // Stridee-kobling: brukeren skal SE Garmin-tilkoblet ut. Tydelig falske id-er.
  const lenke = maa(await admin.from('stridee_link').insert({
    user_id: USER, stridee_user_id: 'demo-testbruker-ikke-ekte', status: 'aktiv', koblet_at: '2026-05-02',
  }).select('id').single(), 'stridee_link') as { id: string }
  maa(await admin.from('stridee_connections').insert({
    link_id: lenke.id, connection_id: 'demo-garmin-ikke-ekte', provider: 'garmin',
    status: 'aktiv', koblet_at: '2026-05-02',
  }).select('id'), 'stridee_connections')
}

function rapport() {
  const gjennomfort = alleOkter.filter(o => !o.planlagt)
  const planlagt = alleOkter.filter(o => o.planlagt)
  const sek = (o: Okt) => o.akt.reduce((s, a) => s + a.duration_seconds, 0)

  const perMnd: Record<string, number> = {}
  for (const o of gjennomfort) {
    const m = o.dato.slice(0, 7)
    perMnd[m] = (perMnd[m] ?? 0) + sek(o) / 3600
  }
  console.log('\n── TIMER PER MÅNED (faktisk mot plan) ──')
  let sum = 0
  for (const [m, t] of Object.entries(perMnd).sort()) {
    sum += t
    console.log(`  ${m}: ${t.toFixed(1)} t   plan ${MND_PLAN[m]?.timer ?? '-'} t`)
  }
  console.log(`  SUM gjennomført 01.05-09.09: ${sum.toFixed(1)} t`)
  console.log(`  Planlagt årssum i monthly_volume_plans: ${Object.values(MND_PLAN).reduce((s, v) => s + v.timer, 0)} t`)

  const soner: Record<string, number> = {}
  for (const o of gjennomfort) for (const a of o.akt) for (const [k, v] of Object.entries(a.zones ?? {})) soner[k] = (soner[k] ?? 0) + v
  const totSone = Object.values(soner).reduce((s, v) => s + v, 0)
  console.log('\n── INTENSITETSFORDELING (av registrert sonetid) ──')
  for (const z of ALL_ZONE_NAMES) if (soner[z]) console.log(`  ${z}: ${(soner[z] / totSone * 100).toFixed(1)} %  (${(soner[z] / 3600).toFixed(1)} t)`)
  console.log(`  I1+I2: ${((soner.I1 + (soner.I2 ?? 0)) / totSone * 100).toFixed(1)} % · I3: ${((soner.I3 ?? 0) / totSone * 100).toFixed(1)} % · I4+I5: ${(((soner.I4 ?? 0) + (soner.I5 ?? 0)) / totSone * 100).toFixed(1)} %`)

  const perType: Record<string, { skudd: number; treffL: number; skuddL: number; treffS: number; skuddS: number }> = {}
  for (const o of gjennomfort) for (const a of o.akt) {
    if (!a.serier?.length) continue
    const t = a.shooting_type ?? 'ukjent'
    perType[t] ??= { skudd: 0, treffL: 0, skuddL: 0, treffS: 0, skuddS: 0 }
    for (const s of a.serier) {
      perType[t].skudd += s.shots
      if (s.position === 'L') { perType[t].skuddL += s.shots; perType[t].treffL += s.hits }
      else { perType[t].skuddS += s.shots; perType[t].treffS += s.hits }
    }
  }
  console.log('\n── SKYTING PER TYPE ──')
  let totSkudd = 0
  for (const [t, v] of Object.entries(perType)) {
    totSkudd += v.skudd
    console.log(`  ${t.padEnd(16)} ${String(v.skudd).padStart(5)} skudd · L ${v.skuddL ? (v.treffL / v.skuddL * 100).toFixed(1) : '-'} % · S ${v.skuddS ? (v.treffS / v.skuddS * 100).toFixed(1) : '-'} %`)
  }
  console.log(`  TOTALT: ${totSkudd} skudd i historikken`)

  const perForm: Record<string, number> = {}
  for (const o of gjennomfort) {
    const f = [...new Set(o.akt.map(a => a.movement_name))].join('+')
    perForm[f] = (perForm[f] ?? 0) + 1
  }
  console.log('\n── ØKTER PER BEVEGELSESFORM ──')
  for (const [f, n] of Object.entries(perForm).sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(24)} ${n}`)

  console.log('\n── PROVENIENS ──')
  console.log(`  klokkesynket: ${gjennomfort.filter(o => o.klokke).length} · manuelt ført: ${gjennomfort.filter(o => !o.klokke).length}`)
  console.log(`  planlagte økter i planvinduet 10.09-10.10: ${planlagt.length}`)

  // Tre hardøkter: puls inn, laveste på standplass, puls 60 s etter
  console.log('\n── PULSFALL PÅ STANDPLASS (tre hardøkter) ──')
  const harde = gjennomfort.filter(o => o.akt.some(a => a.shooting_type === 'hard_komb' && a.serier?.length))
  for (const o of [harde[Math.floor(harde.length * 0.15)], harde[Math.floor(harde.length * 0.5)], harde[harde.length - 1]].filter(Boolean)) {
    const k = byggKurve(o)
    console.log(`  ${o.dato}  ${o.tittel}`)
    for (const sp of k.standplass) {
      const a = o.akt[sp.i]
      console.log(`     ${a.activity_type === 'skyting_liggende' ? 'liggende' : 'stående '} inn ${sp.inn} → lavest ${sp.lav} (fall ${sp.inn - sp.lav}) → 60 s etter ${sp.etter60 ?? '-'}`)
    }
  }

  // Laktat
  const laktat = gjennomfort.flatMap(o => o.akt.flatMap(a => (a.laktat ?? []).map(l => ({ dato: o.dato, mmol: l.mmol, type: o.workout_type }))))
  console.log(`\n── LAKTAT ──`)
  console.log(`  ${laktat.length} målinger på ${new Set(gjennomfort.filter(o => o.akt.some(a => a.laktat?.length)).map(o => o.dato)).size} økter · spenn ${Math.min(...laktat.map(l => l.mmol))}-${Math.max(...laktat.map(l => l.mmol))} mmol`)

  // Korrelasjon ukebelastning -> HRV uka etter
  const uke = (dato: string) => Math.floor(mellomDager(HIST_FRA, dato) / 7)
  const belUke: Record<number, number> = {}, hrvUke: Record<number, number[]> = {}
  for (const o of gjennomfort) belUke[uke(o.dato)] = (belUke[uke(o.dato)] ?? 0) + sek(o) / 3600
  for (const h of helse) (hrvUke[uke(h.date)] ??= []).push(h.hrv_ms)
  const par: [number, number][] = []
  for (const u of Object.keys(belUke).map(Number)) {
    const neste = hrvUke[u + 1]
    if (neste?.length) par.push([belUke[u], neste.reduce((s, v) => s + v, 0) / neste.length])
  }
  const snitt = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const mx = snitt(par.map(p => p[0])), my = snitt(par.map(p => p[1]))
  const r = par.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0)
    / Math.sqrt(par.reduce((s, p) => s + (p[0] - mx) ** 2, 0) * par.reduce((s, p) => s + (p[1] - my) ** 2, 0))
  console.log(`\n── HELSE ──`)
  console.log(`  daily_health-rader: ${helse.length} · HRV ${Math.min(...helse.map(h => h.hrv_ms))}-${Math.max(...helse.map(h => h.hrv_ms))} ms`)
  console.log(`  vekt ${helse[0].body_weight_kg} → ${helse[helse.length - 1].body_weight_kg} kg`)
  console.log(`  KORRELASJON ukebelastning → HRV uka etter: r = ${r.toFixed(3)} (${r < 0 ? 'negativ, som forventet' : 'IKKE NEGATIV - dette er støy, ikke fysiologi'})`)
}

// ── Kjør ─────────────────────────────────────────────────────
async function main() {
  if (process.env.TORR === '1') { rapport(); return }
  const { utstyrId } = await seed()
  await skrivOkter(utstyrId)
  await skrivResten(utstyrId)
  console.log('\nETTER SEEDING:', JSON.stringify(await tellAlt()))
  rapport()
}
main().catch(e => { console.error('SEED FEILET:', e.message); process.exit(1) })
