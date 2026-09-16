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
// PULS, SONER OG DISTANSE REGNES PER DEL (steg 5):
//  · pulsen med pulsIVindu (lib/segmenter) - ALDRI arvet. Et arvet snitt
//    ville påstått at pulsen var 158 gjennom et stopp der den falt til 120.
//  · sonene med computeZoneSecondsFromSamples per vindu. Uten pulsdata
//    fordeles originalens soner etter tid - det er det beste vi har, og
//    bare da.
//  · distansen fra distance_samples, fordelt etter FAKTISK tilbakelagt.
//    Pausen får ingen: man beveget seg ikke.
// SUMMENE BEVARES: delene skaleres så sonesummen og distansesummen er
// nøyaktig originalens. En fordeling som ser riktig ut men mister ti meter
// er en fordeling som lyver.

// ────────────────────────────────────────────────────────────────────────
// «FELTET FINNES» ER IKKE DET SAMME SOM «NOEN HAR PLASSERT RADEN»
// (Sverre 16. sep 2026 - mønsteret, funnet tre ganger på én dag).
//
// window_start_seconds er en LAGRET plassering som bare NOEN importveier
// skriver. .fit-importen skriver den ALDRI. Plasseringen som gjelder kommer
// fra biblioteket: beregnSegmenter flislegger radene langs kurven, og det
// er den båndet, øktbyggeren og analysen bruker.
//
// Denne fila leste window_* selv og fant ingen rad å dele på en importert
// økt - knappen gjorde ingenting, stille. Nå kommer plasseringen inn som
// `plass` fra kalleren, og kalleren spør biblioteket.
// ────────────────────────────────────────────────────────────────────────

import type { Stillestand } from '@/lib/stillestand'
import { MIN_RAD_SEK } from '@/lib/oktbygger-rader'
import { pulsIVindu } from '@/lib/segmenter'
import { computeZoneSecondsFromSamples, type HeartZone } from '@/lib/heart-zones'

/** Klokkedataene splitten regner delene fra. Alt er valgfritt. */
export interface SplittKilder {
  hr?: Array<{ t: number; hr: number }> | null
  distanse?: Array<{ t: number; d: number }> | null
  soner?: HeartZone[] | null
  /**
   * HVOR HVER RAD LIGGER, fra biblioteket - ikke regnet ut her.
   *
   * .fit-importen skriver aldri window_start_seconds, og resten av appen
   * flislegger radene i stedet (beregnSegmenter). Leste splitten window_*
   * selv, fant den ingen rad å dele på en importert økt, og gjorde
   * ingenting - stille (Sverre 16. sep). Mangler kartet, faller vi tilbake
   * på vinduet, som før.
   */
  plass?: Map<string, { fra: number; til: number }> | null
}

/** Meter tilbakelagt i vinduet, lest av den kumulative distansekurven. */
function meterIVindu(
  d: Array<{ t: number; d: number }> | null | undefined,
  fra: number, til: number,
): number | null {
  if (!d || d.length < 2) return null
  let forste: number | null = null, siste: number | null = null
  for (const s of d) {
    if (s.t < fra) { forste = s.d; continue }
    if (s.t > til) break
    if (forste == null) forste = s.d
    siste = s.d
  }
  if (forste == null || siste == null) return null
  return Math.max(0, siste - forste)
}

/**
 * Skaler andelene så summen blir NØYAKTIG målet.
 *
 * Uten dette ville avrunding spist noen meter eller et par sekunder for
 * hver del, og originalens sum ikke kommet tilbake ved angre. Resten av
 * avrundingen legges på den største delen - den tåler det best.
 */
function fordel(andeler: number[], mal: number): number[] {
  const sum = andeler.reduce((a, b) => a + b, 0)
  if (!(sum > 0) || !(mal > 0)) return andeler.map(() => 0)
  const ut = andeler.map(a => Math.round((a / sum) * mal))
  const rest = mal - ut.reduce((a, b) => a + b, 0)
  if (rest !== 0) {
    let storst = 0
    for (let i = 1; i < ut.length; i++) if (ut[i] > ut[storst]) storst = i
    ut[storst] += rest
  }
  return ut
}

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
  /** Fase 114: barnet peker på originalen det ble splittet ut av. */
  split_parent_id?: string | null
  /** Fase 114: originalens fulle radfelter, skrevet FØR endring.
      Ikke-null = raden ER en splittet original, og kan angres. */
  split_backup?: Record<string, unknown> | null
}

export interface SplittResultat {
  rader: SplittRad[]
  /** Id-ene til radene som faktisk ble delt - originalene angre må hente hjem. */
  splittede: string[]
  /** Rader som alt var splittet og derfor ble hoppet over. */
  alleredeSplittet: string[]
}

