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
  type OktMalDef,
} from './okt-template-library.ts'
import {
  makeActivity,
  type ActivityRow,
  type ActivityType,
  type ShootingSeriesRow,
  type Sport,
  type WorkoutFormData,
  type WorkoutTemplate,
} from './types.ts'

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
 * `workout_type` settes IKKE her. Økttypen hører til mal-fiksen, som skal
 * importere `OKT_MAL_TYPER` som fasit. Til da faller `materializeOktmalAtDate`
 * tilbake på 'long_run' for alt som ikke er test — bevisst, ikke glemt.
 */
export function oktMalTilTemplateInput(mal: OktMalDef, valg: OktMalKopiValg): {
  name: string
  description: string
  category?: string
  sport: Sport
  activities: ActivityRow[]
  templateData: Partial<WorkoutFormData>
  isTest: boolean
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
    times_used: 0,
    last_used_at: null,
    use_count: 0,
    created_at: naa,
    updated_at: naa,
  }
}
