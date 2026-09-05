// Intervall-generator: konfigurasjon → ferdige ActivityRow-er.
//
// Fasit er `design/xpulse-intervall-bygger-design.html`. Alle valgene er tatt
// der; denne fila er den samme logikken i typet form, koblet på appens
// eksisterende modeller. UI-en bygges separat.
//
// GJENBRUK, IKKE PARALLELLSPOR:
//   · sonetotaler  → `blokkerTilSoner` fra okt-template-library
//   · varigheter   → `sekTilKlokke` samme sted
//   · skyterader   → `shooting_type` + `shooting_series`, samme vei som
//                    `skyteRad` i okt-mal-kopi og `generateCompetitionActivities`
//
// `workout_type` settes IKKE. Det er mal-fiksens felt — se SF-10.
// Ingenting låses: radene er helt vanlige og fritt redigerbare etterpå.

import { emptyActivityZones } from './types.ts'
import {
  blokkerTilSoner,
  sekTilKlokke,
  totalSekunder,
  type Blokk,
  type BlokkSone,
} from './okt-template-library.ts'
import {
  findActivityType,
  makeActivity,
  type ActivityRow,
  type ActivityType,
  type ShootingSeriesRow,
} from './types.ts'

/** Skyteposisjonene fordelt utover pausene. Null = ingen skyting. */
export type SkyteMonster = 'LS' | 'LLSS' | 'PAR' | 'L' | 'S'

export interface IntervallRad {
  antall: number
  dragSek: number
  sone: BlokkSone
  pauseSek: number
}

export interface IntervallKonfig {
  oppvarmingSek: number
  nedjoggSek: number
  /** Stables i rekkefølge. Rad 2 starter der rad 1 slutter. */
  rader: IntervallRad[]
  /** Gjelder hele økta. Skyterader får den aldri. */
  bevegelsesform: string
  underkategori: string
  skyting: SkyteMonster | null
  /** Pkt 16 (Sverre 4. sep): skytinga er ETT segment på maks 60 s INNI
      pausen (standard 45 s); resten av pausen ligger som pause etter.
      Totaltida er fortsatt uendret. */
  skytetidSek?: number
}

export const SKYTETID_STANDARD_SEK = 45
export const SKYTETID_MAKS_SEK = 60

/** Blokk + det ActivityRow trenger utover sone og varighet. */
export interface GenerertBlokk extends Blokk {
  type: ActivityType
  /** Kun satt på skyteblokker. */
  posisjon: 'L' | 'S' | null
}

/** 5 skudd per serie. Standard i skiskyting, ikke et valg i byggeren. */
const SKUDD_PER_SERIE = '5'

/**
 * Posisjon for pause nr. `i` av `n` totalt.
 *
 * Ett sted, så mønsteret aldri kan tolkes ulikt to steder. `i` teller alle
 * pauser i HELE økta, ikke innenfor én rad — se `byggBlokker`.
 */
export function posisjonForPause(
  monster: SkyteMonster | null,
  i: number,
  n: number,
): 'L' | 'S' | null {
  switch (monster) {
    case 'LS':   return i % 2 === 0 ? 'L' : 'S'
    case 'LLSS': return i < Math.ceil(n / 2) ? 'L' : 'S'  // alle liggende først
    case 'PAR':  return i % 4 < 2 ? 'L' : 'S'             // L,L,S,S,L,L,S,S
    case 'L':    return 'L'
    case 'S':    return 'S'
    default:     return null
  }
}

/**
 * Konfigurasjon → blokker, i rekkefølge.
 *
 * TO REGLER SOM LETT BLIR FEIL:
 *
 * 1. Kun den ALLER SISTE pausen i hele økta faller bort — n drag gir n−1
 *    pauser. Pausen MELLOM to rader beholdes, ellers ville siste drag i rad 1
 *    kollidert med første drag i rad 2.
 *
 * 2. Pausene nummereres på tvers av alle radene. Startet mønsteret på nytt per
 *    rad, ville en økt med to rader gitt to liggende etter hverandre midt i
 *    økta uten at noen hadde bedt om det.
 */
