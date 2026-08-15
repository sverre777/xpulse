import type { SupabaseClient } from '@supabase/supabase-js'

// AI/ML-trening: helper for å ekskludere Strava-importerte data fra
// modelltrening og aggregat-analyser som kan ende opp i ML-pipelines.
//
// Strava API Agreement § 2.14.4 forbyr eksplisitt bruk av Strava-data til
// AI/ML-trening eller LLM-fine-tuning. Vi sentraliserer ekskluderingen her
// så AI Coach (kommer Q3 2026) og fremtidige ML-features kan importere
// `excludeStravaImports` uten å duplisere logikken.
//
// ── PROVENANCE vs EIERSKAP — LES DETTE FØR DU ENDRER NOE HER ──
//
// To spørsmål som ser like ut, men ikke er det. De skal ha HVER SIN kilde:
//
//   1. PROVENANCE — «inneholder denne økta Strava-avledede data?»
//      Kilde: imported_activities (source='strava', workout_id).
//      Brukes HER, til AI/ML-ekskludering.
//      Hvorfor ikke imported_from: konflikt-sammenslåing («merge») skriver
//      Strava-samples og Strava-aggregater INN i en økt brukeren allerede
//      eide, og setter med vilje IKKE imported_from — økta er fortsatt
//      brukerens. imported_activities-raden skrives derimot alltid, av alle
//      importveier. Et filter på imported_from ville sluppet slike økter
//      rett inn i treningsdata.
//
//   2. EIERSKAP — «ble denne økta opprettet av importen?»
//      Kilde: workouts.imported_from.
//      Brukes av frakoblingen (/api/strava/disconnect, /api/polar/disconnect).
//      Hvorfor ikke imported_activities: en merget økt er brukerens egen og
//      skal BEHOLDES ved frakobling, med kun de importerte samplene fjernet.
//      Sletting basert på provenance ville slettet brukerens egne økter.
//
// Slår du disse to sammen igjen, får du enten et avtalebrudd (§ 2.14.4) eller
// sletting av brukerens egne data. De skal forbli adskilt.
//
// Bruk:
//   const stravaIds = await fetchStravaProvenanceIds(supabase, userId)
//   const trainingRows = excludeStravaImports(allWorkouts, stravaIds)

export interface AiTrainingRow {
  id: string
  imported_from?: string | null
}

// Alle workout-id-er som har Strava-provenance for én bruker: økter importert
// fra Strava OG økter Strava-data er flettet inn i.
//
// Feiler spørringen, kaster vi. Å returnere et tomt sett ville gitt et filter
// som stille slipper gjennom alt — det motsatte av det denne fila er til for.
export async function fetchStravaProvenanceIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('imported_activities')
    .select('workout_id')
    .eq('user_id', userId)
    .eq('source', 'strava')
    .not('workout_id', 'is', null)
  if (error) {
    throw new Error(`Kunne ikke hente Strava-provenance: ${error.message}`)
  }
  return new Set((data ?? []).map(r => r.workout_id as string))
}

// Filtrerer bort alle rader med Strava-provenance.
//
// `stravaWorkoutIds` er PÅKREVD med vilje: da kan ikke en fremtidig kaller
// skrive den utrygge varianten (filter på et felt én importvei kan ha glemt
// å sette). Hent settet med fetchStravaProvenanceIds.
//
// imported_from sjekkes i tillegg, ikke i stedet: to uavhengige signaler der
// begge kun kan ekskludere MER. Andre kilder (.fit-opplasting, Polar) er
// brukerens egne data og kan inngå i AI-trening med opt-in.
export function excludeStravaImports<T extends AiTrainingRow>(
  rows: T[],
  stravaWorkoutIds: ReadonlySet<string>,
): T[] {
  return rows.filter(r => !stravaWorkoutIds.has(r.id) && r.imported_from !== 'strava')
}

// Sanity-sjekk: skal returnere true hvis noen Strava-rader slipper gjennom et
// filter. Brukes i tests / dev-asserts før AI-pipelines.
export function containsStravaData<T extends AiTrainingRow>(
  rows: T[],
  stravaWorkoutIds: ReadonlySet<string>,
): boolean {
  return rows.some(r => stravaWorkoutIds.has(r.id) || r.imported_from === 'strava')
}
