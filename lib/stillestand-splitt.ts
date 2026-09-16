// SPLITT AV RADEN ET STILLESTAND LIGGER I.
//
// HVA SOM VAR GALT (målt 16. sep 2026):
// gjorStillestandTilPause la pause-raden OPPÅ aktivitetsraden. Radene
// summerte da mer enn økta varte, og computeActivityTotals - som summerer
// per rad og trekker fra pausen - landet på samme tall som før:
//   uten splitt   3600 -> 3600   ren treningstid UENDRET
//   med splitt    3600 -> 3540   ned med stoppets lengde, som lovet
// Og unntaket vi trodde fantes, fantes ikke: falt stoppet mellom to rader,
// gikk det 3540 -> 3540. Den tida var aldri talt som treningstid.
//
// REGELEN, og den er det eneste som betyr noe:
//   ren treningstid FØR - ren treningstid ETTER = stoppets varighet
//   TOTALTIDA er uendret
// scripts/stillestand-utfall-selftest.ts uttrykker den som et regnestykke,
// og den ble skrevet før denne fila (regel 40).
//
// Samme prinsipp som gjorTilSkyting (lib/oktbygger-rader): tida flyttes
// mellom rader, den forsvinner aldri og den dupliseres aldri.
//
// PULS, SONER OG DISTANSE PER DEL er IKKE med her - de kommer som eget
// steg (Sverres rekkefølge: splitt først, så feltene). Delene arver
// foreløpig originalens verdier, og pausen får ingen. Det er bevisst
// ufullstendig, ikke oversett: et arvet pulssnitt ville påstått at pulsen
// var den samme gjennom et stopp, og det er nettopp det som skal regnes
// per del med pulsIVindu når steget tas.

import type { Stillestand } from '@/lib/stillestand'
import { MIN_RAD_SEK } from '@/lib/oktbygger-rader'

/** Raden slik splitten trenger å se den. */
export interface SplittRad {
  id: string
  activity_type: string
  window_start_seconds: number | null
  window_duration_seconds: number | null
  duration_seconds: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  zones: Record<string, number> | null
}

export interface SplittResultat {
  rader: SplittRad[]
  /** Id-ene til radene som faktisk ble delt - originalene angre må hente hjem. */
  splittede: string[]
}

/** Radens plass på tidslinja. Vinduet vinner, som ellers i byggeren. */
function spenn(r: SplittRad): { fra: number; sek: number } | null {
  const sek = r.window_duration_seconds ?? r.duration_seconds ?? 0
  if (!(sek > 0)) return null
  const fra = r.window_start_seconds
  if (fra == null) return null
  return { fra, sek }
}

/** En del av originalen, med tida satt og identiteten ny. */
function del(mal: SplittRad, type: string, fra: number, sek: number, nr: number): SplittRad {
  const erPause = type === 'pause'
  return {
    ...mal,
    id: `${mal.id}::${nr}`,
    activity_type: type,
    window_start_seconds: fra,
    window_duration_seconds: sek,
    duration_seconds: sek,
    // Pausen arver ingenting: man beveget seg ikke, og et arvet snitt ville
    // løyet. Aktivitetsdelene beholder originalens verdier inntil de regnes
    // per del (eget steg).
    distance_meters: erPause ? null : mal.distance_meters,
    avg_heart_rate: erPause ? null : mal.avg_heart_rate,
    max_heart_rate: erPause ? null : mal.max_heart_rate,
    zones: erPause ? null : mal.zones,
  }
}

/**
 * Del radene slik at hvert stillestand blir sin egen pause-rad.
 *
 * Totaltida står uendret: en rad på 3600 s med et stopp på 60 blir 600 +
 * 60 + 2940, aldri 3600 + 60.
 */
export function splittForStillestand(
  rader: SplittRad[],
  stopp: Stillestand[],
): SplittResultat {
  const gyldige = stopp
    .filter(s => s.tilSek > s.fraSek)
    .slice()
    .sort((a, b) => a.fraSek - b.fraSek)
  if (gyldige.length === 0) return { rader, splittede: [] }

  const ut: SplittRad[] = []
  const splittede: string[] = []

  for (const rad of rader) {
    const s = spenn(rad)
    if (!s) { ut.push(rad); continue }
    const slutt = s.fra + s.sek

    // Stoppene som treffer DENNE raden, klippet til radens spenn. Et stopp
    // som strekker seg over to rader deles mellom dem - radene kan ha ulik
    // bevegelsesform, og skal ikke slås sammen.
    const treff = gyldige
      .map(p => ({ fra: Math.max(p.fraSek, s.fra), til: Math.min(p.tilSek, slutt) }))
      .filter(p => p.til > p.fra)
    if (treff.length === 0) { ut.push(rad); continue }

    // Bygg vekselvis aktivitet og pause gjennom radens spenn.
    type Bit = { type: string; fra: number; sek: number }
    const biter: Bit[] = []
    let ved = s.fra
    for (const p of treff) {
      if (p.fra > ved) biter.push({ type: rad.activity_type, fra: ved, sek: p.fra - ved })
      biter.push({ type: 'pause', fra: p.fra, sek: p.til - p.fra })
      ved = p.til
    }
    if (ved < slutt) biter.push({ type: rad.activity_type, fra: ved, sek: slutt - ved })

    // En aktivitetsbit under minstemålet blir ikke en egen rad - pausen ved
    // siden av svelger den. En tre-sekunders rad hjelper ingen, og tida må
    // uansett bli liggende (totaltid uendret).
    for (let i = 0; i < biter.length; i++) {
      const b = biter[i]
      if (b.type === 'pause' || b.sek >= MIN_RAD_SEK) continue
      const forrige = biter[i - 1], neste = biter[i + 1]
      if (neste?.type === 'pause') {
        neste.fra = b.fra
        neste.sek += b.sek
      } else if (forrige?.type === 'pause') {
        forrige.sek += b.sek
      } else {
        continue  // ingen pause å slå den sammen med: la den stå
      }
      biter.splice(i, 1)
      i--
    }

    // Ble alt til pause, er raden pausen - ingen splitt, bare ny type.
    if (biter.length === 1) {
      ut.push(del(rad, biter[0].type, biter[0].fra, biter[0].sek, 0))
      if (biter[0].type !== rad.activity_type) splittede.push(rad.id)
      continue
    }
    biter.forEach((b, i) => ut.push(del(rad, b.type, b.fra, b.sek, i)))
    splittede.push(rad.id)
  }

  return { rader: ut, splittede }
}
