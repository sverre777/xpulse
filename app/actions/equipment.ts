'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  Equipment,
  EquipmentCategory,
  EquipmentStatus,
  EquipmentUsage,
  EquipmentWithUsage,
  SaveEquipmentInput,
  UpdateEquipmentInput,
  EquipmentSkiData,
  SaveSkiDataInput,
  SkiEquipment,
  SkiType,
} from '@/lib/equipment-types'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_STATUSES,
  SKI_TYPES,
} from '@/lib/equipment-types'

// Hent alle utstyrsrader for innlogget bruker. Filtrer optional på kategori +
// status. Sortering: aktive først, deretter sist endret.
export async function listEquipment(filter?: {
  category?: EquipmentCategory | null
  status?: EquipmentStatus | null
}): Promise<Equipment[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let q = supabase
    .from('equipment')
    .select('*')
    .eq('user_id', user.id)
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false })

  if (filter?.category) q = q.eq('category', filter.category)
  if (filter?.status) q = q.eq('status', filter.status)

  const { data, error } = await q
  if (error || !data) return []
  return data as Equipment[]
}

// Hent utstyrsrader sammen med beregnet usage (total km/min/økt-antall) fra
// koblingstabellen. Beregnes ved å hente alle workout_equipment-rader for
// brukeren og slå opp duration/distance på workouts.
export async function listEquipmentWithUsage(filter?: {
  category?: EquipmentCategory | null
  status?: EquipmentStatus | null
}): Promise<EquipmentWithUsage[]> {
  const equipment = await listEquipment(filter)
  if (equipment.length === 0) return []

  const supabase = await createClient()
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

  return equipment.map(e => ({ ...e, usage: usageById.get(e.id)! }))
}

export async function getEquipmentById(id: string): Promise<EquipmentWithUsage | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return null

  const equipment = data as Equipment
  const list = await listEquipmentWithUsage()
  const found = list.find(e => e.id === equipment.id)
  return found ?? { ...equipment, usage: { equipment_id: equipment.id, total_km: 0, total_minutes: 0, workout_count: 0 } }
}

// Hent økt-historikk for et utstyr. Returnerer økter sortert etter dato (nyeste først).
export async function listWorkoutsForEquipment(equipmentId: string): Promise<Array<{
  id: string
  date: string
  title: string
  sport: string
  distance_km: number | null
  duration_minutes: number | null
}>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: links } = await supabase
    .from('workout_equipment')
    .select('workout_id')
    .eq('equipment_id', equipmentId)
  if (!links || links.length === 0) return []

  const workoutIds = links.map(l => l.workout_id)
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, date, title, sport, distance_km, duration_minutes, user_id')
    .in('id', workoutIds)
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  return (workouts ?? []).map(w => ({
    id: w.id,
    date: w.date,
    title: w.title,
    sport: w.sport,
    distance_km: w.distance_km,
    duration_minutes: w.duration_minutes,
  }))
}

function validateInput(input: SaveEquipmentInput): string | null {
  const name = input.name?.trim() ?? ''
  if (name.length === 0) return 'Navn er påkrevd'
  if (!EQUIPMENT_CATEGORIES.includes(input.category)) return 'Ugyldig kategori'
  if (input.status && !EQUIPMENT_STATUSES.includes(input.status)) return 'Ugyldig status'
  return null
}

export async function saveEquipment(input: SaveEquipmentInput): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const err = validateInput(input)
  if (err) return { error: err }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('equipment')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      category: input.category,
      brand: input.brand?.trim() || null,
      model: input.model?.trim() || null,
      sport: input.sport?.trim() || null,
      image_url: input.image_url?.trim() || null,
      purchase_date: input.purchase_date || null,
      price_kr: typeof input.price_kr === 'number' ? input.price_kr : null,
      status: input.status ?? 'active',
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Kunne ikke lagre utstyr' }
  revalidatePath('/app/utstyr')
  return { id: data.id }
}

export async function updateEquipment(input: UpdateEquipmentInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  if (input.name !== undefined && input.name.trim().length === 0) return { error: 'Navn er påkrevd' }
  if (input.category !== undefined && !EQUIPMENT_CATEGORIES.includes(input.category)) return { error: 'Ugyldig kategori' }
  if (input.status !== undefined && !EQUIPMENT_STATUSES.includes(input.status)) return { error: 'Ugyldig status' }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.category !== undefined) patch.category = input.category
  if (input.brand !== undefined) patch.brand = input.brand?.trim() || null
  if (input.model !== undefined) patch.model = input.model?.trim() || null
  if (input.sport !== undefined) patch.sport = input.sport?.trim() || null
  if (input.image_url !== undefined) patch.image_url = input.image_url?.trim() || null
  if (input.purchase_date !== undefined) patch.purchase_date = input.purchase_date || null
  if (input.price_kr !== undefined) patch.price_kr = typeof input.price_kr === 'number' ? input.price_kr : null
  if (input.status !== undefined) patch.status = input.status
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

  const { error } = await supabase
    .from('equipment')
    .update(patch)
    .eq('id', input.id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app/utstyr')
  revalidatePath(`/app/utstyr/${input.id}`)
  return {}
}

