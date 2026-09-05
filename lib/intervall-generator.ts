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
import { bevFelterFor } from './bevform-felter.ts'
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
  /** Drag planlagt i kilometer (Sverre 5. sep): dragSek er da regnet ut av
      km × fart, og raden får distanse. */
  dragKm?: number | null
  /** Planlagt fart som sekunder per km (min/km og km/t regnes om i UI). */
  fartSekPerKm?: number | null
  /** Kortintervall inni draget (50/10, 20/10 …) — merkes i grafen og tittelen. */
  kort?: { paaSek: number; avSek: number } | null
  /** Planlagt fart som tekst («4:00–3:30/km», «14–16 km/t») — følger raden
      som navn sammen med kortintervallet, så kartet viser den. */
  fartTekst?: string | null
  /** BOLK 27 (Sverre 5. sep): bev.form-spesifikke MÅL på draget
      (lib/bevform-felter). Lagres i radens egne felt: avg_watts (midtpunkt
      av spennet), incline_percent, resistance_level, avg_pace_seconds_per_km. */
  wattMaal?: number | null
  wattTekst?: string | null
  stigning?: number | null
  motstand?: string | null
}

/** Varighet for et drag i km ved planlagt fart. */
export function dragSekFraKm(km: number, fartSekPerKm: number): number {
  if (!(km > 0) || !(fartSekPerKm > 0)) return 0
  return Math.round(km * fartSekPerKm)
}

/** Radnavnet som bærer kortintervallet — kartet og tittelen leser det. */
export function kortNavn(kort: { paaSek: number; avSek: number } | null | undefined): string {
  return kort && kort.paaSek > 0 ? `${kort.paaSek}/${kort.avSek}` : ''
}

/** Radnavn = kortintervall og/eller planlagt fart («50/10 · 4:00–3:30/km»). */
export function radNavn(kort: { paaSek: number; avSek: number } | null | undefined, fartTekst?: string | null): string {
  return [kortNavn(kort), (fartTekst ?? '').trim()].filter(Boolean).join(' · ')
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
  /** Drag i km: distansen som følger raden. */
  km?: number | null
  /** Kortintervall inni draget. */
  kort?: { paaSek: number; avSek: number } | null
  fartTekst?: string | null
  /** BOLK 27: målene fra bev.form-feltene. */
  wattMaal?: number | null
  stigning?: number | null
  motstand?: string | null
  fartSekPerKm?: number | null
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
        blokker.push({ sek: rad.dragSek, sone: rad.sone, rolle: 'arbeid', type: 'aktivitet', posisjon: null,
          km: rad.dragKm && rad.dragKm > 0 ? rad.dragKm : null, kort: rad.kort && rad.kort.paaSek > 0 ? rad.kort : null, fartTekst: rad.fartTekst ?? null,
          wattMaal: rad.wattMaal ?? null, stigning: rad.stigning ?? null, motstand: rad.motstand ?? null, fartSekPerKm: rad.fartSekPerKm ?? null })
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
      // Bolk 24: L eller S er typen. Én blokk = én posisjon; skulle
      // blokkene blande L og S, er raden «Skyting L+S» (kombinert).
      activity_type: blokker.every(b => b.posisjon === 'L') ? 'skyting_liggende'
        : blokker.every(b => b.posisjon === 'S') ? 'skyting_staaende' : 'skyting_kombinert',
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
  const felter = bevFelterFor(konfig.bevegelsesform, konfig.underkategori)
  return blokker.map(b => (
    erSkyting(b)
      ? skyterad([b])
      : {
          ...makeActivity({ activity_type: b.type, ...bevegelseFor(b.type, konfig) }),
          duration: sekTilKlokke(b.sek),
          zones: { ...emptyActivityZones(), ...blokkerTilSoner([b]) },
          // Drag i km: distansen følger raden (farten leses av km/tid).
          ...(b.km ? { distance_km: String(b.km).replace('.', ',') } : {}),
          // Kortintervallet og den planlagte farten bæres av radnavnet
          // («50/10 · 4:00–3:30/km») — kartet striper/viser det, tittelen sier det.
          ...(radNavn(b.kort, b.fartTekst) ? { lap_notes: radNavn(b.kort, b.fartTekst) } : {}),
          // BOLK 27: bev.form-spesifikke mål i radens EGNE felt (ingen SQL).
          // Mølle: pace regnes fra fart (km/t); roing: fra split /500 m.
          ...(b.wattMaal && b.wattMaal > 0 ? { avg_watts: String(b.wattMaal) } : {}),
          ...(b.stigning != null && b.stigning > 0 ? { incline_percent: String(b.stigning).replace('.', ',') } : {}),
          ...(b.motstand ? { resistance_level: b.motstand } : {}),
          ...(b.fartSekPerKm && b.fartSekPerKm > 0 && (felter.fart === 'kmt' || felter.split500)
            ? { avg_pace_seconds_per_km: String(b.fartSekPerKm), ...(felter.fart === 'kmt' ? { pace_unit_preference: 'km_per_h' as const } : {}) }
            : {}),
        }
  ))
}
