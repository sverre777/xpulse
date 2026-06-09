// Standard styrke-øvelsesbibliotek (Fase 80).
// Statisk i kode — IKKE i DB. Hele systemet nøkler øvelser på fritekst-navn
// (workout_activity_exercises.exercise_name), så et seedet bibliotek gir mest
// verdi som en rik søkekilde i autocomplete, ved siden av brukerens eget
// user_exercises-bibliotek. Egne øvelser auto-upsertes fortsatt ved lagring.
//
// Kategoriene her er etter muskelgruppe/bevegelsesmønster (for søk/bla), mens
// «type økt» (Sirkel/Maksstyrke) fortsatt ligger på selve aktiviteten
// (movement_subcategory). De utholdenhetsspesifikke (staking, imitasjon,
// hoftestabilitet) er et reelt differensieringspunkt mot rene styrkeapper.

export type StandardExerciseCategory =
  | 'bein'
  | 'hofte'
  | 'press'
  | 'trekk'
  | 'core'
  | 'olympisk'
  | 'plyo'
  | 'prehab'
  | 'spesifikk'

export const STANDARD_EXERCISE_CATEGORIES: { key: StandardExerciseCategory; label: string }[] = [
  { key: 'bein',      label: 'Bein / forside lår' },
  { key: 'hofte',     label: 'Hofte / bakside / glutes' },
  { key: 'press',     label: 'Overkropp – press' },
  { key: 'trekk',     label: 'Overkropp – trekk' },
  { key: 'core',      label: 'Kjerne / core' },
  { key: 'olympisk',  label: 'Helkropp / olympisk' },
  { key: 'plyo',      label: 'Plyometrisk / spenst' },
  { key: 'prehab',    label: 'Stabilitet / mobilitet' },
  { key: 'spesifikk', label: 'Utholdenhetsspesifikk' },
]

export interface StandardExercise {
  name: string
  category: StandardExerciseCategory
}

