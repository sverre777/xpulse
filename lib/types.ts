export type Role = 'athlete' | 'coach'
export type Sport =
  | 'running' | 'cross_country_skiing' | 'biathlon'
  | 'triathlon' | 'cycling' | 'long_distance_skiing' | 'endurance'

export type WorkoutType =
  | 'long_run' | 'interval' | 'threshold' | 'easy' | 'competition' | 'testlop' | 'test' | 'recovery' | 'technical' | 'other'
  | 'hard_combo' | 'easy_combo' | 'basis_shooting' | 'warmup_shooting'

// ── Lookup arrays ──────────────────────────────────────────

export const SPORTS: { value: Sport; label: string }[] = [
  { value: 'running',              label: 'Løping' },
  { value: 'cross_country_skiing', label: 'Langrenn' },
  { value: 'biathlon',             label: 'Skiskyting' },
  { value: 'triathlon',            label: 'Triatlon' },
  { value: 'cycling',              label: 'Sykling' },
  { value: 'long_distance_skiing', label: 'Langløp' },
  { value: 'endurance',            label: 'Utholdenhet (generelt)' },
]

export const WORKOUT_TYPES_BASE: { value: WorkoutType; label: string }[] = [
  { value: 'long_run',    label: 'Langtur' },
  { value: 'interval',    label: 'Intervall' },
  { value: 'threshold',   label: 'Terskel' },
  { value: 'easy',        label: 'Rolig' },
  { value: 'competition', label: 'Konkurranse' },
  { value: 'testlop',     label: 'Testløp' },
  { value: 'test',        label: 'Test / protokoll' },
  { value: 'recovery',    label: 'Restitusjon' },
  { value: 'technical',   label: 'Teknisk' },
  { value: 'other',       label: 'Annet' },
]

export const WORKOUT_TYPES_BIATHLON: { value: WorkoutType; label: string }[] = [
  ...WORKOUT_TYPES_BASE,
  { value: 'hard_combo',      label: 'Hard kombinasjon' },
  { value: 'easy_combo',      label: 'Rolig kombinasjon' },
  { value: 'basis_shooting',  label: 'Basisskyting' },
  { value: 'warmup_shooting', label: 'Innskyting' },
]

export function getWorkoutTypes(sport: Sport) {
  return sport === 'biathlon' ? WORKOUT_TYPES_BIATHLON : WORKOUT_TYPES_BASE
}

export const INTENSITY_ZONES = ['I1','I2','I3','I4','I5','I6','I7','I8']

export const SHOOTING_WORKOUT_TYPES: WorkoutType[] = [
  'hard_combo','easy_combo','basis_shooting','warmup_shooting'
]

export const ENDURANCE_MOVEMENT_NAMES = [
  'Løping','Langrenn','Rulleski','Sykling','Svømming',
  'Fjellsport','Roing','Kajak/Padling','Orientering','Skøyter',
]

const SKI_SUBCATEGORIES = [
  'Skøyting','Klassisk','Skøyting uten staver','Klassisk uten staver','Staking',
]

// ── Movement categories with subcategories ─────────────────

export interface MovementCategory {
  name: string
  subcategories?: string[]
}

const TUR_SUBCATEGORIES = [
  'Fjelltur', 'Skogstur', 'Fjellski', 'Fjellski med pulk',
  'Topptur', 'Skitur', 'Snøskotur', 'Ekspedisjon/flerdagers',
]

// Tur-underkategorier som normalt involverer pulk. Pulkvekt-feltet vises
// kun for disse.
export const TUR_SUBCATEGORIES_WITH_SLED = new Set<string>([
  'Fjellski med pulk', 'Ekspedisjon/flerdagers',
])

// Sortert: utholdenhet først (mest brukt), deretter styrke, deretter resten.
// Triathlon er ikke en bevegelsesform — det er en sport (se Sport) og håndteres
// via Triathlon-modulen med segmenter (svøm/T1/sykkel/T2/løp).
export const MOVEMENT_CATEGORIES: MovementCategory[] = [
  // Utholdenhet
  { name: 'Løping',         subcategories: ['Terreng','Asfalt','Grus','Tredemølle','Bane','Crosscountry'] },
  { name: 'Sykling',        subcategories: ['Landevei','Terreng/MTB','Gravel','Indoors/Ergo'] },
  { name: 'Svømming',       subcategories: ['Basseng','Åpent vann'] },
  { name: 'Langrenn',       subcategories: SKI_SUBCATEGORIES },
  { name: 'Rulleski',       subcategories: SKI_SUBCATEGORIES },
  { name: 'Skøyter' },
  { name: 'Roing' },
  { name: 'Kajak/Padling' },
  { name: 'Orientering' },
  { name: 'Fjellsport',     subcategories: ['Fjellvandring','Rando/Skitour','Topptur','Brevandring'] },
  { name: 'Tur',            subcategories: TUR_SUBCATEGORIES },
  // Styrke
  { name: 'Styrke',         subcategories: ['Maksstyrke','Eksplosiv','Basis','Utholdenstyrke'] },
  // Resten
  { name: 'Yoga' },
  { name: 'Klatring' },
  { name: 'Dans' },
  { name: 'Alpint' },
  { name: 'Telemark' },
  { name: 'Snowboard' },
  { name: 'Crossfit' },
  { name: 'Kampsport' },
]

// Værforhold-valg for tur-aktiviteter.
export const WEATHER_OPTIONS: string[] = [
  'Sol', 'Delvis skyet', 'Overskyet', 'Snø', 'Regn', 'Vind', 'Tåke',
]

