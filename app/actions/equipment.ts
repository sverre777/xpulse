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
  EquipmentGrind,
  AddGrindInput,
  SaveSkiDataInput,
  SkiEquipment,
  SkiType,
  WorkoutEquipmentSelection,
} from '@/lib/equipment-types'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_STATUSES,
  SKI_TYPES,
  normalizeCategory,
} from '@/lib/equipment-types'
import { beregnEquipmentUsage, tellerSomGjennomfort } from '@/lib/equipment-usage'

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

// Hent utstyrsrader sammen med beregnet usage (total km/min/økt-antall).
// Fase 101: koblingene kan være «hele økta»-arv (activity_id null → øktas
// totaler, som før) eller per-aktivitet-overstyringer (radens km/varighet).
// Selve regnestykket bor i lib/equipment-usage.ts (delt med trenersiden,
// voktet av scripts/utstyr-usage-selftest.ts).
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
    .select('equipment_id, workout_id, activity_id')
    .in('equipment_id', ids)

  const workoutById = new Map<string, { distance_km: number | null; duration_minutes: number | null; is_completed: boolean | null }>()
  const activityById = new Map<string, { workout_id: string; distance_meters: number | null; duration_seconds: number | null }>()
  if (links && links.length > 0) {
    const workoutIds = Array.from(new Set(links.map(l => l.workout_id)))
    // is_completed MÅ med: planlagt utstyr teller 0 km / 0 min (lib/equipment-usage).
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, distance_km, duration_minutes, is_completed')
      .in('id', workoutIds)
    for (const w of (workouts ?? [])) workoutById.set(w.id, w)

    // Aktivitets-tall trengs kun for overstyrte rader.
    const activityIds = Array.from(new Set(links.map(l => l.activity_id).filter((x): x is string => x !== null)))
    if (activityIds.length > 0) {
      const { data: acts } = await supabase
        .from('workout_activities')
        .select('id, workout_id, distance_meters, duration_seconds')
        .in('id', activityIds)
      for (const a of (acts ?? [])) activityById.set(a.id, a)
    }
  }

  const categoryByEquipment = new Map(equipment.map(e => [e.id, normalizeCategory(e.category)]))
  const usageById = beregnEquipmentUsage(
    ids,
    (links ?? []) as Array<{ equipment_id: string; workout_id: string; activity_id: string | null }>,
    workoutById,
    activityById,
    categoryByEquipment,
  )

  // Fase 99: start-km («km allerede gått») legges til tellingen — historisk
  // utstyr starter ikke på null.
  for (const e of equipment) {
    const startKm = typeof e.start_km === 'number' ? e.start_km : 0
    if (startKm > 0) usageById.get(e.id)!.total_km += startKm
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
  // Kun gjennomførte økter: en planlagt økt har ingen registrerte km/tid ennå.
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, date, title, sport, distance_km, duration_minutes, user_id')
    .in('id', workoutIds)
    .eq('user_id', user.id)
    .eq('is_completed', true)
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
      // Fase 99-kolonner — betinget payload (fase 96/98-mønsteret): sendes bare
      // når feltet faktisk er satt, så eldre kallere overlever deploy før migrering.
      ...(typeof input.start_km === 'number' && input.start_km > 0 ? { start_km: input.start_km } : {}),
      ...(input.size?.trim() ? { size: input.size.trim() } : {}),
      ...(input.usage_type?.trim() ? { usage_type: input.usage_type.trim() } : {}),
      ...(typeof input.length_cm === 'number' ? { length_cm: input.length_cm } : {}),
      ...(input.subtype?.trim() ? { subtype: input.subtype.trim() } : {}),
      ...(input.wheel_type?.trim() ? { wheel_type: input.wheel_type.trim() } : {}),
      ...(input.resistance?.trim() ? { resistance: input.resistance.trim() } : {}),
      ...(input.resistance_front?.trim() ? { resistance_front: input.resistance_front.trim() } : {}),
      ...(input.resistance_rear?.trim() ? { resistance_rear: input.resistance_rear.trim() } : {}),
      ...(input.cleat_system?.trim() ? { cleat_system: input.cleat_system.trim() } : {}),
      ...(input.drivetrain?.trim() ? { drivetrain: input.drivetrain.trim() } : {}),
      ...(input.wheelset?.trim() ? { wheelset: input.wheelset.trim() } : {}),
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
  // Fase 99-felter: samme !== undefined-mønster som resten — kallere som ikke
  // sender feltene (eldre deploys) skriver dem heller ikke.
  if (input.start_km !== undefined) patch.start_km = typeof input.start_km === 'number' ? input.start_km : 0
  if (input.size !== undefined) patch.size = input.size?.trim() || null
  if (input.usage_type !== undefined) patch.usage_type = input.usage_type?.trim() || null
  if (input.length_cm !== undefined) patch.length_cm = typeof input.length_cm === 'number' ? input.length_cm : null
  if (input.subtype !== undefined) patch.subtype = input.subtype?.trim() || null
  if (input.wheel_type !== undefined) patch.wheel_type = input.wheel_type?.trim() || null
  if (input.resistance !== undefined) patch.resistance = input.resistance?.trim() || null
  if (input.resistance_front !== undefined) patch.resistance_front = input.resistance_front?.trim() || null
  if (input.resistance_rear !== undefined) patch.resistance_rear = input.resistance_rear?.trim() || null
  if (input.cleat_system !== undefined) patch.cleat_system = input.cleat_system?.trim() || null
  if (input.drivetrain !== undefined) patch.drivetrain = input.drivetrain?.trim() || null
  if (input.wheelset !== undefined) patch.wheelset = input.wheelset?.trim() || null

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
// setWorkoutEquipment erstatter alle koblinger for en gitt økt med det nye
// utvalget. Fase 101: utvalget kan i tillegg til «hele økta»-arv inneholde
// per-aktivitet-overstyringer (⇄ på raden). Aktivitetene identifiseres med
// sort_order siden DB-idene reinsertes ved hver lagring — vi slår opp de
// ferske idene her. En ren string[] betyr som før «kun arv».
export async function setWorkoutEquipment(
  workoutId: string,
  selection: string[] | WorkoutEquipmentSelection,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const sel: WorkoutEquipmentSelection = Array.isArray(selection)
    ? { heleOkta: selection, perAktivitet: [] }
    : selection

  // Verifiser at økten tilhører brukeren før vi rydder.
  const { data: w } = await supabase
    .from('workouts')
    .select('id')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!w) return { error: 'Fant ikke økten' }

  // Arv-radene erstattes alltid. Overstyringene røres kun når skjemaet faktisk
  // eier dem (dagbok-modus) — se bevarOverstyringer.
  if (sel.bevarOverstyringer) {
    await supabase.from('workout_equipment').delete()
      .eq('workout_id', workoutId).is('activity_id', null)
  } else {
    await supabase.from('workout_equipment').delete().eq('workout_id', workoutId)
  }

  const rows: Array<{ workout_id: string; equipment_id: string; activity_id?: string }> = []
  const arv = Array.from(new Set(sel.heleOkta.filter(Boolean)))
  for (const equipment_id of arv) rows.push({ workout_id: workoutId, equipment_id })

  const overstyringer = sel.bevarOverstyringer ? [] : sel.perAktivitet.filter(p => p.equipmentIds.length > 0)
  if (overstyringer.length > 0) {
    const { data: acts } = await supabase
      .from('workout_activities')
      .select('id, sort_order')
      .eq('workout_id', workoutId)
    const idBySortOrder = new Map<number, string>()
    for (const a of (acts ?? [])) idBySortOrder.set(a.sort_order, a.id)
    for (const p of overstyringer) {
      const activityId = idBySortOrder.get(p.sortOrder)
      if (!activityId) continue
      for (const equipment_id of Array.from(new Set(p.equipmentIds.filter(Boolean)))) {
        rows.push({ workout_id: workoutId, equipment_id, activity_id: activityId })
      }
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('workout_equipment').insert(rows)
    if (error) return { error: error.message }
  }

  revalidatePath('/app/utstyr')
  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
  return {}
}

export async function getWorkoutEquipmentIds(workoutId: string): Promise<string[]> {
  const sel = await getWorkoutEquipmentSelection(workoutId)
  return sel.heleOkta
}

// Hele utvalget for redigering: arv + overstyringer keyet på sort_order.
export async function getWorkoutEquipmentSelection(workoutId: string): Promise<WorkoutEquipmentSelection> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { heleOkta: [], perAktivitet: [] }
  const { data: w } = await supabase
    .from('workouts')
    .select('id')
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!w) return { heleOkta: [], perAktivitet: [] }

  const { data } = await supabase
    .from('workout_equipment')
    .select('equipment_id, activity_id')
    .eq('workout_id', workoutId)

  const heleOkta = (data ?? []).filter(r => r.activity_id == null).map(r => r.equipment_id)
  const overstyrte = (data ?? []).filter((r): r is { equipment_id: string; activity_id: string } => r.activity_id != null)

  const perAktivitet: WorkoutEquipmentSelection['perAktivitet'] = []
  if (overstyrte.length > 0) {
    const { data: acts } = await supabase
      .from('workout_activities')
      .select('id, sort_order')
      .eq('workout_id', workoutId)
    const sortOrderById = new Map<string, number>()
    for (const a of (acts ?? [])) sortOrderById.set(a.id, a.sort_order)
    const bySortOrder = new Map<number, string[]>()
    for (const r of overstyrte) {
      const so = sortOrderById.get(r.activity_id)
      if (so === undefined) continue
      const arr = bySortOrder.get(so)
      if (arr) arr.push(r.equipment_id)
      else bySortOrder.set(so, [r.equipment_id])
    }
    for (const [sortOrder, equipmentIds] of bySortOrder) perAktivitet.push({ sortOrder, equipmentIds })
  }

  return { heleOkta, perAktivitet }
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
// Merge-semantikk: felter som er undefined i input røres IKKE — så delskjemaer
// (f.eks. ski-detaljene uten slip-feltene) ikke nuller ut andres verdier.
// Felter som er satt (også tom streng) skrives; tom streng → null.
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

  const { data: existing } = await supabase
    .from('equipment_ski_data')
    .select('*')
    .eq('equipment_id', input.equipment_id)
    .maybeSingle()

  const row = {
    equipment_id: input.equipment_id,
    ski_type: input.ski_type !== undefined ? input.ski_type : (existing?.ski_type ?? null),
    length_cm: input.length_cm !== undefined
      ? (typeof input.length_cm === 'number' ? input.length_cm : null)
      : (existing?.length_cm ?? null),
    camber: input.camber !== undefined ? (input.camber?.trim() || null) : (existing?.camber ?? null),
    current_slip: input.current_slip !== undefined ? (input.current_slip?.trim() || null) : (existing?.current_slip ?? null),
    slip_date: input.slip_date !== undefined ? (input.slip_date || null) : (existing?.slip_date ?? null),
    slip_by: input.slip_by !== undefined ? (input.slip_by?.trim() || null) : (existing?.slip_by ?? null),
    current_wax: input.current_wax !== undefined ? (input.current_wax?.trim() || null) : (existing?.current_wax ?? null),
    notes: input.notes !== undefined ? (input.notes?.trim() || null) : (existing?.notes ?? null),
    usage_type: input.usage_type !== undefined ? (input.usage_type || null) : (existing?.usage_type ?? null),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('equipment_ski_data')
    .upsert(row, { onConflict: 'equipment_id' })
  if (error) return { error: error.message }

  // Fase 99: slip er HISTORIKK — en satt slip speiles inn i equipment_grinds
  // (ny rad OPPÅ) hvis nyeste historikkrad ikke allerede er samme slip.
  if (row.current_slip) {
    const { data: newest } = await supabase
      .from('equipment_grinds')
      .select('grind')
      .eq('equipment_id', input.equipment_id)
      .order('grind_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!newest || newest.grind !== row.current_slip) {
      await supabase.from('equipment_grinds').insert({
        equipment_id: input.equipment_id,
        grind: row.current_slip,
        grind_date: row.slip_date ?? new Date().toISOString().slice(0, 10),
        ground_by: row.slip_by,
      })
    }
  }

  revalidatePath('/app/utstyr/ski')
  revalidatePath(`/app/utstyr/${input.equipment_id}`)
  return {}
}