export const STANDARD_EXERCISES: StandardExercise[] = [
  // ── Bein / forside lår ──────────────────────────────────
  { name: 'Knebøy', category: 'bein' },
  { name: 'Frontbøy', category: 'bein' },
  { name: 'Goblet squat', category: 'bein' },
  { name: 'Splitt-knebøy', category: 'bein' },
  { name: 'Bulgarsk utfall', category: 'bein' },
  { name: 'Gående utfall', category: 'bein' },
  { name: 'Utfall', category: 'bein' },
  { name: 'Beinpress', category: 'bein' },
  { name: 'Step-up', category: 'bein' },
  { name: 'Pistol squat', category: 'bein' },
  { name: 'Box squat', category: 'bein' },
  { name: 'Overhead squat', category: 'bein' },
  { name: 'Sissy squat', category: 'bein' },
  { name: 'Hack squat', category: 'bein' },
  { name: 'Zercher squat', category: 'bein' },
  { name: 'Beinekstensjon (maskin)', category: 'bein' },

  // ── Hofte / bakside / glutes ────────────────────────────
  { name: 'Markløft', category: 'hofte' },
  { name: 'Rumensk markløft', category: 'hofte' },
  { name: 'Sumo markløft', category: 'hofte' },
  { name: 'Strak-bein markløft', category: 'hofte' },
  { name: 'Hip thrust', category: 'hofte' },
  { name: 'Glute bridge', category: 'hofte' },
  { name: 'Good morning', category: 'hofte' },
  { name: 'Kettlebell swing', category: 'hofte' },
  { name: 'Nordic hamstring curl', category: 'hofte' },
  { name: 'Single-leg romersk markløft', category: 'hofte' },
  { name: 'Rygghev / hyperekstensjon', category: 'hofte' },
  { name: 'Baklår-curl (maskin)', category: 'hofte' },
  { name: 'Ettbens markløft', category: 'hofte' },

  // ── Overkropp – press ───────────────────────────────────
  { name: 'Benkpress', category: 'press' },
  { name: 'Skråbenk benkpress', category: 'press' },
  { name: 'Manualpress', category: 'press' },
  { name: 'Stående skulderpress', category: 'press' },
  { name: 'Push press', category: 'press' },
  { name: 'Militærpress', category: 'press' },
  { name: 'Push-ups', category: 'press' },
  { name: 'Dips', category: 'press' },
  { name: 'Smale push-ups', category: 'press' },
  { name: 'Pike push-up', category: 'press' },
  { name: 'Håndstående push-up', category: 'press' },
  { name: 'Triceps pushdown', category: 'press' },
  { name: 'Triceps extension', category: 'press' },
  { name: 'Sidehev (lateral raise)', category: 'press' },

  // ── Overkropp – trekk ───────────────────────────────────
  { name: 'Pull-ups', category: 'trekk' },
  { name: 'Chin-ups', category: 'trekk' },
  { name: 'Nedtrekk (lat pulldown)', category: 'trekk' },
  { name: 'Stående roing (barbell row)', category: 'trekk' },
  { name: '1-arm manualroing', category: 'trekk' },
  { name: 'Sittende kabelroing', category: 'trekk' },
  { name: 'T-bar row', category: 'trekk' },
  { name: 'Pendlay row', category: 'trekk' },
  { name: 'Inverted row', category: 'trekk' },
  { name: 'Face pull', category: 'trekk' },
  { name: 'Band pull-apart', category: 'trekk' },
  { name: 'Biceps curl', category: 'trekk' },
  { name: 'Hammer curl', category: 'trekk' },
  { name: 'Renegade row', category: 'trekk' },

  // ── Kjerne / core ───────────────────────────────────────
  { name: 'Planke', category: 'core' },
  { name: 'Sideplanke', category: 'core' },
  { name: 'Hollow hold', category: 'core' },
  { name: 'Dead bug', category: 'core' },
  { name: 'Bird dog', category: 'core' },
  { name: 'Pallof press', category: 'core' },
  { name: 'Ab wheel rollout', category: 'core' },
  { name: 'Hanging leg raise', category: 'core' },
  { name: 'Toes-to-bar', category: 'core' },
  { name: 'V-ups', category: 'core' },
  { name: 'Russian twist', category: 'core' },
  { name: 'Cable woodchop', category: 'core' },
  { name: 'Sit-ups', category: 'core' },
  { name: 'Crunch', category: 'core' },
  { name: 'Mountain climbers', category: 'core' },
  { name: 'L-sit', category: 'core' },
  { name: 'Skuldertapp-planke', category: 'core' },

  // ── Helkropp / olympisk ─────────────────────────────────
  { name: 'Frivending (clean)', category: 'olympisk' },
  { name: 'Power clean', category: 'olympisk' },
  { name: 'Hang clean', category: 'olympisk' },
  { name: 'Clean & jerk', category: 'olympisk' },
  { name: 'Rykk (snatch)', category: 'olympisk' },
  { name: 'Power snatch', category: 'olympisk' },
  { name: 'Thruster', category: 'olympisk' },
  { name: 'Wall ball', category: 'olympisk' },
  { name: 'Burpee', category: 'olympisk' },
  { name: 'Kettlebell clean', category: 'olympisk' },
  { name: 'Devil press', category: 'olympisk' },
  { name: 'Man maker', category: 'olympisk' },
  { name: 'Turkish get-up', category: 'olympisk' },
  { name: 'Snatch-grep markløft', category: 'olympisk' },

  // ── Plyometrisk / spenst ────────────────────────────────
  { name: 'Box jump', category: 'plyo' },
  { name: 'Knebøyhopp', category: 'plyo' },
  { name: 'Utfallshopp', category: 'plyo' },
  { name: 'Bredhopp (broad jump)', category: 'plyo' },
  { name: 'Skøytehopp (lateral bounds)', category: 'plyo' },
  { name: 'Tuck jump', category: 'plyo' },
  { name: 'Depth jump', category: 'plyo' },
  { name: 'Pogo hops', category: 'plyo' },
  { name: 'Ettbens hopp', category: 'plyo' },
  { name: 'Hekkhopp', category: 'plyo' },
  { name: 'Klapp-push-ups', category: 'plyo' },
  { name: 'Medisinball slam', category: 'plyo' },
  { name: 'Medisinball rotasjonskast', category: 'plyo' },
  { name: 'Sprint-akselerasjon', category: 'plyo' },

  // ── Stabilitet / mobilitet / prehab ─────────────────────
  { name: 'Sidehev hofte (abduksjon)', category: 'prehab' },
  { name: 'Monster walk (strikk)', category: 'prehab' },
  { name: 'Clamshell', category: 'prehab' },
  { name: 'Copenhagen plank (adduktor)', category: 'prehab' },
  { name: 'Ettbens balanse', category: 'prehab' },
  { name: 'Tåhev / leggheving (calf raise)', category: 'prehab' },
  { name: 'Single-leg calf raise', category: 'prehab' },
  { name: 'Wall sit', category: 'prehab' },
  { name: 'Bjørnegange (bear crawl)', category: 'prehab' },
  { name: 'Skulder Y-T-W', category: 'prehab' },
  { name: 'Tå- og hælgange', category: 'prehab' },
  { name: 'Tibialis-løft (skinnben)', category: 'prehab' },
  { name: 'Hoftebøyer-mobilitet', category: 'prehab' },

  // ── Utholdenhetsspesifikk (langrenn / ski / løp / skiskyting) ──
  { name: 'Staking med strikk', category: 'spesifikk' },
  { name: 'Staking med kabel', category: 'spesifikk' },
  { name: 'Stakemaskin (SkiErg)', category: 'spesifikk' },
  { name: 'Sittende stake-pulls', category: 'spesifikk' },
  { name: 'Dobbeldans-imitasjon', category: 'spesifikk' },
  { name: 'Diagonal-imitasjon med staver', category: 'spesifikk' },
  { name: 'Hoftebøyer-løft (løpsspesifikk)', category: 'spesifikk' },
  { name: 'A-skip', category: 'spesifikk' },
  { name: 'B-skip', category: 'spesifikk' },
  { name: 'Ankel/legg-hopp (stivhet)', category: 'spesifikk' },
  { name: 'Statisk holdning/balanse for skyting', category: 'spesifikk' },
  { name: 'Pust- og holdningsstabilitet', category: 'spesifikk' },
]

const NORMALIZE = (s: string) => s.trim().toLowerCase()

// Søk i standardbiblioteket på navn-substring. excludeNames (normalisert) lar
// kalleren droppe øvelser som allerede finnes i brukerens eget bibliotek/forslag.
export function searchStandardExercises(
  query: string,
  excludeNames: Set<string> = new Set(),
  limit = 8,
): StandardExercise[] {
  const q = NORMALIZE(query)
  if (!q) return []
  const out: StandardExercise[] = []
  for (const ex of STANDARD_EXERCISES) {
    if (excludeNames.has(NORMALIZE(ex.name))) continue
    if (NORMALIZE(ex.name).includes(q)) out.push(ex)
    if (out.length >= limit) break
  }
  return out
}