export function getSubcategories(name: string): string[] {
  return MOVEMENT_CATEGORIES.find(m => m.name === name)?.subcategories ?? []
}

export const DEFAULT_MOVEMENTS_BY_SPORT: Record<Sport, string[]> = {
  running:              ['Løping', 'Sykling', 'Styrke'],
  cross_country_skiing: ['Langrenn', 'Rulleski', 'Løping', 'Styrke'],
  biathlon:             ['Langrenn', 'Rulleski', 'Løping', 'Styrke'],
  triathlon:            ['Svømming', 'Sykling', 'Løping', 'Styrke'],
  cycling:              ['Sykling', 'Løping', 'Styrke'],
  long_distance_skiing: ['Langrenn', 'Rulleski', 'Løping', 'Styrke'],
  endurance:            ['Løping', 'Sykling', 'Svømming', 'Styrke'],
}

// ── Shooting types ─────────────────────────────────────────

export type ShootingBlockType = 'rolig_komb' | 'hurtighet_komb' | 'hard_komb' | 'innskyting' | 'basisskyting' | 'konkurranse'

export const SHOOTING_BLOCK_TYPES: { value: ShootingBlockType; label: string }[] = [
  { value: 'rolig_komb',      label: 'Rolig komb' },
  { value: 'hurtighet_komb',  label: 'Hurtighet komb' },
  { value: 'hard_komb',       label: 'Hard komb' },
  { value: 'innskyting',      label: 'Innskyting' },
  { value: 'basisskyting',    label: 'Basisskyting' },
  { value: 'konkurranse',     label: 'Konkurranse' },
]

export interface ShootingBlock {
  id: string
  shooting_type: ShootingBlockType | ''
  prone_shots: string
  prone_hits: string
  standing_shots: string
  standing_hits: string
  // Nye felt (alle valgfrie):
  start_time: string       // HH:MM – når serien ble skutt (for pulssync)
  duration_seconds: string // MM:SS parses til total sekunder
  avg_heart_rate: string   // bpm
}

// ── Form data types ────────────────────────────────────────

export interface MovementRow {
  id: string
  movement_name: string      // e.g. "Løping" or "Løping — Terreng"
  minutes: string
  distance_km: string
  elevation_meters: string
  avg_heart_rate: string
  zones: ZoneRow[]           // inline zones for this movement
  exercises: ExerciseRow[]   // inline exercises for this movement (strength)
}

export interface ZoneRow {
  zone_name: string
  minutes: string
}

export interface ExerciseRow {
  id: string
  exercise_name: string
  sets: string
  reps: string
  weight_kg: string
}

export interface LactateRow {
  id: string
  measured_at_time: string
  mmol: string
  heart_rate: string
  feeling: number | null
}

export interface WorkoutFormData {
  title: string
  date: string
  time_of_day: string
  sport: Sport
  workout_type: WorkoutType
  is_planned: boolean
  is_completed: boolean
  is_important: boolean
  // Enkel føring: brukes når økten ikke har aktiviteter (eller som minimumsregistrering
  // for gamle/importerte økter). Lagres til workouts.duration_minutes / distance_km.
  // Når aktiviteter finnes overstyrer aktivitets-summen disse i visning.
  simple_duration_minutes: string
  simple_distance_km: string
  movements: MovementRow[]
  zones: ZoneRow[]
  exercises: ExerciseRow[]
  strength_type: string
  lactate: LactateRow[]
  day_form_physical: number | null
  day_form_mental: number | null
  rpe: number | null
  notes: string
  tags: string[]
  // Skiskyting: serie-basert skyting på top-nivå (kun synlig når sport='biathlon')
  shooting_blocks: ShootingBlock[]
  // Fase 7: kronologisk aktivitets-liste — erstatter movements + zones + shooting_blocks i UI.
  activities: ActivityRow[]
  // Plan-referanse i Dagbok-modus: frosset snapshot av planlagte aktiviteter.
  // Ikke persistert via saveWorkout; kun lest for sammenligning plan vs faktisk.
  planned_activities?: ActivityRow[]
  // Fase 8: kontekst + resultat for konkurranse/testløp (egen tabell).
  // Kun relevant når workout_type='competition' eller 'testlop'.
  competition_data?: CompetitionData
  // Fase 14: kobling til mal brukt ved opprettelse/planlegging.
  // template_id = null når økten ikke er basert på mal. template_name er
  // denormalisert for enklere lesing uten join.
  template_id?: string | null
  template_name?: string | null
  // Fase 31: strukturert test-resultat (kun relevant når workout_type='test').
  // Lagres i workout_test_data som egen rad per workout.
  test_data?: TestData
}

// ── Test-økter (Fase 31) ───────────────────────────────────

export interface TestData {
  // sport er Test/PR-sport (TestPRSport — Løping, Sykling, Styrke, …),
  // ikke nødvendigvis lik workout.sport.
  sport: TestPRSport | ''
  subcategory: string
  custom_label: string
  // Legacy/avledet ID for testen (auto-utledes fra subcategory/custom_label).
  test_type: string
  // Primærresultat (typisk tid i sek, watt, vo2max, 1RM kg, etc.)
  primary_result: string
  primary_unit: string
  secondary_results: Record<string, string>
  protocol_notes: string
  equipment: string
  conditions: string
}

