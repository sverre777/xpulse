// Bibliotekmal → helt vanlig øktmal.
//
// Resultatet skal være umulig å skille fra en mal brukeren lagde selv. Det er
// ikke et nytt maltype-system: `oktMalTilTemplateInput` gir nøyaktig
// parameterne `saveAsTemplate` allerede tar, og lagringsveien er urørt.
//
// INGENTING LÅSES. Tittel, varighet, soner, bevegelsesform og struktur er
// fritt redigerbare etterpå. `locked: true` på en bibliotekmal betyr KUN at
// selve biblioteket ikke kan endres på plass — flagget følger aldri med inn
// i kopien, og det finnes ingen tilbakeskriving til malen. Formålet med hele
// biblioteket er at planlegging skal gå raskere; en sperre ville motarbeidet
// nettopp det.
//
// Blokkene finnes bare som KILDE til totalene. ActivityRow har ingen
// drag-modell, så én mal blir én aktivitetsrad — ikke én rad per blokk.

import {
  blokkerTilSoner,
  erTestMal,
  sekTilKlokke,
  totalSekunder,
  type Blokk,
  type OktMalDef,
} from './okt-template-library.ts'
import type { IntervallKonfig, SkyteMonster } from './intervall-generator.ts'
import {
  makeActivity,
  type ActivityRow,
  type ActivityType,
  type ShootingSeriesRow,
  type Sport,
  type WorkoutFormData,
  type WorkoutTemplate,
} from './types.ts'

/**
 * Økttype → workouts.workout_type. ÉN plass — brukes av materializeOktmalAtDate
 * og alt annet som skal stemple en økt fra malens type. Fasiten for venstresiden
 * er OKT_MAL_TYPER; høyresiden er WORKOUT_TYPES-enumen i lib/types.ts.
 * Komb-øktene peker på skytetypene (easy_combo/hard_combo) — det er samme
 * begrep i appen.
 */
export const OKT_TYPE_TIL_WORKOUT_TYPE: Record<string, string> = {
  rolig: 'easy',
  langkjoring: 'long_run',
  terskel: 'threshold',
  i4_intervall: 'interval',
  i5_intervall: 'interval',
  hurtighet: 'interval',
  motbakke: 'interval',
  fartslek: 'interval',
  lagtur: 'long_run',
  komb_rolig: 'easy_combo',
  komb_hard: 'hard_combo',
  test: 'test',
}

export function oktTypeToWorkoutType(oktType: string | null | undefined): string | null {
  if (!oktType) return null
  return OKT_TYPE_TIL_WORKOUT_TYPE[oktType] ?? null
}

/**
 * Normalisering for mal-søk: «6x6» skal treffe «6 × 6 min / 2 min».
 * × → x, alt av mellomrom ignoreres, små bokstaver. Brukes av mal-velgeren.
 */
export function normaliserMalSok(s: string): string {
  return s.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '')
}

export interface OktMalKopiValg {
  /** Idretten malen kopieres inn i. Bestemmer hva movement_name fylles med senere. */
  sport: Sport
  /** Overstyr tittelen. Default: malens navn, f.eks. «6 × 6 min / 2 min». */
  navn?: string
  /** Sport-kategori. NB: `category` holder SPORT, ikke økttype. */
  kategori?: string
}

/**
 * Blokkene → én aktivitetsrad, pluss en skyterad for kombene.
 *
 * `duration` og `zones` UTLEDES alltid av blokkene. Skriv aldri sonetotaler
 * for hånd noe sted — da kommer de i utakt med blokkene ved første endring.
 */
export function oktMalTilAktiviteter(mal: OktMalDef): ActivityRow[] {
  const rader: ActivityRow[] = [{
    ...makeActivity({
      activity_type: 'aktivitet',
      // TOM med vilje. Bevegelsesform er åpen — idrettens standard fyller
      // inn, og brukeren endrer den enkelt selv.
      movement_name: '',
    }),
    duration: sekTilKlokke(totalSekunder(mal.blokker)),
    zones: blokkerTilSoner(mal.blokker),
  }]

  if (mal.skyting) rader.push(skyteRad(mal.skyting))
  return rader
}

/**
 * Skytedelen for komb-øktene. Bruker den EKSISTERENDE veien —
 * `shooting_type` + `shooting_series` på en skyte-ActivityRow, samme mønster
 * som `generateCompetitionActivities`. Ingen ny modell.
 *
 * Serien får posisjon L/S annenhver med start på liggende, og 5 skudd, fordi
 * det er standardoppsettet. Begge deler er fritt redigerbare — poenget er at
 * utøveren skal slippe å opprette seriene selv.
 */
function skyteRad(skyting: NonNullable<OktMalDef['skyting']>): ActivityRow {
  const type: ActivityType =
    skyting.type === 'basisskyting' ? 'skyting_basis' : 'skyting_kombinert'

  const serier: ShootingSeriesRow[] = Array.from({ length: skyting.serier }, (_, i) => ({
    id: crypto.randomUUID(),
    position: i % 2 === 0 ? 'L' : 'S',
    shots: '5',
    hits: '',
    time_seconds: '',
    avg_heart_rate: '',
    max_heart_rate: '',
    note: '',
    shot_plot: null,
    points: '',
    // Instansdata — føres på økta, aldri i malen.
    vind_retning: null,
    vind_styrke: null,
    sikt: null,
  }))

  return makeActivity({
    activity_type: type,
    shooting_type: skyting.type,
    shooting_series: serier,
  })
}

