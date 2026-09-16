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

/** Radens plass på tidslinja. Vinduet vinner, som ellers i byggeren. */
function spenn(r: SplittRad): { fra: number; sek: number } | null {
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

    // ORIGINALEN BEHOLDES OG KORTES (fase 114-mønsteret): første bit
    // beholder radens id, og får backupen av hele originalen. De øvrige
    // bitene er nye rader som peker tilbake på den.
    //
    // ALT I ÉN OPERASJON, også når raden har flere stopp. To sekvensielle
    // splitter av samme rad ville truffet fase 114s avvisning av nestede
    // backuper på stopp nummer to - og etterlatt en halv splitt.
    const backup = lagBackup(rad)
    biter.forEach((b, i) => {
      if (i === 0) {
        ut.push({
          ...rad,
          activity_type: b.type,
          window_start_seconds: b.fra,
          window_duration_seconds: b.sek,
          duration_seconds: b.sek,
          split_backup: backup,
          // Pausen arver ingenting, heller ikke når den er første bit.
          ...(b.type === 'pause'
            ? { distance_meters: null, avg_heart_rate: null, max_heart_rate: null, zones: null }
            : {}),
        })
        return
      }
      ut.push(del(rad, b.type, b.fra, b.sek, i))
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