export function emptyTestData(): TestData {
  return {
    sport: '',
    subcategory: '',
    custom_label: '',
    test_type: '',
    primary_result: '',
    primary_unit: '',
    secondary_results: {},
    protocol_notes: '',
    equipment: '',
    conditions: '',
  }
}

// Sport-spesifikke standard tester (forslag i dropdown).
export const TEST_TYPES_BY_SPORT: Record<Sport, { value: string; label: string; unit: string }[]> = {
  running:              [
    { value: '5km_tt',    label: '5 km tempo-test',      unit: 'tid' },
    { value: '10km_tt',   label: '10 km tempo-test',     unit: 'tid' },
    { value: 'vo2max',    label: 'VO2max (labtest)',     unit: 'ml/kg/min' },
    { value: 'lt2',       label: 'LT2 / terskel',        unit: 'km/t' },
    { value: 'cooper',    label: 'Cooper (12 min)',      unit: 'meter' },
  ],
  cross_country_skiing: [
    { value: 'rulleski_motbakke', label: 'Rulleski motbakke', unit: 'tid' },
    { value: 'vo2max',            label: 'VO2max (labtest)',  unit: 'ml/kg/min' },
    { value: 'lt2',               label: 'LT2 / terskel',     unit: 'watt' },
  ],
  biathlon:             [
    { value: 'standplass_10',  label: 'Standplass 10×liggende/stående', unit: 'treff' },
    { value: 'vo2max',         label: 'VO2max (labtest)',     unit: 'ml/kg/min' },
  ],
  cycling:              [
    { value: 'ftp_20',    label: 'FTP (20-min)',         unit: 'watt' },
    { value: 'ftp_ramp',  label: 'FTP (ramp test)',      unit: 'watt' },
    { value: 'vo2max',    label: 'VO2max (labtest)',     unit: 'ml/kg/min' },
  ],
  triathlon:            [
    { value: 'ftp_20',    label: 'FTP (20-min)',         unit: 'watt' },
    { value: 'swim_400',  label: '400 m svøm',           unit: 'tid' },
    { value: '5km_tt',    label: '5 km løp-test',        unit: 'tid' },
  ],
  long_distance_skiing: [
    { value: 'langtur',   label: 'Langtur-test',         unit: 'tid' },
    { value: 'vo2max',    label: 'VO2max (labtest)',     unit: 'ml/kg/min' },
  ],
  endurance:            [
    { value: 'vo2max',    label: 'VO2max (labtest)',     unit: 'ml/kg/min' },
    { value: 'lt2',       label: 'LT2 / terskel',        unit: 'watt' },
    { value: '1rm',       label: '1RM styrke',           unit: 'kg' },
  ],
}

// ── Test/PR sport + underkategori (felles for Dagbok og Analyse) ─
//
// Egen modell for Test/PR-skjema. Skiller seg fra Sport-typen over
// ved at den dekker hele bredden av disipliner brukerne logger PR i
// (ikke bare utholdenhetssporter), og ved at hver sport har sine
// egne underkategorier. "Egen"/"Annet" → fritekst-felt (custom_label).
export type TestPRSport =
  | 'lop' | 'sykling' | 'svomming' | 'langrenn' | 'skiskyting'
  | 'triathlon' | 'styrke' | 'spenst' | 'skyting' | 'annet'

export interface TestPRSportDef {
  value: TestPRSport
  label: string
  // Underkategorier vises som dropdown. Tom liste = kun fritekst.
  subcategories: string[]
}

// "Egen" er standardverdi for fritekst-overstyring i hver sport
// med dropdown. "Annet" har kun fritekst (ingen dropdown).
export const TEST_PR_SPORTS_AND_SUBCATEGORIES: TestPRSportDef[] = [
  { value: 'lop',        label: 'Løping',
    subcategories: ['Vei', 'Terreng', 'Bane', 'Tredemølle', 'Egen'] },
  { value: 'sykling',    label: 'Sykling',
    subcategories: ['Landevei', 'Terreng', 'Innendørs', 'Egen'] },
  { value: 'svomming',   label: 'Svømming',
    subcategories: ['Basseng (25m)', 'Basseng (50m)', 'Åpent vann', 'Egen'] },
  { value: 'langrenn',   label: 'Langrenn',
    subcategories: ['Skøyting', 'Klassisk', 'Rulleski skøyting', 'Rulleski klassisk', 'Egen'] },
  { value: 'skiskyting', label: 'Skiskyting',
    subcategories: ['Sprint', 'Jaktstart', 'Normal', 'Fellesstart', 'Egen'] },
  { value: 'triathlon',  label: 'Triathlon',
    subcategories: ['Sprint', 'Olympisk', 'Halv Ironman', 'Ironman', 'Egen'] },
  { value: 'styrke',     label: 'Styrke',
    subcategories: [
      'Helkropp', 'Overkropp', 'Underkropp',
      'Knebøy 1RM', 'Markløft 1RM', 'Benkpress 1RM', 'Pull-ups maks reps',
      'Egen',
    ] },
  { value: 'spenst',     label: 'Spenst/hopp',
    subcategories: ['CMJ', 'Stående lengde', 'Stående høyde', '30m sprint', 'Egen'] },
  { value: 'skyting',    label: 'Skyting',
    subcategories: ['Liggende', 'Stående', 'Standardøvelse', 'Egen'] },
  { value: 'annet',      label: 'Annet',
    subcategories: [] },
]

export function findTestPRSport(value: string): TestPRSportDef | null {
  return TEST_PR_SPORTS_AND_SUBCATEGORIES.find(s => s.value === value) ?? null
}