/**
 * Parameterne `saveAsTemplate` tar. Dette er den ekte veien inn — kall
 * `saveAsTemplate(oktMalTilTemplateInput(mal, { sport }))`.
 *
 * Økttypen følger med som `oktType` (fase 97) — materializeOktmalAtDate
 * stempler økta via OKT_TYPE_TIL_WORKOUT_TYPE. Long_run-fallbacken er borte.
 */
export function oktMalTilTemplateInput(mal: OktMalDef, valg: OktMalKopiValg): {
  name: string
  description: string
  category?: string
  sport: Sport
  activities: ActivityRow[]
  templateData: Partial<WorkoutFormData>
  isTest: boolean
  oktType: string
} {
  return {
    name: valg.navn?.trim() || mal.navn,
    description: mal.notat,
    category: valg.kategori,
    sport: valg.sport,
    activities: oktMalTilAktiviteter(mal),
    templateData: {
      sport: valg.sport,
      movements: [],
      notes: mal.notat,
      tags: [],
      strength_type: '',
      location: '',
    },
    // Test-mal er en vanlig øktmal med flagg — ikke en egen type.
    isTest: erTestMal(mal),
    oktType: mal.type,
  }
}

/**
 * Ferdig `WorkoutTemplate` uten DB-runde — til forhåndsvisning og test.
 *
 * Merk at `locked` ikke finnes på WorkoutTemplate og aldri settes: en kopi er
 * en helt vanlig mal, og det er hele poenget.
 */
export function oktMalTilWorkoutTemplate(
  mal: OktMalDef,
  valg: OktMalKopiValg,
  meta?: { id?: string; user_id?: string; tidspunkt?: string },
): WorkoutTemplate {
  const input = oktMalTilTemplateInput(mal, valg)
  const naa = meta?.tidspunkt ?? new Date().toISOString()
  return {
    id: meta?.id ?? crypto.randomUUID(),
    user_id: meta?.user_id ?? '',
    name: input.name,
    description: input.description || null,
    category: input.category ?? null,
    sport: input.sport,
    activities: input.activities,
    template_data: input.templateData as WorkoutFormData,
    is_test: input.isTest,
    okt_type: mal.type,
    standard_session_series_id: null,
    times_used: 0,
    last_used_at: null,
    use_count: 0,
    created_at: naa,
    updated_at: naa,
  }
}

/**
 * Bibliotekmal → intervall-byggerens oppsett (blokker → rader).
 *
 * Malens blokker følger nøyaktig generatorens modell (verifisert for alle
 * 58: pauser er I1, strukturen er [opp] (arbeid pause?)* [ned]) — så
 * rekonstruksjonen er tapsfri: `byggBlokker` på resultatet gir malens
 * blokker tilbake, sekund for sekund. Selvtesten vokter rundturen.
 *
 * Skyting: komb-malene (mal.skyting) får mønsteret FORHÅNDSVALGT som 'LS'
 * (standardmønsteret) — endrebart i dialogen. Blokkene bærer ikke L/S selv,
 * så antall serier følger pausene, ikke mal.skyting.serier.
 */
export function oktMalTilIntervallOppsett(mal: OktMalDef): {
  oppvarmingSek: number
  nedjoggSek: number
  rader: IntervallKonfig['rader']
  skyting: SkyteMonster | null
} {
  const blokker = [...mal.blokker]
  const oppvarmingSek = blokker[0]?.rolle === 'oppvarming' ? blokker.shift()!.sek : 0
  const nedjoggSek = blokker[blokker.length - 1]?.rolle === 'nedjogg' ? blokker.pop()!.sek : 0

  // Arbeidsblokker med pausen som følger hver (null for den aller siste —
  // generatoren utelater den selv, og pausen MELLOM rader er forrige rads).
  const drag: { sek: number; sone: Blokk['sone']; pauseEtter: number | null }[] = []
  for (let i = 0; i < blokker.length; i++) {
    const b = blokker[i]
    if (b.rolle !== 'arbeid') continue
    const neste = blokker[i + 1]
    drag.push({ sek: b.sek, sone: b.sone, pauseEtter: neste?.rolle === 'pause' ? neste.sek : null })
  }

  const rader: IntervallKonfig['rader'] = []
  for (const d of drag) {
    const siste = rader[rader.length - 1]
    // Samme drag og samme pause (null = siste drag, arver gruppas pause).
    if (siste && siste.dragSek === d.sek && siste.sone === d.sone
      && (d.pauseEtter === null || d.pauseEtter === siste.pauseSek)) {
      siste.antall++
    } else {
      rader.push({ antall: 1, dragSek: d.sek, sone: d.sone, pauseSek: d.pauseEtter ?? 0 })
    }
  }

  return { oppvarmingSek, nedjoggSek, rader, skyting: mal.skyting ? 'LS' : null }
}
