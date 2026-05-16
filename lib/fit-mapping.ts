// FIT-format mapping: manufacturer-id → kilde-merke, og sport/sub_sport
// → x-pulse bevegelsesform + subkategori. Brukes av app/actions/fit-upload.ts
// når brukeren laster opp .fit-filer fra Garmin/Polar/Coros/Suunto/Wahoo etc.
//
// Manufacturer-enum og sport-enum kommer fra FIT SDK Profile.xlsx (Types-tab).

// ── Manufacturer ────────────────────────────────────────────

const FIT_MANUFACTURER_SOURCE: Record<number, string> = {
  1:   'fit_garmin',     // Garmin (alle FR/Edge/Fenix/etc)
  2:   'fit_garmin',     // GarminFR405Antfs
  13:  'fit_garmin',     // Dynastream (Garmin-owned)
  15:  'fit_garmin',     // Dynastream OEM (Garmin)
  23:  'fit_polar',      // Polar Electro
  32:  'fit_wahoo',      // Wahoo Fitness
  70:  'fit_suunto',     // Suunto
  281: 'fit_coros',      // Coros (PACE/APEX/VERTIX)
  294: 'fit_hammerhead', // Hammerhead
  309: 'fit_hammerhead', // Karoo (Hammerhead)
}

// Returner kilde-streng som lagres i workouts.imported_from. Ukjente
// manufacturers (eller manglende file_id) faller tilbake til 'fit'.
export function mapFitManufacturerToSource(manufacturerId: number | null | undefined): string {
  if (manufacturerId == null) return 'fit'
  return FIT_MANUFACTURER_SOURCE[manufacturerId] ?? 'fit'
}

// Lesbart merkenavn for UI-badge.
export function fitSourceLabel(source: string): string {
  switch (source) {
    case 'fit_garmin':     return 'Garmin'
    case 'fit_polar':      return 'Polar'
    case 'fit_wahoo':      return 'Wahoo'
    case 'fit_suunto':     return 'Suunto'
    case 'fit_coros':      return 'Coros'
    case 'fit_hammerhead': return 'Hammerhead'
    case 'fit':            return 'Klokke (.fit)'
    default:               return source.replace(/^fit_/, '').replace(/^./, c => c.toUpperCase())
  }
}

// ── Sport / sub_sport ───────────────────────────────────────

export interface FitMovementMapping {
  movement: string             // matcher MOVEMENT_CATEGORIES.name
  subcategory: string | null
}