// ── Activities (Fase 7) ────────────────────────────────────

export type ActivityType =
  | 'oppvarming' | 'aktivitet' | 'pause' | 'aktiv_pause'
  | 'skyting_liggende' | 'skyting_staaende' | 'skyting_kombinert'
  | 'skyting_innskyting' | 'skyting_basis'
  | 'nedjogg' | 'annet'

export interface ActivityTypeOption {
  value: ActivityType
  label: string
  icon: string
  usesMovement: boolean      // om bevegelsesform-dropdown skal vises
  isShooting: boolean
  biathlonOnly: boolean
}

export const ACTIVITY_TYPES: ActivityTypeOption[] = [
  { value: 'oppvarming',        label: 'Oppvarming',         icon: '🔥', usesMovement: true,  isShooting: false, biathlonOnly: false },
  { value: 'aktivitet',         label: 'Aktivitet',          icon: '⚡', usesMovement: true,  isShooting: false, biathlonOnly: false },
  { value: 'pause',             label: 'Pause',              icon: '⏸',  usesMovement: false, isShooting: false, biathlonOnly: false },
  { value: 'aktiv_pause',       label: 'Aktiv pause',        icon: '🚶', usesMovement: true,  isShooting: false, biathlonOnly: false },
  { value: 'skyting_liggende',  label: 'Skyting — Liggende', icon: '🎯', usesMovement: false, isShooting: true,  biathlonOnly: true  },
  { value: 'skyting_staaende',  label: 'Skyting — Stående',  icon: '🎯', usesMovement: false, isShooting: true,  biathlonOnly: true  },
  { value: 'skyting_kombinert', label: 'Skyting — Kombinert',icon: '🎯', usesMovement: false, isShooting: true,  biathlonOnly: true  },
  { value: 'skyting_innskyting',label: 'Skyting — Innskyting',icon: '🎯', usesMovement: false, isShooting: true,  biathlonOnly: true  },
  { value: 'skyting_basis',     label: 'Skyting — Basisskyting',icon: '🎯', usesMovement: false, isShooting: true,  biathlonOnly: true  },
  { value: 'nedjogg',           label: 'Nedjogg',            icon: '🏁', usesMovement: true,  isShooting: false, biathlonOnly: false },
  { value: 'annet',             label: 'Annet',              icon: '•',  usesMovement: false, isShooting: false, biathlonOnly: false },
]

export function findActivityType(v: ActivityType): ActivityTypeOption | null {
  return ACTIVITY_TYPES.find(t => t.value === v) ?? null
}

// Sub-kategorier per bevegelsesform (valgfri). Brukes i ActivitiesSection-dropdown.
// Styrke har egen struktur og håndteres ikke her (se STRENGTH_SUBCATEGORIES).
export const ACTIVITY_SUBCATEGORIES: Record<string, string[]> = {
  Langrenn:         ['Skøyting', 'Klassisk', 'Skøyting uten staver', 'Klassisk uten staver', 'Staking'],
  Rulleski:         ['Skøyting', 'Klassisk', 'Skøyting uten staver', 'Klassisk uten staver', 'Staking'],
  Løping:           ['Terreng', 'Vei', 'Bane', 'Motbakke', 'Tredemølle'],
  Sykling:          ['Landevei', 'Terreng', 'Gravel', 'Innendørs/rulle', 'Bane', 'Tempo'],
  Svømming:         ['Basseng', 'Åpent vann', 'Crawl', 'Bryst', 'Rygg', 'Butterfly', 'Variert'],
  Roing:            ['Ergometer', 'Vann', 'Singelsculler', 'Dobbelsculler', 'Firer', 'Åtter'],
  Padling:          ['Kajakk', 'Kano', 'SUP', 'Havkajakk', 'Sprintkajakk'],
  'Kajak/Padling':  ['Kajakk', 'Kano', 'SUP', 'Havkajakk', 'Sprintkajakk'],
  Fjellsport:       ['Topptur', 'Fjellvandring', 'Randonee', 'Brevandring', 'Klatring', 'Isklatring', 'Via ferrata', 'Fjellløp'],
  Skøyter:          ['Sprint', 'Allround', 'Langdistanse'],
  Orientering:      ['Skog', 'Sprint', 'Nattorientering', 'Ski-O', 'MTB-O'],
  Turgåing:         ['Rolig tur', 'Rask gange', 'Rulleski-tur'],
  Tur:              TUR_SUBCATEGORIES,
  Yoga:             ['Hatha', 'Vinyasa', 'Yin', 'Restorativ', 'Mobility'],
}

export const STRENGTH_SUBCATEGORIES = [
  'Helkropp', 'Overkropp', 'Underkropp', 'Mage/core', 'Sirkel',
  'Maksstyrke', 'Eksplosiv/Plyometri', 'Spenst', 'Spesifikk', 'Stabilitet',
]

// Utholdenhetsformer som får sone-fordeling inline.
export const ENDURANCE_ACTIVITY_MOVEMENTS = new Set<string>([
  'Løping', 'Langrenn', 'Rulleski', 'Sykling', 'Svømming',
  'Roing', 'Padling', 'Kajak/Padling', 'Fjellsport', 'Skøyter',
  'Orientering', 'Turgåing', 'Tur',
])

export function isEnduranceMovement(name: string | null | undefined): boolean {
  return !!name && ENDURANCE_ACTIVITY_MOVEMENTS.has(name)
}

