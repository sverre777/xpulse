'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  Equipment,
  EquipmentUsage,
  EquipmentWithUsage,
  EquipmentSkiData,
  EquipmentGrind,
  SkiEquipment,
} from '@/lib/equipment-types'
import { normalizeCategory } from '@/lib/equipment-types'
import { beregnEquipmentUsage } from '@/lib/equipment-usage'
import type {
  SkiTest,
  SkiTestEntry,
  SkiTestWithEntries,
} from '@/lib/ski-test-types'

// Sjekker at innlogget bruker er aktiv trener for utøveren. Returnerer
// supabase-klient ved success, ellers null. RLS slipper coach-rader gjennom
// så lenge relasjonen er aktiv (se phase33/36/37/38-policies).
async function authorizeCoach(athleteId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('coach_athlete_relations')
    .select('id')
    .eq('coach_id', user.id)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle()
  if (!data) return null
  return supabase
}

export async function listAthleteEquipmentWithUsage(
  athleteId: string,
): Promise<EquipmentWithUsage[]> {
  const supabase = await authorizeCoach(athleteId)
  if (!supabase) return []

  const { data: equipment } = await supabase
    .from('equipment')
    .select('*')
    .eq('user_id', athleteId)
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false })
  if (!equipment || equipment.length === 0) return []

  // Fase 101: samme delte telling som utøverens egen visning — arv fra øktas
  // totaler, overstyringer fra aktivitetsradene (lib/equipment-usage.ts).
  const ids = equipment.map(e => e.id)
  const { data: links } = await supabase
    .from('workout_equipment')
    .select('equipment_id, workout_id, activity_id')
    .in('equipment_id', ids)

  const workoutById = new Map<string, { distance_km: number | null; duration_minutes: number | null; is_completed: boolean | null }>()
  const activityById = new Map<string, { workout_id: string; distance_meters: number | null; duration_seconds: number | null }>()
  if (links && links.length > 0) {
    const workoutIds = Array.from(new Set(links.map(l => l.workout_id)))
    // is_completed MÅ med — samme fasit som utøverens egen visning.
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, distance_km, duration_minutes, is_completed')
      .in('id', workoutIds)
      .is('merged_into_workout_id', null)
    for (const w of (workouts ?? [])) workoutById.set(w.id, w)
    const activityIds = Array.from(new Set(links.map(l => l.activity_id).filter((x): x is string => x !== null)))
    if (activityIds.length > 0) {
      const { data: acts } = await supabase
        .from('workout_activities')
        .select('id, workout_id, distance_meters, duration_seconds')
        .in('id', activityIds)
      for (const a of (acts ?? [])) activityById.set(a.id, a)
    }
  }

  const categoryByEquipment = new Map((equipment as Equipment[]).map(e => [e.id, normalizeCategory(e.category)]))
  const usageById = beregnEquipmentUsage(
    ids,
    (links ?? []) as Array<{ equipment_id: string; workout_id: string; activity_id: string | null }>,
    workoutById,
    activityById,
    categoryByEquipment,
  )

  // Fase 99: start-km legges til km-tellingen — samme regel som utøverens egen visning.
  for (const e of (equipment as Equipment[])) {
    const startKm = typeof e.start_km === 'number' ? e.start_km : 0
    if (startKm > 0) usageById.get(e.id)!.total_km += startKm
  }

  return (equipment as Equipment[]).map(e => ({ ...e, usage: usageById.get(e.id)! }))
}

export async function listAthleteSkiEquipment(athleteId: string): Promise<SkiEquipment[]> {
  const supabase = await authorizeCoach(athleteId)
  if (!supabase) return []

  const all = await listAthleteEquipmentWithUsage(athleteId)
  const skiOnly = all.filter(e => e.category === 'ski' && e.status === 'active')
  if (skiOnly.length === 0) return []

  const ids = skiOnly.map(e => e.id)
  const [{ data: skiRows }, { data: grindRows }] = await Promise.all([
    supabase.from('equipment_ski_data').select('*').in('equipment_id', ids),
    // Fase 99 — sliphistorikk (RLS: trener-lesing via equipment-eierskapet).
    supabase.from('equipment_grinds').select('*').in('equipment_id', ids)
      .order('grind_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])
  const byId = new Map<string, EquipmentSkiData>()
  for (const r of (skiRows ?? [])) byId.set(r.equipment_id, r as EquipmentSkiData)
  const grindsById = new Map<string, EquipmentGrind[]>()
  for (const id of ids) grindsById.set(id, [])
  for (const g of (grindRows ?? [])) grindsById.get(g.equipment_id)?.push(g as EquipmentGrind)

  // km_since_slip beregnes ikke i trenervisningen (krever egen økt-dato-henting);
  // kortene der viser totalene. null = «ukjent», aldri 0.
  return skiOnly.map(e => ({
    ...e,
    ski_data: byId.get(e.id) ?? null,
    grinds: grindsById.get(e.id) ?? [],
    km_since_slip: null,
  }))
}

export async function listAthleteSkiTests(athleteId: string): Promise<SkiTestWithEntries[]> {
  const supabase = await authorizeCoach(athleteId)
  if (!supabase) return []

  const { data: tests } = await supabase
    .from('ski_tests')
    .select('*')
    .eq('user_id', athleteId)
    .order('test_date', { ascending: false })
  if (!tests || tests.length === 0) return []

  const ids = tests.map(t => t.id)
  const { data: entries } = await supabase
    .from('ski_test_entries')
    .select('*')
    .in('test_id', ids)

  const byTest = new Map<string, SkiTestEntry[]>()
  for (const t of tests) byTest.set(t.id, [])
  for (const e of (entries ?? [])) byTest.get(e.test_id)?.push(e as SkiTestEntry)

  return tests.map(t => ({ ...(t as SkiTest), entries: byTest.get(t.id) ?? [] }))
}
