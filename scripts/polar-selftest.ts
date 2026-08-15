// Selvtest av de rene funksjonene i lib/polar.ts (kø #51 bolk 6).
//
// Kjør:  node scripts/polar-selftest.ts
//
// Node kjører TypeScript direkte med innebygd type-stripping — repoet har
// ikke noe testrammeverk, og dette trenger ikke ett. Testen dekker det som
// ikke kan verifiseres mot Polars dokumentasjon (sample-koder, fartsenhet)
// og det som må være eksakt riktig (HMAC-signatur, ISO-varighet, mapping).
//
// Den fant en ekte feil da den ble skrevet: sport='OTHER' kortsluttet den
// mer presise detailed_sport_info-heuristikken.
process.env.POLAR_WEBHOOK_SECRET = 'hemmelig-test-nokkel'

import { createHmac } from 'crypto'
import {
  parseIsoDuration,
  polarLocalStart,
  parsePolarSamples,
  mapPolarSportToXpulse,
  verifyPolarWebhookSignature,
} from '../lib/polar.ts'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FEIL'} ${name}${ok ? '' : `\n     fikk:      ${a}\n     forventet: ${e}`}`)
}

// ── varighet ────────────────────────────────────────────────
check('varighet PT2H44M45S', parseIsoDuration('PT2H44M45S'), 9885)
check('varighet PT45M', parseIsoDuration('PT45M'), 2700)
check('varighet PT30.5S', parseIsoDuration('PT30.5S'), 31)
check('varighet P1DT2H', parseIsoDuration('P1DT2H'), 93600)
check('varighet tom', parseIsoDuration(undefined), 0)
check('varighet søppel', parseIsoDuration('2 timer'), 0)

// ── lokal starttid ──────────────────────────────────────────
const start = polarLocalStart({ id: 'x', start_time: '2026-08-15T10:40:02' })
check('start dato', start.date, '2026-08-15')
check('start klokkeslett', start.time, '10:40')

// ── webhook-signatur ────────────────────────────────────────
const body = '{"event":"EXERCISE","user_id":475,"entity_id":"aQlC83"}'
const goodSig = createHmac('sha256', 'hemmelig-test-nokkel').update(body, 'utf8').digest('hex')
check('signatur riktig', verifyPolarWebhookSignature(body, goodSig).ok, true)
check('signatur STORE bokstaver', verifyPolarWebhookSignature(body, goodSig.toUpperCase()).ok, true)
check('signatur feil', verifyPolarWebhookSignature(body, 'a'.repeat(64)).ok, false)
check('signatur mangler', verifyPolarWebhookSignature(body, null).ok, false)
check('signatur endret kropp', verifyPolarWebhookSignature(body + ' ', goodSig).ok, false)

// ── sport-mapping ───────────────────────────────────────────
check('sport TRAIL_RUNNING', mapPolarSportToXpulse('RUNNING', 'TRAIL_RUNNING'), { movement: 'Løping', subcategory: 'Terreng' })
check('sport CYCLING', mapPolarSportToXpulse('CYCLING'), { movement: 'Sykling', subcategory: null })
check('sport detaljert vinner', mapPolarSportToXpulse('OTHER', 'INDOOR_CYCLING'), { movement: 'Sykling', subcategory: 'Indoors/Ergo' })
check('sport prefiks-heuristikk', mapPolarSportToXpulse('OTHER', 'WINTERSPORTS_ICE_SKATING'), { movement: 'Skøyter', subcategory: null })
check('sport ukjent → Annet', mapPolarSportToXpulse('OTHER', 'WATERSPORTS_WATERSKI'), { movement: 'Annet', subcategory: null })
check('sport tom', mapPolarSportToXpulse(null, null), { movement: 'Annet', subcategory: null })
check('sport rulleski klassisk', mapPolarSportToXpulse('SKIING', 'ROLLER_SKIING_CLASSIC'), { movement: 'Rulleski', subcategory: 'Klassisk' })

// ── samples: puls + fart i km/t ─────────────────────────────
const detail = {
  id: 'abc',
  start_time: '2026-08-15T10:00:00',
  duration: 'PT30M',
  distance: 6000,                       // 6 km på 30 min = 3,333 m/s
  heart_rate: { average: 130, maximum: 145 },
  samples: [
    // puls hvert 5. sek. 0 = sensor-dropout, "null" = offline. Snitt av
    // gyldige verdier (120,130,140) = 130 → stemmer med heart_rate.average.
    { 'recording-rate': 5, 'sample-type': '0', data: '0,120,null,130,140' },
    // fart i km/t: 12 km/t = 3,333 m/s → forholdet blir 3,6 og skal konverteres
    { 'recording-rate': 60, 'sample-type': '1', data: '12,12,12' },
    { 'recording-rate': 10, 'sample-type': '2', data: '85,86' },
    { 'recording-rate': 10, 'sample-type': '99', data: '1,2,3' },
  ],
}
const parsed = parsePolarSamples(detail)
check('puls-samples', parsed.samples.hr_samples, [{ t: 5, hr: 120 }, { t: 15, hr: 130 }, { t: 20, hr: 140 }])
check('puls troverdig', parsed.hrTrusted, true)
check('fart konvertert til m/s', parsed.samples.pace_samples?.map(p => Math.round(p.mps * 100) / 100), [3.33, 3.33, 3.33])
check('kadens', parsed.samples.cadence_samples, [{ t: 0, cad: 85 }, { t: 10, cad: 86 }])
check('watt mangler', parsed.samples.watt_samples, null)
check('har data', parsed.hasAny, true)
check('merknad om ukjent type', parsed.notes.some(n => n.includes('99')), true)
check('merknad om km/t', parsed.notes.some(n => n.includes('km/t')), true)

// ── samples: puls som IKKE stemmer med økta ─────────────────
const mismatch = parsePolarSamples({
  id: 'b', start_time: '2026-08-15T10:00:00', duration: 'PT10M',
  heart_rate: { average: 60 },
  samples: [{ 'recording-rate': 1, 'sample-type': '0', data: '130,132,134' }],
})
check('puls avvist ved avvik', mismatch.hrTrusted, false)
check('merknad om avvik', mismatch.notes.some(n => n.includes('stemmer ikke')), true)

// ── samples: fart allerede i m/s ────────────────────────────
const mps = parsePolarSamples({
  id: 'c', start_time: '2026-08-15T10:00:00', duration: 'PT30M', distance: 6000,
  samples: [{ 'recording-rate': 60, 'sample-type': '1', data: '3.3,3.4,3.3' }],
})
check('fart beholdt som m/s', mps.samples.pace_samples?.[0].mps, 3.3)
check('merknad m/s', mps.notes.some(n => n.includes('m/s')), true)

// ── samples: blokker slås sammen og sorteres ────────────────
const split = parsePolarSamples({
  id: 'd', start_time: '2026-08-15T10:00:00', duration: 'PT1M',
  samples: [
    { 'recording-rate': 10, 'sample-type': '0', data: '150,151' },
    { 'recording-rate': 5, 'sample-type': '0', data: '140,141' },
  ],
})
check('samples sortert på tid', split.samples.hr_samples?.map(p => p.t), [0, 0, 5, 10])

// ── tomme samples ───────────────────────────────────────────
const none = parsePolarSamples({ id: 'e', start_time: '2026-08-15T10:00:00' })
check('ingen samples', none.hasAny, false)
check('puls ikke troverdig uten data', none.hrTrusted, false)

console.log(failures === 0 ? '\nALLE TESTER OK' : `\n${failures} TESTER FEILET`)
process.exit(failures === 0 ? 0 : 1)