export function isStrengthMovement(name: string | null | undefined): boolean {
  return name === 'Styrke'
}

// Sonefordeling for én aktivitet: minutter per sone (string for input-binding).
// Hurtighet er en 6. sone for eksplosive drag — føres manuelt, beregnes ikke
// fra puls.
export interface ActivityZoneMinutes {
  I1: string
  I2: string
  I3: string
  I4: string
  I5: string
  Hurtighet: string
}

export function emptyActivityZones(): ActivityZoneMinutes {
  return { I1: '', I2: '', I3: '', I4: '', I5: '', Hurtighet: '' }
}

// Laktatmåling i en aktivitet (én av flere).
export interface ActivityLactateMeasurement {
  id: string
  db_id?: string
  value_mmol: string
  measured_at: string  // HH:MM — valgfritt
}

// Styrke-øvelse med sett.
export interface StrengthSetRow {
  id: string
  db_id?: string
  set_number: string
  reps: string
  weight_kg: string
  rpe: string
  notes: string
}

export interface StrengthExerciseRow {
  id: string
  db_id?: string
  exercise_name: string
  notes: string
  sets: StrengthSetRow[]
}

// Form-row — alle tall-felt som string for input-binding.
// distance_km holdes som km i skjemaet; konverteres til meter ved lagring.
// Pace-enhet for visning og inntasting. Lagres kanonisk som sekunder per km
// (avg_pace_seconds_per_km), men *visningsenheten* huskes per aktivitet via
// pace_unit_preference. Tom streng = bruker brukerens default_pace_unit.
export type PaceUnitPref = 'min_per_km' | 'km_per_h'

// En split per km — radvis i splits_per_km (jsonb i DB). Form-radens felter er
// strings for input-binding; konverteres til {km:int, seconds:int} ved lagring.
export interface SplitRow {
  id: string
  db_km?: number              // Hvis lest fra DB
  km: string                  // 1, 2, 3, …
  duration: string            // MM:SS for *denne* km'en
}

export interface ActivityRow {
  id: string                   // client-side key (uuid)
  db_id?: string               // DB-id hvis lastet fra DB
  activity_type: ActivityType
  movement_name: string
  movement_subcategory: string // Valgfri underkategori (f.eks. "Terreng", "Skøyting"). For Styrke: kategori (Helkropp osv).
  start_time: string           // HH:MM
  duration: string             // MM:SS eller HH:MM:SS
  distance_km: string
  avg_heart_rate: string
  max_heart_rate: string
  avg_watts: string
  // Snittpace lagres som tekst slik brukeren tastet — rå-streng formatert via
  // PaceInput. Konverteres til avg_pace_seconds_per_km ved lagring.
  avg_pace_seconds_per_km: string
  // Visningsenhet for *denne* radens pace. Tom streng = bruk brukerens default.
  pace_unit_preference: PaceUnitPref | ''
  // Splits per km — kollapsbart. Tomt array når ingen splits er ført.
  splits_per_km: SplitRow[]
  prone_shots: string
  prone_hits: string
  standing_shots: string
  standing_hits: string
  // Høydemeter — valgfritt, tilgjengelig for alle utholdenhetsbevegelser.
  elevation_gain_m: string
  elevation_loss_m: string
  // Stigning i prosent — vises kun når movement_name='Løping' og movement_subcategory='Tredemølle'.
  incline_percent: string
  // Tur-spesifikke felt — vises kun når movement_name='Tur'.
  pack_weight_kg: string
  sled_weight_kg: string   // kun relevant for "Fjellski med pulk" / "Ekspedisjon/flerdagers"
  weather: string
  temperature_c: string
  notes: string
  // Sone-fordeling i minutter (I1..I5). Brukes kun for utholdenhetsbevegelser.
  zones: ActivityZoneMinutes
  // Styrke-øvelser. Brukes kun når movement_name='Styrke'.
  exercises: StrengthExerciseRow[]
  // Laktatmålinger (én eller flere per aktivitet).
  lactate_measurements: ActivityLactateMeasurement[]
}

// DB-entity
export interface WorkoutActivity {
  id: string
  workout_id: string
  activity_type: ActivityType
  movement_name: string | null
  movement_subcategory: string | null
  sort_order: number
  start_time: string | null
  duration_seconds: number
  distance_meters: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  avg_watts: number | null
  // Pace per km — kanonisk lagring i sekunder. Splits er en jsonb-array av
  // {km:int, seconds:int} der hver entry er én km. pace_unit_preference styrer
  // hvordan verdien vises tilbake til brukeren.
  avg_pace_seconds_per_km: number | null
  splits_per_km: { km: number; seconds: number }[] | null
  pace_unit_preference: PaceUnitPref | null
  lactate_mmol: number | null
  lactate_measured_at: string | null
  prone_shots: number | null
  prone_hits: number | null
  standing_shots: number | null
  standing_hits: number | null
  elevation_gain_m: number | null
  elevation_loss_m: number | null
  pack_weight_kg: number | null
  sled_weight_kg: number | null
  weather: string | null
  temperature_c: number | null
  notes: string | null
  zones: Record<string, number> | null
  created_at: string
}

export interface WorkoutActivityExercise {
  id: string
  activity_id: string
  exercise_name: string
  sort_order: number
  notes: string | null
  created_at: string
}

export interface WorkoutActivityLactateMeasurement {
  id: string
  activity_id: string
  value_mmol: number
  measured_at: string | null
  sort_order: number
  created_at: string
}

