// Selvtest av søvn- og Nightly Recharge-parsingen i lib/polar.ts (kø #52 bolk 2).
//
// Kjør:  node scripts/polar-health-selftest.ts
//
// Dekker det som ikke kan verifiseres mot Polars dokumentasjon uten ekte data:
// sekund→minutt-konvertering, kryssjekken mellom søvnfaser og tid i seng,
// at brukerens egen vurdering (sleep_rating) tolkes riktig, at verdier utenfor
// kolonnenes check-constraints droppes i stedet for å velte hele inserten, og
// at merkespesifikke skårer holdes UTENFOR fellesfeltene.

import { parsePolarSleep, parsePolarRecharge } from '../lib/polar.ts'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FEIL'} ${name}${ok ? '' : `\n     fikk:      ${a}\n     forventet: ${e}`}`)
}

// ── Normal natt: faser og tid-i-seng er enige ────────────────
// 23:00 → 07:00 = 480 min i seng, 20 min våken ⇒ 460 min søvn.
// Faser: 240 lett + 120 dyp + 90 REM + 10 ukjent = 460 min. Samme tall.
const natt = parsePolarSleep({
  date: '2026-08-15',
  sleep_start_time: '2026-08-14T23:00:00+02:00',
  sleep_end_time: '2026-08-15T07:00:00+02:00',
  light_sleep: 14400,
  deep_sleep: 7200,
  rem_sleep: 5400,
  unrecognized_sleep_stage: 600,
  total_interruption_duration: 1200,
  sleep_rating: 4,
  sleep_score: 80,
  sleep_charge: 3,
  continuity: 2.1,
  continuity_class: 2,
  sleep_cycles: 6,
  sleep_goal: 28800,
  group_duration_score: 100,
})
check('dato', natt.date, '2026-08-15')
check('total søvntid (min)', natt.common.total_sleep_minutes, 460)
check('våkentid (min)', natt.common.awake_minutes, 20)
check('dyp søvn (min)', natt.common.deep_minutes, 120)
check('lett søvn (min)', natt.common.light_minutes, 240)
check('REM (min)', natt.common.rem_minutes, 90)
check('opplevd kvalitet', natt.common.perceived_quality, 4)
check('leggetid beholdt som tidspunkt', natt.common.sleep_start, '2026-08-14T23:00:00+02:00')
check('ingen merknader når tallene stemmer', natt.notes, [])

// Merkespesifikt skal IKKE ligge i fellesfeltene.
check('sleep_score er merkespesifikk', natt.brand.sleep_score, 80)
check('sleep_charge er merkespesifikk', natt.brand.sleep_charge, 3)
check('sleep_goal konvertert til minutter', natt.brand.sleep_goal_minutes, 480)
check('fellesfelt har ingen sleep_score', 'sleep_score' in natt.common, false)
check('fellesfelt har ingen continuity', 'continuity' in natt.common, false)

// ── Faser og tid i seng spriker ⇒ merknad, fase-summen vinner ─
const sprik = parsePolarSleep({
  date: '2026-08-16',
  sleep_start_time: '2026-08-15T23:00:00+02:00',
  sleep_end_time: '2026-08-16T07:00:00+02:00',   // 480 min i seng
  light_sleep: 9000,                              // 150 min
  deep_sleep: 3600,                               // 60 min
  rem_sleep: 5400,                                // 90 min  ⇒ sum 300 min
  total_interruption_duration: 1200,              // ⇒ tid-i-seng-variant 460 min
})
check('fase-summen vinner ved sprik', sprik.common.total_sleep_minutes, 300)
check('sprik gir merknad', sprik.notes.some(n => n.includes('spriker')), true)

// ── Uten faser: faller tilbake på tid i seng minus avbrudd ───
const utenFaser = parsePolarSleep({
  date: '2026-08-17',
  sleep_start_time: '2026-08-16T22:30:00+02:00',
  sleep_end_time: '2026-08-17T06:30:00+02:00',   // 480 min
  total_interruption_duration: 600,               // 10 min
})
check('fallback til tid i seng', utenFaser.common.total_sleep_minutes, 470)

// ── sleep_rating: 0 betyr «ikke gitt» ────────────────────────
check('rating 0 → null', parsePolarSleep({ date: '2026-08-18', sleep_rating: 0 }).common.perceived_quality, null)
check('rating 5 → 5', parsePolarSleep({ date: '2026-08-18', sleep_rating: 5 }).common.perceived_quality, 5)
check('rating mangler → null', parsePolarSleep({ date: '2026-08-18' }).common.perceived_quality, null)

// ── Urimelige verdier droppes i stedet for å velte inserten ──
// sleep_records.deep_minutes har check (0–1440). 100 000 sek = 1667 min.
const urimelig = parsePolarSleep({ date: '2026-08-19', deep_sleep: 100000 })
check('urimelig fase droppes', urimelig.common.deep_minutes, null)
check('urimelig fase gir merknad', urimelig.notes.some(n => n.includes('utenfor')), true)

// ── Tom natt: ingen krasj, ingen oppdiktede verdier ──────────
const tom = parsePolarSleep({ date: '2026-08-20' })
check('tom natt gir null-verdier', tom.common.total_sleep_minutes, null)
check('tom natt har ingen merkeverdier', Object.keys(tom.brand).length, 0)

// ── Nightly Recharge ─────────────────────────────────────────
const recharge = parsePolarRecharge({
  date: '2026-08-15',
  heart_rate_avg: 48,
  heart_rate_variability_avg: 62,
  beat_to_beat_avg: 1250,
  breathing_rate_avg: 13.4,
  nightly_recharge_status: 5,
  ans_charge: 0.8,
  ans_charge_status: 4,
})
check('hvilepuls fra heart_rate_avg', recharge.common.resting_hr, 48)
check('HRV fra heart_rate_variability_avg', recharge.common.hrv_ms, 62)
check('nightly_recharge_status er merkespesifikk', recharge.brand.nightly_recharge_status, 5)
check('ans_charge er merkespesifikk', recharge.brand.ans_charge, 0.8)
check('fellesfelt har ingen ans_charge', 'ans_charge' in recharge.common, false)
check('recharge uten merknader', recharge.notes, [])

// health_metrics.resting_hr har check (20–150).
const villPuls = parsePolarRecharge({ date: '2026-08-16', heart_rate_avg: 300 })
check('urimelig hvilepuls droppes', villPuls.common.resting_hr, null)
check('urimelig hvilepuls gir merknad', villPuls.notes.some(n => n.includes('utenfor')), true)

const tomRecharge = parsePolarRecharge({ date: '2026-08-17' })
check('tom recharge gir null', tomRecharge.common.resting_hr, null)
check('tom recharge har ingen merkeverdier', Object.keys(tomRecharge.brand).length, 0)

console.log(failures === 0 ? '\nALLE TESTER OK' : `\n${failures} TESTER FEILET`)
process.exit(failures === 0 ? 0 : 1)