// ── Sliphistorikk (Fase 99) ──────────────────────────────────
//
// Ny slip legges alltid OPPÅ som ny rad — gamle rader røres aldri.
// equipment_ski_data.current_slip/slip_date/slip_by holdes som cache av nyeste.

export async function listGrinds(equipmentId: string): Promise<EquipmentGrind[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  // RLS begrenser til eget utstyr (+ trener-lesing).
  const { data } = await supabase
    .from('equipment_grinds')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('grind_date', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as EquipmentGrind[]
}

export async function addGrind(input: AddGrindInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const grind = input.grind?.trim()
  if (!grind) return { error: 'Slip-navn er påkrevd' }
  if (!input.grind_date) return { error: 'Dato/årstall er påkrevd' }

  const { data: equipment } = await supabase
    .from('equipment')
    .select('id, category')
    .eq('id', input.equipment_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!equipment) return { error: 'Fant ikke utstyret' }
  if (equipment.category !== 'ski') return { error: 'Slip registreres kun på ski' }

  const { error } = await supabase.from('equipment_grinds').insert({
    equipment_id: input.equipment_id,
    grind,
    grind_date: input.grind_date,
    ground_by: input.ground_by?.trim() || null,
    notes: input.notes?.trim() || null,
  })
  if (error) return { error: error.message }

  // Oppdater cachen i ski_data KUN hvis den nye slipen faktisk er nyest —
  // etterregistrering av en gammel slip skal ikke overta som «nåværende».
  const { data: newest } = await supabase
    .from('equipment_grinds')
    .select('grind, grind_date, ground_by')
    .eq('equipment_id', input.equipment_id)
    .order('grind_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (newest) {
    await supabase
      .from('equipment_ski_data')
      .upsert({
        equipment_id: input.equipment_id,
        current_slip: newest.grind,
        slip_date: newest.grind_date,
        slip_by: newest.ground_by,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'equipment_id' })
  }

  revalidatePath('/app/utstyr/ski')
  revalidatePath(`/app/utstyr/${input.equipment_id}`)
  return {}
}

// Hent alle ski + ski_data + sliphistorikk for skipark-visning.
// km_since_slip = sum av økt-km på/etter nyeste slip-dato (null uten slip) —
// datobasert, så etterregistrerte økter telles riktig av seg selv.
export async function listSkiEquipment(filter?: { ski_type?: SkiType | null }): Promise<SkiEquipment[]> {
  const all = await listEquipmentWithUsage({ category: 'ski', status: 'active' })
  if (all.length === 0) return []

  const supabase = await createClient()
  const ids = all.map(e => e.id)
  const [{ data: skiRows }, { data: grindRows }, { data: links }] = await Promise.all([
    supabase.from('equipment_ski_data').select('*').in('equipment_id', ids),
    supabase.from('equipment_grinds').select('*').in('equipment_id', ids)
      .order('grind_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('workout_equipment').select('equipment_id, workout_id').in('equipment_id', ids),
  ])

  const byId = new Map<string, EquipmentSkiData>()
  for (const r of (skiRows ?? [])) byId.set(r.equipment_id, r as EquipmentSkiData)

  const grindsById = new Map<string, EquipmentGrind[]>()
  for (const id of ids) grindsById.set(id, [])
  for (const g of (grindRows ?? [])) grindsById.get(g.equipment_id)?.push(g as EquipmentGrind)

  // Km siden siste slip: trenger dato per økt — hent date + distance for koblede økter.
  const workoutById = new Map<string, { date: string; distance_km: number | null; is_completed: boolean | null }>()
  if (links && links.length > 0) {
    const workoutIds = Array.from(new Set(links.map(l => l.workout_id)))
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, date, distance_km, is_completed')
      .in('id', workoutIds)
    for (const w of (workouts ?? [])) workoutById.set(w.id, w)
  }

  const merged: SkiEquipment[] = all.map(e => {
    const grinds = grindsById.get(e.id) ?? []
    const skiData = byId.get(e.id) ?? null
    // Nyeste slip-dato: historikken vinner, ski_data.slip_date som fallback
    // (rader fra før historikken fantes).
    const sisteSlipDato = grinds[0]?.grind_date ?? skiData?.slip_date ?? null
    let kmSinceSlip: number | null = null
    if (sisteSlipDato) {
      kmSinceSlip = 0
      for (const link of (links ?? [])) {
        if (link.equipment_id !== e.id) continue
        const w = workoutById.get(link.workout_id)
        if (!w || !tellerSomGjennomfort(w) || w.date < sisteSlipDato) continue
        if (typeof w.distance_km === 'number') kmSinceSlip += w.distance_km
      }
    }
    return { ...e, ski_data: skiData, grinds, km_since_slip: kmSinceSlip }
  })
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