export interface WorkoutActivityExerciseSet {
  id: string
  exercise_id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  notes: string | null
  created_at: string
}

// ── DB entity types ────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  full_name: string | null
  // Legacy — beholdt for bakoverkompatibilitet. Ny logikk skal bruke
  // has_athlete_role/has_coach_role + active_role.
  role: Role
  has_athlete_role: boolean
  has_coach_role: boolean
  active_role: Role
  primary_sport: Sport | null
  avatar_url: string | null
  birth_year: number | null
  max_heart_rate: number | null
  lactate_threshold_hr: number | null
  resting_heart_rate: number | null
  // Foretrukket visningsenhet for fart/pace. null → bruker default 'min_per_km'.
  default_pace_unit: PaceUnitPref | null
  // Fase 34: brukerkonto-innstillinger (profil/sikkerhet/enheter/varsler/GDPR)
  first_name: string | null
  last_name: string | null
  profile_image_url: string | null
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
  country: string | null
  email_change_pending: string | null
  email_change_requested_at: string | null
  default_distance_unit: 'km' | 'mi' | null
  default_temperature_unit: 'c' | 'f' | null
  default_weight_unit: 'kg' | 'lb' | null
  notify_email_coach_comment: boolean
  notify_email_new_message: boolean
  notify_email_plan_pushed: boolean
  notify_email_weekly_summary: boolean
  notify_email_product_updates: boolean
  deletion_requested_at: string | null
  created_at: string
  updated_at: string
}

export interface CoachAthleteRelation {
  id: string
  coach_id: string
  athlete_id: string
  status: 'pending' | 'active' | 'inactive'
  created_at: string
}

export interface WorkoutMovement {
  id: string
  workout_id: string
  movement_name: string
  minutes: number | null
  distance_km: number | null
  elevation_meters: number | null
  avg_heart_rate: number | null
  inline_zones: { zone_name: string; minutes: number }[] | null
  inline_exercises: { exercise_name: string; sets: number | null; reps: number | null; weight_kg: number | null }[] | null
  sort_order: number
}

export interface WorkoutZone {
  id: string
  workout_id: string
  zone_name: string
  minutes: number
  sort_order: number
}

export interface WorkoutTag {
  id: string
  workout_id: string
  tag: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_name: string
  sets: number | null
  reps: number | null
  weight_kg: number | null
  notes: string | null
  sort_order: number
}

export interface WorkoutLactate {
  id: string
  workout_id: string
  measured_at_time: string | null
  mmol: number
  heart_rate: number | null
  feeling: number | null
  sort_order: number
}

export interface Workout {
  id: string
  user_id: string
  title: string
  description: string | null
  sport: Sport
  workout_type: WorkoutType
  date: string
  time_of_day: string | null
  duration_minutes: number | null
  distance_km: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  elevation_meters: number | null
  notes: string | null
  is_planned: boolean
  is_completed: boolean
  is_important: boolean
  planned_workout_id: string | null
  day_form_physical: number | null
  day_form_mental: number | null
  rpe: number | null
  coach_comment: string | null
  shooting_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
  workout_movements?: WorkoutMovement[]
  workout_zones?: WorkoutZone[]
  workout_tags?: WorkoutTag[]
  workout_exercises?: WorkoutExercise[]
  workout_lactate_measurements?: WorkoutLactate[]
}

export interface DailyHealth {
  id: string
  user_id: string
  date: string
  resting_hr: number | null
  hrv_ms: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  body_weight_kg: number | null
  notes: string | null
}

// Kategorier for mal — vises i "Lagre som mal"-modal og i filter på /app/maler.
export const TEMPLATE_CATEGORIES = [
  'Intervall', 'Terskel', 'Langkjøring', 'Rolig', 'Styrke', 'Teknikk', 'Annet',
] as const
export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number]

// Sport-kategori for plan-maler og periodiseringsmaler. Lagres i `category`-kolonnen.
export const PERIOD_SPORT_CATEGORIES = [
  'Løping', 'Langrenn', 'Skiskyting', 'Sykling', 'Triatlon',
  'Langløp', 'Annet',
] as const
export type PeriodSportCategory = typeof PERIOD_SPORT_CATEGORIES[number]

export function sportToCategory(sport: Sport | null | undefined): PeriodSportCategory {
  switch (sport) {
    case 'running': return 'Løping'
    case 'cross_country_skiing': return 'Langrenn'
    case 'biathlon': return 'Skiskyting'
    case 'cycling': return 'Sykling'
    case 'triathlon': return 'Triatlon'
    case 'long_distance_skiing': return 'Langløp'
    default: return 'Annet'
  }
}

export interface WorkoutTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  category: string | null
  sport: Sport | null
  // Ny primær datamodell: kronologisk aktivitetsliste (ActivityRow[] serialisert).
  // Kan være null for gamle maler som kun har template_data (legacy-movements).
  activities: ActivityRow[] | null
  // Legacy — inneholder sport/workout_type/movements/notes/tags for bakoverkomp.
  template_data: WorkoutFormData
  times_used: number
  last_used_at: string | null
  use_count: number
  created_at: string
  updated_at: string
}

export interface Season {
  id: string; user_id: string; name: string; start_date: string; end_date: string
}
export interface TrainingGoal {
  id: string; user_id: string; title: string; date: string
  goal_type: 'competition' | 'milestone' | 'target'
  priority: 'a' | 'b' | 'c'; notes: string | null
}
export interface TrainingPhase {
  id: string; user_id: string; season_id: string | null; name: string
  phase_type: 'base' | 'specific' | 'competition' | 'recovery' | null
  start_date: string; end_date: string
  target_hours_per_week: number | null; color: string | null
}

