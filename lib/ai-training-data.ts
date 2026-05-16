// AI/ML-trening: helper for å ekskludere Strava-importerte data fra
// modelltrening og aggregat-analyser som kan ende opp i ML-pipelines.
//
// Strava API Agreement § 2.14.4 forbyr eksplisitt bruk av Strava-data til
// AI/ML-trening eller LLM-fine-tuning. Vi sentraliserer ekskluderingen her
// så AI Coach (kommer Q3 2026) og fremtidige ML-features kan importere
// `excludeStravaImports` uten å duplisere logikken.
//
// Bruk:
//   const trainingRows = excludeStravaImports(allWorkouts)
//   → trainingRows inneholder alle workouts UNNTATT imported_from='strava'

export interface AiTrainingRow {
  id: string
  imported_from?: string | null
}

// Filtrerer bort alle rader hvor imported_from peker på Strava.
// Andre kilder (.fit-opplasting, Garmin direkte når det kommer) er
// brukerens egne data og kan inngå i AI-trening med opt-in.
export function excludeStravaImports<T extends AiTrainingRow>(rows: T[]): T[] {
  return rows.filter(r => r.imported_from !== 'strava')
}

// Sanity-sjekk: skal returnere true hvis noen Strava-importerte rader
// slipper gjennom et filter. Brukes i tests / dev-asserts før AI-pipelines.
export function containsStravaData<T extends AiTrainingRow>(rows: T[]): boolean {
  return rows.some(r => r.imported_from === 'strava')
}
