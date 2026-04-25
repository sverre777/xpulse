// Utstyr-system typer. Holdes adskilt fra lib/types.ts for å unngå at den filen
// blir for stor. Dekker generisk utstyr (Fase 36) og ski-spesifikk data (Fase 37).

export const EQUIPMENT_CATEGORIES = ['sko', 'sykkel', 'ski', 'klokke', 'annet'] as const
export type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[number]

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  sko: 'Sko',
  sykkel: 'Sykkel',
  ski: 'Ski',
  klokke: 'Klokke',
  annet: 'Annet',
}

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
}

export interface UpdateEquipmentInput extends Partial<SaveEquipmentInput> {
  id: string
}

// Kobling økt → utstyr.
export interface WorkoutEquipment {
  id: string
  workout_id: string
  equipment_id: string
  created_at: string
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
}

export interface SaveSkiDataInput {
  equipment_id: string
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
}
