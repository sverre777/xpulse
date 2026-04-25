'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  Equipment,
  EquipmentUsage,
  EquipmentWithUsage,
  EquipmentSkiData,
  SkiEquipment,
} from '@/lib/equipment-types'
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

  const ids = equipment.map(e => e.id)
  const { data: links } = await supabase
    .from('workout_equipment')
    .select('equipment_id, workout_id')
    .in('equipment_id', ids)

  const usageById = new Map<string, EquipmentUsage>()
  for (const id of ids) {
    usageById.set(id, { equipment_id: id, total_km: 0, total_minutes: 0, workout_count: 0 })
  }
  if (links && links.length > 0) {
    const workoutIds = Array.from(new Set(links.map(l => l.workout_id)))
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, distance_km, duration_minutes')
      .in('id', workoutIds)
    const workoutById = new Map<string, { distance_km: number | null; duration_minutes: number | null }>()
    for (const w of (workouts ?? [])) workoutById.set(w.id, w)
    for (const link of links) {
      const u = usageById.get(link.equipment_id)
      if (!u) continue
      const w = workoutById.get(link.workout_id)
      if (!w) continue
      u.workout_count += 1
      if (typeof w.distance_km === 'number') u.total_km += w.distance_km
      if (typeof w.duration_minutes === 'number') u.total_minutes += w.duration_minutes
    }
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
  const { data: skiRows } = await supabase
    .from('equipment_ski_data')
    .select('*')
    .in('equipment_id', ids)
  const byId = new Map<string, EquipmentSkiData>()
  for (const r of (skiRows ?? [])) byId.set(r.equipment_id, r as EquipmentSkiData)

  return skiOnly.map(e => ({ ...e, ski_data: byId.get(e.id) ?? null }))
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