export async function deleteEquipment(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase.from('equipment').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/utstyr')
  return {}
}

export async function duplicateEquipment(id: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: original } = await supabase
    .from('equipment')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!original) return { error: 'Fant ikke utstyret' }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('equipment')
    .insert({
      user_id: user.id,
      name: `${original.name} (kopi)`,
      category: original.category,
      brand: original.brand,
      model: original.model,
      sport: original.sport,
      image_url: original.image_url,
      purchase_date: null,
      price_kr: null,
      status: 'active',
      notes: original.notes,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke duplisere' }
  revalidatePath('/app/utstyr')
  return { id: data.id }
}

// ── Workout-kobling ──────────────────────────────────────────
//
// setWorkoutEquipment erstatter alle koblinger for en gitt økt med den nye
// listen. Brukes fra WorkoutForm når brukeren submitter med "Utstyr brukt"-valg.
export async function setWorkoutEquipment(workoutId: string, equipmentIds: string[]): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // Verifiser at økten tilhører brukeren før vi rydder.
  const { data: w } = await supabase
    .from('workouts')
    .select('id')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!w) return { error: 'Fant ikke økten' }

  await supabase.from('workout_equipment').delete().eq('workout_id', workoutId)

  const unique = Array.from(new Set(equipmentIds.filter(Boolean)))
  if (unique.length > 0) {
    const rows = unique.map(equipment_id => ({ workout_id: workoutId, equipment_id }))
    const { error } = await supabase.from('workout_equipment').insert(rows)
    if (error) return { error: error.message }
  }

  revalidatePath('/app/utstyr')
  revalidatePath('/app/dagbok')
  return {}
}

export async function getWorkoutEquipmentIds(workoutId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: w } = await supabase
    .from('workouts')
    .select('id')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!w) return []
  const { data } = await supabase
    .from('workout_equipment')
    .select('equipment_id')
    .eq('workout_id', workoutId)
  return (data ?? []).map(r => r.equipment_id)
}

// ── Ski-spesifikk data (Fase 37) ─────────────────────────────

export async function getSkiData(equipmentId: string): Promise<EquipmentSkiData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // RLS sikrer at vi bare ser ski-data for vårt eget utstyr.
  const { data } = await supabase
    .from('equipment_ski_data')
    .select('*')
    .eq('equipment_id', equipmentId)
    .maybeSingle()
  return (data as EquipmentSkiData | null) ?? null
}

// Upsert ski-data. Verifiserer at utstyret tilhører brukeren og er av kategori 'ski'.
export async function saveSkiData(input: SaveSkiDataInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  if (input.ski_type !== undefined && input.ski_type !== null && !SKI_TYPES.includes(input.ski_type)) {
    return { error: 'Ugyldig ski-type' }
  }

  const { data: equipment } = await supabase
    .from('equipment')
    .select('id, category')
    .eq('id', input.equipment_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!equipment) return { error: 'Fant ikke utstyret' }
  if (equipment.category !== 'ski') return { error: 'Ski-data kan kun lagres for ski' }

  const row = {
    equipment_id: input.equipment_id,
    ski_type: input.ski_type ?? null,
    length_cm: typeof input.length_cm === 'number' ? input.length_cm : null,
    camber: input.camber?.trim() || null,
    current_slip: input.current_slip?.trim() || null,
    slip_date: input.slip_date || null,
    slip_by: input.slip_by?.trim() || null,
    current_wax: input.current_wax?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('equipment_ski_data')
    .upsert(row, { onConflict: 'equipment_id' })
  if (error) return { error: error.message }

  revalidatePath('/app/utstyr/ski')
  revalidatePath(`/app/utstyr/${input.equipment_id}`)
  return {}
}

// Hent alle ski + ski_data for skipark-visning. Filtrer på ski_type ved behov.
export async function listSkiEquipment(filter?: { ski_type?: SkiType | null }): Promise<SkiEquipment[]> {
  const all = await listEquipmentWithUsage({ category: 'ski', status: 'active' })
  if (all.length === 0) return []

  const supabase = await createClient()
  const ids = all.map(e => e.id)
  const { data: skiRows } = await supabase
    .from('equipment_ski_data')
    .select('*')
    .in('equipment_id', ids)

  const byId = new Map<string, EquipmentSkiData>()
  for (const r of (skiRows ?? [])) byId.set(r.equipment_id, r as EquipmentSkiData)

  const merged: SkiEquipment[] = all.map(e => ({ ...e, ski_data: byId.get(e.id) ?? null }))
  if (filter?.ski_type) return merged.filter(s => s.ski_data?.ski_type === filter.ski_type)
  return merged
}

export async function getEquipmentForWorkout(workoutId: string): Promise<Equipment[]> {
  const ids = await getWorkoutEquipmentIds(workoutId)
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('equipment')
    .select('*')
    .in('id', ids)
    .eq('user_id', user.id)
  return (data ?? []) as Equipment[]
}