/**
 * Radens plass på tidslinja.
 *
 * Kartet fra biblioteket vinner. Uten kart: vinduet, som før - men da er
 * dette den eneste kilden, og den er blind for flislagte rader. Se
 * SplittKilder.plass.
 */
function spenn(r: SplittRad, plass?: Map<string, { fra: number; til: number }> | null): { fra: number; sek: number } | null {
  const fraKart = plass?.get(r.id)
  if (fraKart && fraKart.til > fraKart.fra) return { fra: fraKart.fra, sek: fraKart.til - fraKart.fra }
  const sek = r.window_duration_seconds ?? r.duration_seconds ?? 0
  if (!(sek > 0)) return null
  const fra = r.window_start_seconds
  if (fra == null) return null
  return { fra, sek }
}

/**
 * Kopien originalen tas vare på i.
 *
 * Fase 114-mønsteret: ALLE felter, også de splitten ikke rører. Angre
 * gjenoppretter raden fullt ut, ikke bare tida - ellers ville en distanse
 * eller en sone forsvunnet stille i en operasjon som het «angre».
 */
function lagBackup(r: SplittRad): Record<string, unknown> {
  const { split_backup: _b, split_parent_id: _p, ...resten } = r
  return { ...resten }
}

/** En del av originalen, med tida satt og identiteten ny. */
function del(mal: SplittRad, type: string, fra: number, sek: number, nr: number): SplittRad {
  const erPause = type === 'pause'
  return {
    ...mal,
    id: `${mal.id}::${nr}`,
    split_parent_id: mal.id,
    split_backup: null,
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
  kilder: SplittKilder = {},
): SplittResultat {
  const gyldige = stopp
    .filter(s => s.tilSek > s.fraSek)
    .slice()
    .sort((a, b) => a.fraSek - b.fraSek)
  if (gyldige.length === 0) return { rader, splittede: [], alleredeSplittet: [] }

  const ut: SplittRad[] = []
  const splittede: string[] = []
  const alleredeSplittet: string[] = []

  for (const rad of rader) {
    // INGEN NESTEDE BACKUPER (fase 114). En rad som alt er splittet - enten
    // den er originalen med backup eller et barn - hoppes over. Splittet vi
    // den igjen, ville backupen blitt overskrevet med en HALV rad, og angre
    // hadde gitt utøveren tilbake noe som aldri fantes.
    // Angre først, splitt så på nytt.
    if (rad.split_backup || rad.split_parent_id) {
      ut.push(rad); alleredeSplittet.push(rad.id); continue
    }
    const s = spenn(rad, kilder.plass)
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

    // ORIGINALEN BEHOLDES OG KORTES (fase 114-mønsteret): første bit
    // beholder radens id, og får backupen av hele originalen. De øvrige
    // bitene er nye rader som peker tilbake på den.
    //
    // ALT I ÉN OPERASJON, også når raden har flere stopp. To sekvensielle
    // splitter av samme rad ville truffet fase 114s avvisning av nestede
    // backuper på stopp nummer to - og etterlatt en halv splitt.
    const backup = lagBackup(rad)

    // ── FELTENE PER DEL ──────────────────────────────────────────────
    // PULS: alltid fra samples når de finnes. Aldri arvet.
    const puls = biter.map(b => pulsIVindu(kilder.hr, b.fra, b.fra + b.sek))

    // SONER: regnes på nytt fra samples. Uten pulsdata fordeles
    // originalens soner etter tid - pro rata antar jevn intensitet, og et
    // stillestand beviser det motsatte, så det er siste utvei.
    const harPuls = !!(kilder.hr && kilder.hr.length > 1 && kilder.soner && kilder.soner.length > 0)
    const sonerPerDel: (Record<string, number> | null)[] = biter.map(b =>
      harPuls
        ? computeZoneSecondsFromSamples(kilder.hr!, kilder.soner!, b.fra, b.fra + b.sek) as unknown as Record<string, number>
        : null)
    const origSoneSum = Object.values(rad.zones ?? {}).reduce((a, v) => a + v, 0)
    if (!harPuls && origSoneSum > 0) {
      // Tidsfordeling, skalert så summen står.
      const andeler = fordel(biter.map(b => b.sek), origSoneSum)
      const navn = Object.keys(rad.zones ?? {})
      biter.forEach((_, i) => {
        // Hele andelen i originalens dominerende sone - vi vet ikke mer.
        const dominant = navn.reduce((best, n) =>
          (rad.zones?.[n] ?? 0) > (rad.zones?.[best] ?? 0) ? n : best, navn[0])
        sonerPerDel[i] = andeler[i] > 0 ? { [dominant]: andeler[i] } : {}
      })
    } else if (harPuls && origSoneSum > 0) {
      // Skaler sample-sonene så SUMMEN er originalens. Samples dekker ikke
      // nødvendigvis hele spennet, og da ville sonetid forsvunnet stille.
      const sumPerDel = sonerPerDel.map(z => Object.values(z ?? {}).reduce((a, v) => a + v, 0))
      const mal = fordel(sumPerDel.some(x => x > 0) ? sumPerDel : biter.map(b => b.sek), origSoneSum)
      sonerPerDel.forEach((z, i) => {
        const sum = Object.values(z ?? {}).reduce((a, v) => a + v, 0)
        if (!z || sum === 0) { sonerPerDel[i] = mal[i] > 0 ? { I1: mal[i] } : {}; return }
        const navn = Object.keys(z)
        const skalert = fordel(navn.map(n => z[n]), mal[i])
        sonerPerDel[i] = Object.fromEntries(navn.map((n, j) => [n, skalert[j]]).filter(([, v]) => (v as number) > 0))
      })
    }

    // DISTANSE: etter faktisk tilbakelagt, aldri til pausen. Skalert så
    // summen er originalens - en fordeling som mister ti meter lyver.
    const origDist = rad.distance_meters ?? 0
    const maltPerDel = biter.map(b =>
      b.type === 'pause' ? 0 : (meterIVindu(kilder.distanse, b.fra, b.fra + b.sek) ?? b.sek))
    const distPerDel = origDist > 0 ? fordel(maltPerDel, origDist) : biter.map(() => 0)

    // TO TIDSBEGREPER, OG DE SKAL IKKE BLANDES (målt på Sverres Garmin-økt
    // 16. sep): flisleggingen plasserer radene langs KURVEN, som er 3633 s,
    // mens radenes egne duration_seconds summerer 3634. Brukte vi
    // plasseringen til begge, tapte økta ett sekund i en operasjon som bare
    // skulle flytte tid.
    //   window_*          fra plasseringen - båndet skal treffe kurven
    //   duration_seconds  skalert til ORIGINALENS varighet - regnskapet
    //                     skal stemme på sekundet
    const origVarighet = rad.duration_seconds ?? s.sek
    const varigheter = fordel(biter.map(b => b.sek), origVarighet)

    biter.forEach((b, i) => {
      const erPause = b.type === 'pause'
      const felter = {
        avg_heart_rate: puls[i].snitt,
        max_heart_rate: puls[i].maks,
        distance_meters: erPause ? null : (origDist > 0 ? distPerDel[i] : null),
        // SONENE STÅR OGSÅ PÅ PAUSEN. De er MÅLT fra samples, ikke arvet -
        // pulsen var 104 der, og det er sant. Sonesummen over alle delene
        // skal være originalens, ellers forsvinner sonetid i en operasjon
        // som bare skulle flytte den. computeActivityTotals hopper uansett
        // over pause-rader før den leser soner, så treningstida påvirkes
        // ikke (Sverre 16. sep).
        zones: sonerPerDel[i] ?? null,
      }
      if (i === 0) {
        ut.push({
          ...rad,
          activity_type: b.type,
          window_start_seconds: b.fra,
          window_duration_seconds: b.sek,
          duration_seconds: varigheter[i],
          split_backup: backup,
          ...felter,
        })
        return
      }
      ut.push({ ...del(rad, b.type, b.fra, b.sek, i), duration_seconds: varigheter[i], ...felter })
    })
    splittede.push(rad.id)
  }

  return { rader: ut, splittede, alleredeSplittet }
}


export interface AngreResultat {
  rader: SplittRad[]
  /** Id-ene til barna som ble slettet. */
  slettede: string[]
}

/**
 * Sy raden sammen igjen.
 *
 * REGEL 40 PÅ ANGRE-SIDEN: «radene er borte» er ikke «tallet er tilbake».
 * Derfor gjenopprettes originalen FULLT fra split_backup - alle felter,
 * også de splitten aldri rørte - og ikke bare tida. En distanse eller en
 * sone som forsvant i en operasjon som het «angre», ville vært verre enn
 * splitten den angret.
 *
 * Flere barn på samme original slettes alle: en rad med to stopp har fire
 * barn, og de hører sammen i én operasjon.
 */
export function angreSplitt(rader: SplittRad[]): AngreResultat {
  const originaler = rader.filter(r => r.split_backup)
  if (originaler.length === 0) return { rader, slettede: [] }
  const foreldre = new Set(originaler.map(r => r.id))

  const slettede: string[] = []
  const ut: SplittRad[] = []
  for (const r of rader) {
    if (r.split_parent_id && foreldre.has(r.split_parent_id)) { slettede.push(r.id); continue }
    if (r.split_backup) {
      // Backupen ER raden slik den var. Vi setter den tilbake hel, og
      // rydder backupen så raden kan splittes på nytt senere.
      ut.push({ ...(r.split_backup as unknown as SplittRad), split_backup: null, split_parent_id: null })
      continue
    }
    ut.push(r)
  }
  return { rader: ut, slettede }
}