// ── Calendar helpers ────────────────────────────────────────

export interface CalendarWorkoutSummary {
  id: string
  title: string
  is_planned: boolean
  is_completed: boolean
  is_important: boolean
  workout_type: WorkoutType
  duration_minutes: number | null
  zones: { zone_name: string; minutes: number }[]
  // Planlagte verdier fra planned_snapshot — brukes i Plan-visninger slik at
  // planen vises uendret også etter gjennomføring (da hovedradens kolonner
  // inneholder actual-verdier).
  planned_duration_minutes: number | null
  planned_zones: { zone_name: string; minutes: number }[]
  // Sum av duration_seconds over workout_activities — ekskluderer pause/aktiv_pause.
  activity_seconds: number
  activity_pause_seconds: number
  // Aggregert fra workout_activities (faktisk) — faller tilbake til duration_minutes*60
  // hvis aktivitetsdata mangler. Zone-seconds bruker zoneForHeartRate-fallback.
  total_seconds: number
  total_meters: number
  zone_seconds: Record<'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'Hurtighet', number>
  // Aggregert fra planned_snapshot.activities (planlagt) — faller tilbake til
  // planned_duration_minutes*60 hvis snapshot-activities mangler.
  planned_total_seconds: number
  planned_total_meters: number
  planned_zone_seconds: Record<'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'Hurtighet', number>
  // Fase 8: konkurranse-markør for kalender-chips.
  // Kun satt når workout_type='competition'|'testlop' OG rad finnes i workout_competition_data.
  competition_type: CompetitionType | null
  position_overall: number | null
  // Fase 15: klokkeslett for ukekalender-plassering.
  // Første aktivitet med start_time (sort_order asc), ellers workouts.time_of_day.
  // null → plasseres i "Hele dagen"-rad i ukekalender.
  start_time: string | null
  // Coach-attribusjon for blå ramme/badge i kalenderceller.
  // Ikke-null når økta er laget/endret av trener (workouts.created_by_coach_id).
  created_by_coach_id: string | null
  coach_name: string | null
  updated_at: string | null
}

export const TYPE_COLORS: Record<string, string> = {
  long_run:        '#1A5A8A',
  interval:        '#8A2A00',
  threshold:       '#8A6000',
  easy:            '#1A6A3A',
  competition:     '#D4A017',
  testlop:         '#1A6FD4',
  recovery:        '#3A3A6A',
  technical:       '#2A6A5A',
  other:           '#4A4A4A',
  hard_combo:      '#7A3A1A',
  easy_combo:      '#3A6A4A',
  basis_shooting:  '#4A4A8A',
  warmup_shooting: '#2A4A5A',
  // legacy fallbacks
  endurance:       '#1A5A8A',
  strength:        '#4A4A4A',
}

export const ZONE_COLORS: Record<string, string> = {
  I1: '#2A5A8A', I2: '#1A7A4A', I3: '#8A8A10',
  I4: '#8A5A00', I5: '#8A1A00', I6: '#6A008A',
  I7: '#4A004A', I8: '#2A002A',
}

// ── Fase 8: Konkurranse ────────────────────────────────────

export type CompetitionType = 'konkurranse' | 'testlop' | 'stafett' | 'tempo'

export const COMPETITION_TYPES: { value: CompetitionType; label: string }[] = [
  { value: 'konkurranse', label: 'Konkurranse' },
  { value: 'testlop',     label: 'Testløp' },
  { value: 'stafett',     label: 'Stafett' },
  { value: 'tempo',       label: 'Tempo/tidsprøve' },
]

// Sport-spesifikke distanse-alternativer. Styrer auto-generering av aktivitets-struktur.
export const DISTANCE_FORMATS: Record<Sport, string[]> = {
  running:              ['5 km', '10 km', 'Halvmaraton', 'Maraton', 'Ultra', 'Terrengløp', 'Motbakkeløp', 'Bane'],
  cross_country_skiing: ['Sprint', 'Kort distanse', 'Lang distanse', 'Langløp', 'Stafett'],
  long_distance_skiing: ['Kort', 'Lang', 'Ultra'],
  biathlon:             ['Sprint', 'Jaktstart', 'Normal', 'Fellesstart', 'Stafett', 'Mix-stafett', 'Supersprint'],
  cycling:              ['Tempo', 'Fellesstart', 'Etapperitt', 'Gran fondo', 'Terrengsykling', 'Bakkeløp'],
  triathlon:            ['Sprint', 'Olympisk', '70.3', 'Ironman', 'Aquathlon', 'Duathlon'],
  endurance:            [],
}

// Form-row — alle nummer-felt som string for input-binding.
export interface CompetitionData {
  db_id?: string
  competition_type: CompetitionType | ''
  name: string
  location: string
  distance_format: string
  bib_number: string
  position_overall: string
  position_class: string
  position_gender: string
  participant_count: string
  // Plan-felter: mål (f.eks. "Topp 10") og før-kommentar (taktikk/forberedelser).
  goal: string
  pre_comment: string
  // Etterpå-kommentar (dagbok-refleksjon).
  comment: string
}

export function emptyCompetitionData(defaultType: CompetitionType = 'konkurranse'): CompetitionData {
  return {
    competition_type: defaultType,
    name: '',
    location: '',
    distance_format: '',
    bib_number: '',
    position_overall: '',
    position_class: '',
    position_gender: '',
    participant_count: '',
    goal: '',
    pre_comment: '',
    comment: '',
  }
}