export function byggBlokker(konfig: IntervallKonfig): GenerertBlokk[] {
  const erSistePause = (radIdx: number, dragIdx: number, rad: IntervallRad) =>
    dragIdx === rad.antall - 1 && radIdx === konfig.rader.length - 1

  // Første gjennomløp: hvor mange pauser blir det egentlig? Trengs av LLSS,
  // som må vite totalen for å dele på midten.
  let antallPauser = 0
  konfig.rader.forEach((rad, ri) => {
    for (let i = 0; i < rad.antall; i++) {
      if (!erSistePause(ri, i, rad) && rad.pauseSek > 0) antallPauser++
    }
  })

  const blokker: GenerertBlokk[] = []
  if (konfig.oppvarmingSek > 0) {
    blokker.push({ sek: konfig.oppvarmingSek, sone: 'I1', rolle: 'oppvarming', type: 'oppvarming', posisjon: null })
  }

  let pauseNr = 0
  konfig.rader.forEach((rad, ri) => {
    for (let i = 0; i < rad.antall; i++) {
      if (rad.dragSek > 0) {
        blokker.push({ sek: rad.dragSek, sone: rad.sone, rolle: 'arbeid', type: 'aktivitet', posisjon: null })
      }
      if (erSistePause(ri, i, rad) || rad.pauseSek <= 0) continue

      const posisjon = posisjonForPause(konfig.skyting, pauseNr, antallPauser)
      pauseNr++
      if (!posisjon) {
        blokker.push({ sek: rad.pauseSek, sone: 'I1', rolle: 'pause', type: 'aktiv_pause', posisjon: null })
        continue
      }
      // Pkt 16: skytinga tar maks skytetidSek (≤ 60 s) av pausen; RESTEN av
      // pausen ligger som pause etter skytinga. Totaltida er uendret —
      // 3 min pause → 45 s skyting + 2:15 pause.
      const skytetid = Math.min(rad.pauseSek, Math.max(1, Math.min(SKYTETID_MAKS_SEK, konfig.skytetidSek ?? SKYTETID_STANDARD_SEK)))
      blokker.push({ sek: skytetid, sone: 'I1', rolle: 'pause', type: 'skyting_kombinert', posisjon })
      if (rad.pauseSek - skytetid > 0) {
        blokker.push({ sek: rad.pauseSek - skytetid, sone: 'I1', rolle: 'pause', type: 'aktiv_pause', posisjon: null })
      }
    }
  })

  if (konfig.nedjoggSek > 0) {
    blokker.push({ sek: konfig.nedjoggSek, sone: 'I1', rolle: 'nedjogg', type: 'nedjogg', posisjon: null })
  }
  return blokker.filter(b => b.sek > 0)
}

const erSkyting = (b: GenerertBlokk) => b.posisjon !== null

/** Bevegelsesform settes kun der aktivitetstypen faktisk bruker den. */
function bevegelseFor(type: ActivityType, konfig: IntervallKonfig) {
  const bruker = findActivityType(type)?.usesMovement ?? false
  return {
    movement_name: bruker ? konfig.bevegelsesform : '',
    movement_subcategory: bruker ? konfig.underkategori : '',
  }
}

function serie(posisjon: 'L' | 'S'): ShootingSeriesRow {
  return {
    id: crypto.randomUUID(),
    position: posisjon,
    shots: SKUDD_PER_SERIE,
    hits: '',
    time_seconds: '',
    avg_heart_rate: '',
    max_heart_rate: '',
    note: '',
    shot_plot: null,
    points: '',
    // Instansdata — føres på økta, aldri forhåndsutfylt.
    vind_retning: null,
    vind_styrke: null,
    sikt: null,
  }
}

/**
 * Skyterad. `shooting_type` står tom med vilje: konfigurasjonen sier hvilket
 * MØNSTER posisjonene følger, ikke hva slags skyting det er. Utøveren setter
 * det selv — å gjette «hard_komb» ville vært å finne på innhold.
 */
function skyterad(blokker: GenerertBlokk[]): ActivityRow {
  return {
    ...makeActivity({
      activity_type: 'skyting_kombinert',
      shooting_series: blokker.map(b => serie(b.posisjon as 'L' | 'S')),
    }),
    duration: sekTilKlokke(totalSekunder(blokker)),
    zones: { ...emptyActivityZones(), ...blokkerTilSoner(blokker) },
  }
}

/**
 * Konfigurasjon → ActivityRow[], klare til `activities`: én rad per blokk.
 *
 * Samlet form utgikk i Øktbygger bolk 4: radene legges alltid splittet,
 * og bryteren over radene samler like naborader i VISNINGEN. Skyting kan
 * uansett aldri slås sammen med bevegelsen — to ulike aktivitetstyper,
 * og bare den ene har bevegelsesform.
 */
export function genererIntervalløkt(konfig: IntervallKonfig): ActivityRow[] {
  const blokker = byggBlokker(konfig)
  if (blokker.length === 0) return []
  return blokker.map(b => (
    erSkyting(b)
      ? skyterad([b])
      : {
          ...makeActivity({ activity_type: b.type, ...bevegelseFor(b.type, konfig) }),
          duration: sekTilKlokke(b.sek),
          zones: { ...emptyActivityZones(), ...blokkerTilSoner([b]) },
        }
  ))
}
