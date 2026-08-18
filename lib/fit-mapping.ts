// FIT-format mapping: manufacturer-id → kilde-merke, og sport/sub_sport
// → x-pulse bevegelsesform + subkategori. Brukes av app/actions/fit-upload.ts
// når brukeren laster opp .fit-filer fra Garmin/Polar/Coros/Suunto/Wahoo etc.
//
// Manufacturer-enum og sport-enum kommer fra FIT SDK Profile.xlsx (Types-tab).

// ── Manufacturer ────────────────────────────────────────────
//
// ⚠ ID-ENE SKAL ALDRI SKRIVES FRA HUKOMMELSEN. De kommer fra FIT SDK
// Profile (Types-fanen, `manufacturer`) og er lette å huske feil — denne
// tabellen hadde fire feil ID-er fram til 2026-08-18, med det resultatet at
// Suunto-filer ble merket Polar og Polar-filer ikke ble merket i det hele
// tatt. Skal en ID inn eller endres: slå den opp i to uavhengige kilder
// først, og la `scripts/fit-manufacturer-selftest.ts` bekrefte den.
//
// Verifisert 2026-08-18 mot:
//   1. Garmin FIT SDK (offisiell fasit)
//      github.com/garmin/fit-javascript-sdk → src/profile.js
//   2. fit-file-parser, parseren X-PULSE faktisk bruker
//      node_modules/fit-file-parser/dist/cjs/fit.js → FIT.types.manufacturer
// Kildene var enige om samtlige ID-er begge inneholder.
//
// Merker vi ikke har en etikett for skal IKKE stå her — de faller til 'fit',
// som er riktig oppførsel. Derfor mangler f.eks. 70 (sigmasport),
// 89 (tacx), 281 (trainer_road) og 309 (form) med vilje.
//
// `navn` er det offisielle FIT-profilnavnet. Det er ikke pynt: parseren
// returnerer navnet, ikke tallet, for hver ID den kjenner (se
// mapFitManufacturerToSource under), så begge må stemme.

const FIT_MANUFACTURERS: readonly { id: number; navn: string; source: string }[] = [
  { id: 1,   navn: 'garmin',              source: 'fit_garmin' },
  { id: 2,   navn: 'garmin_fr405_antfs',  source: 'fit_garmin' },
  { id: 13,  navn: 'dynastream_oem',      source: 'fit_garmin' },      // Garmin-eid
  { id: 15,  navn: 'dynastream',          source: 'fit_garmin' },      // Garmin-eid
  { id: 23,  navn: 'suunto',              source: 'fit_suunto' },
  { id: 32,  navn: 'wahoo_fitness',       source: 'fit_wahoo' },
  { id: 123, navn: 'polar_electro',       source: 'fit_polar' },
  { id: 265, navn: 'strava',              source: 'fit_strava' },
  { id: 289, navn: 'hammerhead',          source: 'fit_hammerhead' },  // Karoo
  { id: 294, navn: 'coros',               source: 'fit_coros' },       // PACE/APEX/VERTIX
]

const SOURCE_BY_ID = new Map(FIT_MANUFACTURERS.map(m => [m.id, m.source]))
const SOURCE_BY_NAVN = new Map(FIT_MANUFACTURERS.map(m => [m.navn, m.source]))

/**
 * Returner kilde-strengen som lagres i workouts.imported_from.
 *
 * Tar BÅDE tall og navn, og det er ikke defensiv pynt: fit-file-parser
 * oversetter enum-felt til profilnavnet sitt før vi ser dem, så et
 * file_id.manufacturer er strengen 'polar_electro' — ikke 123 — for hver ID
 * biblioteket kjenner. Tallet kommer kun igjennom for ID-er biblioteket IKKE
 * kjenner. En ren tall-oppslag treffer derfor aldri et kjent merke.
 * (Samme grunn som mapFitSportToXpulse under tar begge former.)
 *
 * Ukjent produsent, eller manglende file_id, faller til 'fit'.
 */
export function mapFitManufacturerToSource(
  manufacturer: number | string | null | undefined,
): string {
  if (manufacturer == null) return 'fit'
  if (typeof manufacturer === 'number') return SOURCE_BY_ID.get(manufacturer) ?? 'fit'

  const navn = manufacturer.trim().toLowerCase()
  const fraNavn = SOURCE_BY_NAVN.get(navn)
  if (fraNavn) return fraNavn

  // Et tall som kom inn som streng skal behandles som tallet det er.
  const somTall = /^\d+$/.test(navn) ? Number(navn) : null
  return somTall == null ? 'fit' : SOURCE_BY_ID.get(somTall) ?? 'fit'
}

/** Kun for selvtesten — så tabellen kan kryssjekkes mot FIT-profilen. */
export const FIT_MANUFACTURER_TABLE = FIT_MANUFACTURERS

// Lesbart merkenavn for UI-badge.
export function fitSourceLabel(source: string): string {
  switch (source) {
    case 'fit_garmin':     return 'Garmin'
    case 'fit_polar':      return 'Polar'
    case 'fit_wahoo':      return 'Wahoo'
    case 'fit_suunto':     return 'Suunto'
    case 'fit_coros':      return 'Coros'
    case 'fit_hammerhead': return 'Hammerhead'
    // .fit eksportert fra Strava. NB: dette er IKKE det samme som kilden
    // 'strava' (direkte-synk) — se kommentaren over tabellen.
    case 'fit_strava':     return 'Strava'
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
