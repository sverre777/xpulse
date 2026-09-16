// REN TRENINGSTID PÅ TRENERFLATENE - én regnemåte (Sverre 16. sep 2026).
//
// Bakgrunn: trener-oversikt leste RADENE, mens utøverlista og eksporten
// summerte workouts.duration_minutes rått. Samme skjerm kunne vise
// øktetimer ned og utøverlista uendret - og med «gjør stillestand til
// pause» ville spriket blitt synlig for enhver.
//
// VEDTAK: radene vinner. duration_minutes brukes bare som fallback, med
// NØYAKTIG samme regel som lib/calendar-summary bruker for kalenderen:
// radene teller når de gir mer enn null, ellers står det utøveren førte.
// Da finnes det én regel, ikke to som kan bli uenige.
//
// NAVNENE (Sverre): «Total tid» er hele økta slik den ble ført. «Ren
// treningstid» er den med pause, veksling og standplass trukket fra. Ingen
// nye ord - begge står allerede i produktet.
//
// ────────────────────────────────────────────────────────────────────────
// HVORFOR DETTE IKKE BLE RASKERE - LES DETTE FØR DU «OPTIMALISERER»
//
// Man kunne aggregert i Postgres og fått 15 rader tilbake i stedet for
// 3 720, nær gratis. Vi gjør det bevisst IKKE: «ren treningstid» ville da
// finnes to steder - i computeActivityTotals og i en SQL-kopi - og de to
// ville skli fra hverandre første gang en aktivitetstype endrer betydning.
// Det har allerede skjedd én gang: aktiv pause gikk fra å være utenfor
// treningstida til å være innenfor (9823f70).
//
// Målt 15. sep, trener med 15 utøvere og 600 økter over 30 dager:
//   uten rader                   96 ms
//   nøstet embed              1 123 ms   (11,7x)
//   egen flat spørring          242 ms   (2,5x)
// Sideinnlasting /app/trener/utovere: 1 001 ms -> 1 324 ms.
// 323 ms er prisen for at det finnes ÉN regnemåte. Den er betalt med vitende
// vilje. Vil du ha dem tilbake, må du først fjerne den andre regnemåten -
// ikke legge til en ny.
// ────────────────────────────────────────────────────────────────────────

import { computeActivityTotals, type ActivityLike } from '@/lib/activity-summary'

/** Raden slik trenerflatene trenger den - bare det regnestykket bruker. */
export interface RadForTid {
  workout_id: string
  activity_type: string
  duration_seconds: number | null
}

/** Økta slik fallbacken trenger den. */
export interface OktForTid {
  id: string
  duration_minutes: number | null
}

/**
 * Sekunder ren treningstid per økt-id, regnet fra radene.
 *
 * Går gjennom computeActivityTotals - samme funksjon som øktsida, kalenderen
 * og trener-oversikten bruker. Pause og veksling er ute (IKKE_TRENINGSTID_
 * TYPER), skyting er ute, aktiv pause er inne.
 */
export function renTidSekPerOkt(rader: RadForTid[]): Map<string, number> {
  const perOkt = new Map<string, ActivityLike[]>()
  for (const r of rader) {
    const liste = perOkt.get(r.workout_id)
    const rad: ActivityLike = {
      activity_type: r.activity_type,
      duration_seconds: r.duration_seconds,
      distance_meters: null, avg_heart_rate: null, zones: null,
    }
    if (liste) liste.push(rad)
    else perOkt.set(r.workout_id, [rad])
  }
  const ut = new Map<string, number>()
  for (const [id, liste] of perOkt) ut.set(id, computeActivityTotals(liste, []).totalSeconds)
  return ut
}

/**
 * Minutter ren treningstid for én økt.
 *
 * FALLBACKEN ER LIK KALENDERENS (lib/calendar-summary): radene teller når de
 * gir mer enn null. Gir de null - økta har ingen rader, eller bare pause- og
 * skyterader - står tallet utøveren selv førte. Uten det ville en økt som
 * nettopp fikk pause-rader kunnet falle til null timer.
 */
export function renTidMin(okt: OktForTid, renTidSek: Map<string, number>): number {
  const sek = renTidSek.get(okt.id) ?? 0
  if (sek > 0) return Math.round(sek / 60)
  return Number(okt.duration_minutes) || 0
}
