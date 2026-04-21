// Forhåndsdefinerte styrke-øvelser per underkategori.
// Statisk — lagres ikke i DB. Brukes til quick-add-knapper i StrengthEditor
// og som sekundær kilde i autocomplete (etter brukerens eget bibliotek).

export const EXERCISE_PRESETS: Record<string, string[]> = {
  'Helkropp':             ['Knebøy', 'Markløft', 'Pull-ups', 'Push-ups', 'Rows', 'Clean & Press'],
  'Overkropp':            ['Benkpress', 'Pull-ups', 'Skulderpress', 'Rows', 'Dips', 'Chin-ups', 'Lateral raises'],
  'Underkropp':           ['Knebøy', 'Markløft', 'Frontsquat', 'Lunges', 'Romanian deadlift', 'Legg curl', 'Utfall'],
  'Mage/core':            ['Planke', 'Hanging leg raise', 'Russian twist', 'Ab wheel', 'Dead bug', 'Pallof press'],
  'Sirkel':               ['Burpees', 'Mountain climbers', 'Box jumps', 'Kettlebell swings'],
  'Maksstyrke':           ['Knebøy (tungt)', 'Markløft (tungt)', 'Benkpress (tungt)', 'Frontsquat', 'Skulderpress'],
  'Eksplosiv/Plyometri':  ['Box jumps', 'Broad jumps', 'Clean', 'Snatch', 'Plyometric push-ups'],
  'Spenst':               ['Strekkhopp', 'Hinkehopp', 'Drophopp', 'Squat jumps', 'Skip sprint'],
  'Stabilitet':           ['Single-leg deadlift', 'Pistol squat', 'Turkish get-up', 'Bird dog', 'Planke-variasjoner'],
}

export function presetsForCategory(category: string | null | undefined): string[] {
  if (!category) return []
  return EXERCISE_PRESETS[category] ?? []
}