// DB entity
export interface WorkoutCompetitionData {
  id: string
  workout_id: string
  competition_type: CompetitionType | null
  name: string | null
  location: string | null
  distance_format: string | null
  bib_number: string | null
  position_overall: number | null
  position_class: number | null
  position_gender: number | null
  participant_count: number | null
  goal: string | null
  pre_comment: string | null
  comment: string | null
  created_at: string
  updated_at: string
}

// ── Auto-genererte aktiviteter for konkurranser ────────────

function makeActivity(overrides: Partial<ActivityRow> & { activity_type: ActivityType }): ActivityRow {
  return {
    id: crypto.randomUUID(),
    activity_type: overrides.activity_type,
    movement_name: overrides.movement_name ?? '',
    movement_subcategory: overrides.movement_subcategory ?? '',
    start_time: '',
    duration: '',
    distance_km: overrides.distance_km ?? '',
    avg_heart_rate: '',
    max_heart_rate: '',
    avg_watts: '',
    avg_pace_seconds_per_km: '',
    pace_unit_preference: '',
    splits_per_km: [],
    prone_shots: '',
    prone_hits: '',
    standing_shots: '',
    standing_hits: '',
    elevation_gain_m: '',
    elevation_loss_m: '',
    incline_percent: '',
    pack_weight_kg: '',
    sled_weight_kg: '',
    weather: '',
    temperature_c: '',
    notes: overrides.notes ?? '',
    zones: emptyActivityZones(),
    exercises: [],
    lactate_measurements: [],
  }
}

// Skiskyting: antall skytinger (L=liggende, S=stående) per format.
// Rekkefølge-bevaring: skytingene får sort_order = posisjon i rekkefølgen,
// og vekslingene genereres som "Aktivitet Langrenn — Runde N".
function biathlonShootingSequence(format: string): ('L' | 'S')[] {
  switch (format) {
    case 'Sprint':       return ['L', 'S']
    case 'Jaktstart':    return ['L', 'L', 'S', 'S']
    case 'Normal':       return ['L', 'S', 'L', 'S']
    case 'Fellesstart':  return ['L', 'L', 'S', 'S']
    case 'Stafett':      return ['L', 'S']
    case 'Mix-stafett':  return ['L', 'S']
    case 'Supersprint':  return ['L', 'S']
    default:             return []
  }
}

function generateBiathlonActivities(format: string): ActivityRow[] {
  const seq = biathlonShootingSequence(format)
  if (seq.length === 0) return []
  const rows: ActivityRow[] = []
  // Oppvarming → Runde 1 → Skyting L → Runde 2 → Skyting S → …
  rows.push(makeActivity({ activity_type: 'oppvarming', movement_name: 'Langrenn' }))
  seq.forEach((mark, i) => {
    rows.push(makeActivity({
      activity_type: 'aktivitet',
      movement_name: 'Langrenn',
      notes: `Runde ${i + 1}`,
    }))
    rows.push(makeActivity({
      activity_type: mark === 'L' ? 'skyting_liggende' : 'skyting_staaende',
    }))
  })
  // Siste runde inn mot mål
  rows.push(makeActivity({
    activity_type: 'aktivitet',
    movement_name: 'Langrenn',
    notes: `Runde ${seq.length + 1} (inn)`,
  }))
  return rows
}

// Triathlon: svøm → T1 → sykkel → T2 → løp, med distanseforslag per format.
const TRIATHLON_DISTANCES: Record<string, { swim_km: string; bike_km: string; run_km: string } | null> = {
  'Sprint':    { swim_km: '0.75', bike_km: '20',  run_km: '5' },
  'Olympisk':  { swim_km: '1.5',  bike_km: '40',  run_km: '10' },
  '70.3':      { swim_km: '1.9',  bike_km: '90',  run_km: '21.1' },
  'Ironman':   { swim_km: '3.8',  bike_km: '180', run_km: '42.2' },
  'Aquathlon': null,
  'Duathlon':  null,
}

function generateTriathlonActivities(format: string): ActivityRow[] {
  const d = TRIATHLON_DISTANCES[format]
  if (d === undefined) return []
  if (d === null) return []
  return [
    makeActivity({ activity_type: 'aktivitet',   movement_name: 'Svømming', distance_km: d.swim_km }),
    makeActivity({ activity_type: 'aktiv_pause', movement_name: 'T1',       notes: 'Transisjon 1' }),
    makeActivity({ activity_type: 'aktivitet',   movement_name: 'Sykling',  distance_km: d.bike_km }),
    makeActivity({ activity_type: 'aktiv_pause', movement_name: 'T2',       notes: 'Transisjon 2' }),
    makeActivity({ activity_type: 'aktivitet',   movement_name: 'Løping',   distance_km: d.run_km }),
  ]
}

// Returnerer tom-aktivitets-struktur for gitt sport + format. Tom liste betyr
// at vi ikke har en mal for formatet (brukeren fører alt manuelt).
export function generateCompetitionActivities(sport: Sport, format: string): ActivityRow[] {
  if (!format) return []
  if (sport === 'biathlon')  return generateBiathlonActivities(format)
  if (sport === 'triathlon') return generateTriathlonActivities(format)
  return []
}

export function hasAutoGenerateTemplate(sport: Sport, format: string): boolean {
  return generateCompetitionActivities(sport, format).length > 0
}