// Tar både numeriske enum-verdier (offisiell FIT SDK) og lowercase string-
// navnene som fit-file-parser typisk returnerer. Begge støttes for å være
// kompatibel med ulike FIT-bibliotek.
//
// Mapping følger Strava-pattern: peker eksklusivt til eksisterende
// bevegelsesformer i lib/types.ts. Workouts.sport-feltet røres ikke her —
// det settes fra brukerens primary_sport.
export function mapFitSportToXpulse(
  sport: number | string | null | undefined,
  subSport: number | string | null | undefined,
): FitMovementMapping {
  const s = normalizeSport(sport)
  const ss = normalizeSubSport(subSport)

  if (s === 1 /* running */ || s === 'running') {
    if (ss === 1 || ss === 'treadmill') return { movement: 'Løping', subcategory: 'Tredemølle' }
    if (ss === 2 || ss === 'street') return { movement: 'Løping', subcategory: 'Asfalt' }
    if (ss === 3 || ss === 'trail') return { movement: 'Løping', subcategory: 'Terreng' }
    if (ss === 4 || ss === 'track') return { movement: 'Løping', subcategory: 'Bane' }
    return { movement: 'Løping', subcategory: null }
  }

  if (s === 2 /* cycling */ || s === 'cycling') {
    if (ss === 5 || ss === 'spin') return { movement: 'Sykling', subcategory: 'Spinning' }
    if (ss === 6 || ss === 'indoor_cycling') return { movement: 'Sykling', subcategory: 'Indoors/Ergo' }
    if (ss === 7 || ss === 'road') return { movement: 'Sykling', subcategory: 'Landevei' }
    if (ss === 8 || ss === 9 || ss === 'mountain' || ss === 'downhill') return { movement: 'Sykling', subcategory: 'Terreng/MTB' }
    if (ss === 11 || ss === 28 || ss === 'cyclocross' || ss === 'mixed_surface') return { movement: 'Sykling', subcategory: 'Gravel' }
    return { movement: 'Sykling', subcategory: 'Landevei' }
  }

  if (s === 4 /* fitness_equipment */ || s === 'fitness_equipment') {
    if (ss === 14 || ss === 'indoor_rowing') return { movement: 'Roing', subcategory: 'Romaskin' }
    if (ss === 15 || ss === 'elliptical') return { movement: 'Ellipsemaskin', subcategory: null }
    if (ss === 16 || ss === 'stair_climbing') return { movement: 'Stairmaster', subcategory: null }
    if (ss === 46 || ss === 'indoor_climbing') return { movement: 'Klatring', subcategory: null }
    if (ss === 50 || ss === 'strength_training') return { movement: 'Styrke', subcategory: null }
    return { movement: 'Annet', subcategory: null }
  }

  if (s === 5 /* swimming */ || s === 'swimming') {
    if (ss === 17 || ss === 'lap_swimming') return { movement: 'Svømming basseng 25m', subcategory: null }
    if (ss === 18 || ss === 'open_water') return { movement: 'Svømming åpent vann', subcategory: null }
    return { movement: 'Svømming basseng 25m', subcategory: null }
  }

  if (s === 12 /* cross_country_skiing */ || s === 'cross_country_skiing') {
    if (ss === 37 || ss === 'backcountry') return { movement: 'Fjellsport', subcategory: 'Topptur' }
    if (ss === 42 || ss === 'nordic') return { movement: 'Langrenn', subcategory: 'Klassisk' }
    if (ss === 43 || ss === 44 || ss === 'skating' || ss === 'skate_skiing') return { movement: 'Langrenn', subcategory: 'Skøyting' }
    return { movement: 'Langrenn', subcategory: null }
  }

  // Singel-mapping uten sub_sport-betydning.
  if (s === 10 /* training */ && (ss === 50 || ss === 'strength_training')) return { movement: 'Styrke', subcategory: null }
  if (s === 11 || s === 'walking') return { movement: 'Tur', subcategory: 'Skogstur' }
  if (s === 13 || s === 'alpine_skiing') return { movement: 'Alpint', subcategory: null }
  if (s === 14 || s === 'snowboarding') return { movement: 'Snowboard', subcategory: null }
  if (s === 15 || s === 'rowing') return { movement: 'Roing', subcategory: 'På vann' }
  if (s === 17 || s === 'hiking') return { movement: 'Tur', subcategory: 'Fjelltur' }
  if (s === 30 || s === 'inline_skating') return { movement: 'Skøyter', subcategory: null }
  if (s === 31 || s === 'rock_climbing') return { movement: 'Klatring', subcategory: null }
  if (s === 35 || s === 'snowshoeing') return { movement: 'Tur', subcategory: 'Snøskotur' }
  if (s === 37 || s === 'stand_up_paddleboarding') return { movement: 'Kajak/Padling', subcategory: null }
  if (s === 41 || s === 'kayaking') return { movement: 'Kajak/Padling', subcategory: null }
  if (s === 62 || s === 'hiit' || s === 'high_intensity_interval_training') return { movement: 'HIIT', subcategory: null }
  if (s === 72 || s === 'yoga') return { movement: 'Yoga', subcategory: null }
  if (s === 91 || s === 'dance') return { movement: 'Dans', subcategory: null }
  if (s === 'crossfit') return { movement: 'Crossfit', subcategory: null }

  if (s !== null && s !== undefined) {
    console.warn(`[fit-mapping] ukjent sport "${sport}"/sub "${subSport}" — bruker fallback Annet`)
  }
  return { movement: 'Annet', subcategory: null }
}

function normalizeSport(sport: number | string | null | undefined): number | string | null {
  if (sport == null) return null
  if (typeof sport === 'number') return sport
  return sport.toLowerCase()
}
function normalizeSubSport(sub: number | string | null | undefined): number | string | null {
  if (sub == null) return null
  if (typeof sub === 'number') return sub
  return sub.toLowerCase()
}
