// Utstyr-system typer. Holdes adskilt fra lib/types.ts for å unngå at den filen
// blir for stor. Dekker generisk utstyr (Fase 36) og ski-spesifikk data (Fase 37).

// Fase 99 utvidet fra ['sko','sykkel','ski','klokke','annet'] til ni kategorier.
// Rekkefølgen følger designfasitens chip-rad (klokke/annet sist).
export const EQUIPMENT_CATEGORIES = [
  'ski', 'rulleski', 'skisko', 'lopesko', 'skistaver', 'sykkel', 'sykkelsko', 'klokke', 'annet',
] as const
export type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[number]

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  ski: 'Ski',
  rulleski: 'Rulleski',
  skisko: 'Skisko',
  lopesko: 'Løpesko',
  skistaver: 'Skistaver',
  sykkel: 'Sykkel',
  sykkelsko: 'Sykkelsko',
  klokke: 'Klokke',
  annet: 'Annet',
}

// Kategoriikon — ÉN kilde, brukes både av utstyrslista og av velgeren i økta.
// Nøkler = normalizeCategory-verdier.
export const EQUIPMENT_CATEGORY_ICONS: Record<EquipmentCategory, string> = {
  ski: '🎿', rulleski: '🛼', skisko: '🥾', lopesko: '👟', skistaver: '🦯',
  sykkel: '🚴', sykkelsko: '👟', klokke: '⌚', annet: '🎒',
}

// Rader lagret før fase 99-migreringen kan fortsatt ha 'sko'. All lesing av
// category fra databasen skal gjennom denne — aldri stol på at verdien er ny.
export function normalizeCategory(category: string): EquipmentCategory {
  if (category === 'sko') return 'lopesko'
  return (EQUIPMENT_CATEGORIES as readonly string[]).includes(category)
    ? (category as EquipmentCategory)
    : 'annet'
}

// ── Kategorispesifikke chip-/select-verdier (fasit: designfilens seksjon 1) ──
// Verdisettet for bruk (usage_type) varierer per kategori — derfor ingen CHECK i basen.

export const SKI_USAGE_TYPES = ['konkurranse', 'trening'] as const
export type SkiUsageType = typeof SKI_USAGE_TYPES[number]
export const SKI_USAGE_LABELS: Record<SkiUsageType, string> = {
  konkurranse: '🏁 Konkurranseski',
  trening: 'Treningsski',
}

export const LOPESKO_USAGE_TYPES = ['trening', 'konkurranse', 'terreng'] as const
export const LOPESKO_USAGE_LABELS: Record<typeof LOPESKO_USAGE_TYPES[number], string> = {
  trening: 'Trening',
  konkurranse: 'Konkurranse',
  terreng: 'Terreng',
}

export const STAV_USAGE_TYPES = ['skoyte', 'klassisk', 'rulleski'] as const
export const STAV_USAGE_LABELS: Record<typeof STAV_USAGE_TYPES[number], string> = {
  skoyte: 'Skøyte',
  klassisk: 'Klassisk',
  rulleski: 'Rulleski',
}

export const RULLESKI_TYPES = ['skoyte', 'klassisk'] as const
export const RULLESKI_TYPE_LABELS: Record<typeof RULLESKI_TYPES[number], string> = {
  skoyte: 'Skøyte',
  klassisk: 'Klassisk',
}

export const RULLESKI_WHEEL_TYPES = ['Standard (PU)', 'Gummi', 'Annet'] as const
export const RULLESKI_RESISTANCES = ['0', '1', '2', '3', '4'] as const

export const SKISKO_TYPES = ['skoyte', 'klassisk', 'kombi'] as const
export const SKISKO_TYPE_LABELS: Record<typeof SKISKO_TYPES[number], string> = {
  skoyte: 'Skøyte',
  klassisk: 'Klassisk',
  kombi: 'Kombi',
}

export const SYKKEL_TYPES = ['Landevei', 'Terreng', 'Gravel', 'Tempo', 'Rulle/innendørs', 'Annet'] as const
export const CLEAT_SYSTEMS = ['SPD-SL', 'SPD', 'Look Keo', 'Speedplay', 'Annet'] as const

export const EQUIPMENT_STATUSES = ['active', 'retired', 'lost'] as const
export type EquipmentStatus = typeof EQUIPMENT_STATUSES[number]

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  active: 'Aktiv',
  retired: 'Pensjonert',
  lost: 'Tapt',
}

export interface Equipment {
  id: string
  user_id: string
  name: string
  category: EquipmentCategory
  brand: string | null
  model: string | null
  sport: string | null
  image_url: string | null
  purchase_date: string | null
  price_kr: number | null
  status: EquipmentStatus
  notes: string | null
  created_at: string
  updated_at: string
  // Fase 99 — «km allerede gått»: legges til km-tellingen så historisk utstyr
  // ikke starter på null. Kan mangle (undefined) før migreringen er kjørt.
  start_km?: number | null
  // Fase 99 — kategorispesifikke felter. Null for kategorier de ikke gjelder.
  size?: string | null            // skisko / lopesko / sykkelsko
  usage_type?: string | null      // lopesko / skistaver (ski har sin i ski_data)
  length_cm?: number | null       // skistaver (ski-lengde ligger i ski_data)
  subtype?: string | null         // rulleski/skisko: skøyte/klassisk(/kombi) · sykkel: sykkeltype
  wheel_type?: string | null      // rulleski
  resistance?: string | null      // rulleski — felles motstand
  resistance_front?: string | null
  resistance_rear?: string | null
  cleat_system?: string | null    // sykkelsko
  drivetrain?: string | null      // sykkel
  wheelset?: string | null        // sykkel
}

