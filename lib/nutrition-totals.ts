import type { NutritionEntryRow } from './types'

// Aggregeringer for ernærings-visning. Sync-funksjoner — kan kalles fra
// både client- og server-komponenter. Holdes utenfor 'use server'-filen
// fordi server-actions krever async eksporter.

export interface NutritionTotals {
  carbs_g: number | null
  protein_g: number | null
  fat_g: number | null
  ketones_g: number | null
  entry_count: number
  // Karbo per time hvis varighet er kjent — viktig for utholdenhet hvor
  // 60-90 g/time er typisk mål.
  carbs_per_hour: number | null
}

function parseNumOrNull(s: string): number | null {
  if (!s) return null
  const t = s.replace(',', '.').trim()
  if (t === '') return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

export function nutritionTotals(
  entries: NutritionEntryRow[],
  durationMinutes: number | null,
): NutritionTotals {
  let carbs = 0, protein = 0, fat = 0, ketones = 0
  let hasCarbs = false, hasProtein = false, hasFat = false, hasKetones = false
  for (const e of entries) {
    const c = parseNumOrNull(e.carbs_g)
    const p = parseNumOrNull(e.protein_g)
    const f = parseNumOrNull(e.fat_g)
    const k = parseNumOrNull(e.ketones_g)
    if (c !== null) { carbs += c; hasCarbs = true }
    if (p !== null) { protein += p; hasProtein = true }
    if (f !== null) { fat += f; hasFat = true }
    if (k !== null) { ketones += k; hasKetones = true }
  }
  const carbs_per_hour = hasCarbs && durationMinutes && durationMinutes > 0
    ? Math.round((carbs / (durationMinutes / 60)) * 10) / 10
    : null
  return {
    carbs_g: hasCarbs ? Math.round(carbs * 10) / 10 : null,
    protein_g: hasProtein ? Math.round(protein * 10) / 10 : null,
    fat_g: hasFat ? Math.round(fat * 10) / 10 : null,
    ketones_g: hasKetones ? Math.round(ketones * 100) / 100 : null,
    entry_count: entries.length,
    carbs_per_hour,
  }
}