// Aggregert bruks-statistikk per utstyr — beregnes fra workouts via workout_equipment.
export interface EquipmentUsage {
  equipment_id: string
  total_km: number
  total_minutes: number
  workout_count: number
}

// Utstyr + tilhørende usage-aggregat. Brukes i listevisninger.
export interface EquipmentWithUsage extends Equipment {
  usage: EquipmentUsage
}

export interface SaveEquipmentInput {
  name: string
  category: EquipmentCategory
  brand?: string | null
  model?: string | null
  sport?: string | null
  image_url?: string | null
  purchase_date?: string | null
  price_kr?: number | null
  status?: EquipmentStatus
  notes?: string | null
  start_km?: number | null
  size?: string | null
  usage_type?: string | null
  length_cm?: number | null
  subtype?: string | null
  wheel_type?: string | null
  resistance?: string | null
  resistance_front?: string | null
  resistance_rear?: string | null
  cleat_system?: string | null
  drivetrain?: string | null
  wheelset?: string | null
}

export interface UpdateEquipmentInput extends Partial<SaveEquipmentInput> {
  id: string
}

// Kobling økt → utstyr. Fase 101: activity_id null = «hele økta»-arv
// (standard — telles på hver aktivitet), satt = per-aktivitet-overstyring (⇄).
export interface WorkoutEquipment {
  id: string
  workout_id: string
  equipment_id: string
  activity_id?: string | null
  created_at: string
}

// Utvalget slik skjemaet holder det: arv + overstyringer per aktivitetsrad.
// Aktiviteter identifiseres med sort_order (radindeks) — DB-idene byttes ut
// ved hver lagring (delete + reinsert), så koblingen bygges på nytt hver gang.
export interface WorkoutEquipmentSelection {
  heleOkta: string[]
  perAktivitet: Array<{ sortOrder: number; equipmentIds: string[] }>
  // Plan-modus: skjemaet viser planens frosne aktiviteter (planned_snapshot),
  // så radindeksene stemmer IKKE med workout_activities. Da skrives kun arven,
  // og eksisterende ⇄-overstyringer får ligge urørt.
  bevarOverstyringer?: boolean
}

// ── Ski-spesifikk data (Fase 37) ─────────────────────────────
//
// equipment.category = 'ski' kan ha en tilhørende rad i equipment_ski_data
// med utvidede felter for skipark + smøring/slip-historikk.
export const SKI_TYPES = ['klassisk', 'skoyting', 'staking'] as const
export type SkiType = typeof SKI_TYPES[number]

export const SKI_TYPE_LABELS: Record<SkiType, string> = {
  klassisk: 'Klassisk',
  skoyting: 'Skøyting',
  staking: 'Staking',
}

export interface EquipmentSkiData {
  equipment_id: string
  ski_type: SkiType | null
  length_cm: number | null
  camber: string | null
  current_slip: string | null
  slip_date: string | null
  slip_by: string | null
  current_wax: string | null
  notes: string | null
  updated_at: string
  // Fase 99 — bruk-chips (konkurranse/trening). Kan mangle før migreringen.
  usage_type?: SkiUsageType | null
}

// Fase 99 — sliphistorikk (equipment_grinds). Ny slip legges alltid OPPÅ,
// gamle rader røres aldri; «km siden siste slip» beregnes fra nyeste grind_date.
export interface EquipmentGrind {
  id: string
  equipment_id: string
  grind: string
  grind_date: string
  ground_by: string | null
  notes: string | null
  created_at: string
}

export interface AddGrindInput {
  equipment_id: string
  grind: string
  grind_date: string // ISO-dato — bruk slipDatoTilDate() for «årstall holder»-input
  ground_by?: string | null
  notes?: string | null
}

// «Årstall holder» (fasit): «2026» lagres som 2026-01-01, ellers dato rett gjennom.
export function slipDatoTilDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}$/.test(s)) return `${s}-01-01`
  return s
}

// Visning av slip-dato: år-only-innslag (1. januar) vises som bare årstall.
export function visSlipDato(isoDate: string | null): string | null {
  if (!isoDate) return null
  if (/^\d{4}-01-01$/.test(isoDate)) return isoDate.slice(0, 4)
  return isoDate
}

export interface SaveSkiDataInput {
  equipment_id: string
  usage_type?: SkiUsageType | null
  ski_type?: SkiType | null
  length_cm?: number | null
  camber?: string | null
  current_slip?: string | null
  slip_date?: string | null
  slip_by?: string | null
  current_wax?: string | null
  notes?: string | null
}

// Equipment + ski_data + usage i én leselig form for skipark-visning.
export interface SkiEquipment extends EquipmentWithUsage {
  ski_data: EquipmentSkiData | null
  // Fase 99 — sliphistorikk (nyeste først) + km gått siden nyeste slip.
  // km_since_slip er null når skia ikke har noen slip registrert.
  grinds: EquipmentGrind[]
  km_since_slip: number | null
}
