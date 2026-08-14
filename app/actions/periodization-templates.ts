'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  PeriodizationTemplate, PeriodizationTemplateData,
  SavePeriodizationTemplateInput,
} from '@/lib/template-types'

function rowToPeriodizationTemplate(row: Record<string, unknown>): PeriodizationTemplate {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    duration_days: row.duration_days as number,
    start_date: (row.start_date as string | null) ?? null,
    end_date: (row.end_date as string | null) ?? null,
    periodization_data: (row.periodization_data as PeriodizationTemplateData) ?? ({
      season: { name: '', goal_main: null, goal_secondary: null, sport: null },
      periods: [],
      key_dates: [],
    }),
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string | null) ?? (row.created_at as string),
  }
}

export async function savePeriodizationTemplate(input: SavePeriodizationTemplateInput): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const name = input.name.trim()
  if (!name) return { error: 'Navn er påkrevd' }
  if (!Number.isInteger(input.duration_days) || input.duration_days < 1) {
    return { error: 'Varighet må være minst én dag' }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase.from('periodization_templates').insert({
    user_id: user.id,
    name,
    description: input.description?.trim() || null,
    category: input.category?.trim() || null,
    duration_days: input.duration_days,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    periodization_data: input.periodization_data,
    updated_at: now,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  revalidatePath('/app/trener/planlegg')
  return { id: data.id as string }
}

export async function getPeriodizationTemplates(filter?: { category?: string; q?: string }): Promise<PeriodizationTemplate[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let q = supabase
    .from('periodization_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (filter?.category?.trim()) q = q.eq('category', filter.category.trim())
  if (filter?.q?.trim()) q = q.ilike('name', `%${filter.q.trim()}%`)

  const { data, error } = await q
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(rowToPeriodizationTemplate)
}

export async function getPeriodizationTemplate(id: string): Promise<PeriodizationTemplate | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('periodization_templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!data) return null
  return rowToPeriodizationTemplate(data as Record<string, unknown>)
}

export interface UpdatePeriodizationTemplateInput {
  name?: string
  description?: string | null
  category?: string | null
  duration_days?: number
  start_date?: string | null
  end_date?: string | null
  periodization_data?: PeriodizationTemplateData
}

export async function updatePeriodizationTemplate(
  id: string,
  patch: UpdatePeriodizationTemplateInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) {
    const n = patch.name.trim()
    if (!n) return { error: 'Navn er påkrevd' }
    update.name = n
  }
  if (patch.description !== undefined) {
    update.description = patch.description?.trim() || null
  }
  if (patch.category !== undefined) {
    update.category = patch.category?.trim() || null
  }
  if (patch.duration_days !== undefined) {
    if (!Number.isInteger(patch.duration_days) || patch.duration_days < 1) {
      return { error: 'Varighet må være minst én dag' }
    }
    update.duration_days = patch.duration_days
  }
  if (patch.start_date !== undefined) update.start_date = patch.start_date
  if (patch.end_date !== undefined) update.end_date = patch.end_date
  if (patch.periodization_data !== undefined) {
    update.periodization_data = patch.periodization_data
  }

  const { error } = await supabase
    .from('periodization_templates')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  revalidatePath('/app/trener/planlegg')
  return {}
}

export async function deletePeriodizationTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('periodization_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  revalidatePath('/app/trener/planlegg')
  return {}
}

export async function duplicatePeriodizationTemplate(id: string): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const source = await getPeriodizationTemplate(id)
  if (!source) return { error: 'Fant ikke årsplan-mal' }

  const now = new Date().toISOString()
  const { data, error } = await supabase.from('periodization_templates').insert({
    user_id: user.id,
    name: `${source.name} (kopi)`,
    description: source.description,
    category: source.category,
    duration_days: source.duration_days,
    start_date: source.start_date,
    end_date: source.end_date,
    periodization_data: source.periodization_data,
    updated_at: now,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/app/maler')
  revalidatePath('/app/trener/planlegg')
  return { id: data.id as string }
}

// Bygg periodization_data-snapshot fra en eksisterende sesong.
export async function buildPeriodizationTemplateFromSeason(
  seasonId: string,
): Promise<{ data?: PeriodizationTemplateData; duration_days?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: season, error: sErr } = await supabase
    .from('seasons')
    .select('id, name, start_date, end_date, goal_main, goal_details, kpi_notes')
    .eq('id', seasonId)
    .eq('user_id', user.id)
    .single()
  if (sErr || !season) return { error: sErr?.message ?? 'Fant ikke sesong' }

  const start = new Date(season.start_date + 'T00:00:00')
  const end = new Date(season.end_date + 'T00:00:00')
  const duration_days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const dayOffset = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    return Math.round((d.getTime() - start.getTime()) / 86400000)
  }

  const { data: periods, error: pErr } = await supabase
    .from('season_periods')
    .select('name, focus, start_date, end_date, intensity, notes, sort_order')
    .eq('season_id', seasonId)
    .order('sort_order', { ascending: true })
  if (pErr) return { error: `season_periods: ${pErr.message}` }

  const { data: keyDates, error: kErr } = await supabase
    .from('season_key_dates')
    .select('name, event_date, event_type, sport, location, distance_format, notes, is_peak_target')
    .eq('season_id', seasonId)
  if (kErr) return { error: `season_key_dates: ${kErr.message}` }

  // Del F2 (kø #39): markeringslaget (📍/🏔) fanges også — relative offsets.
  const { data: markings, error: mErr } = await supabase
    .from('season_markings')
    .select('name, is_training_camp, is_altitude, location, altitude_meters, notes, start_date, end_date')
    .eq('season_id', seasonId)
    .order('start_date', { ascending: true })
  if (mErr) return { error: `season_markings: ${mErr.message}` }

  // Volum-planer m/ ev. nedbryting (select * er tolerant før fase 83) —
  // month_offset relativt til sesongstartens måned.
  const startY = start.getFullYear()
  const startM = start.getMonth() + 1
  const { data: volumeRows, error: vErr } = await supabase
    .from('monthly_volume_plans')
    .select('*')
    .eq('user_id', user.id)
    .gte('year', startY)
    .lte('year', end.getFullYear())
  if (vErr) return { error: `monthly_volume_plans: ${vErr.message}` }
  const seasonStartKey = `${season.start_date}`.slice(0, 7)
  const seasonEndKey = `${season.end_date}`.slice(0, 7)
  const volumePlans = ((volumeRows ?? []) as {
    year: number; month: number
    planned_hours: number | null; planned_km: number | null; notes: string | null
    zone_hours?: Record<string, number> | null; movement_hours?: Record<string, number> | null
  }[])
    .filter(v => {
      const key = `${v.year}-${String(v.month).padStart(2, '0')}`
      return key >= seasonStartKey && key <= seasonEndKey
    })
    .map(v => ({
      month_offset: (v.year * 12 + (v.month - 1)) - (startY * 12 + (startM - 1)),
      planned_hours: v.planned_hours,
      planned_km: v.planned_km,
      notes: v.notes,
      ...(v.zone_hours && Object.keys(v.zone_hours).length > 0 ? { zone_hours: v.zone_hours } : {}),
      ...(v.movement_hours && Object.keys(v.movement_hours).length > 0 ? { movement_hours: v.movement_hours } : {}),
    }))
    .sort((a, b) => a.month_offset - b.month_offset)

  return {
    data: {
      season: {
        name: season.name,
        goal_main: season.goal_main ?? null,
        goal_secondary: season.goal_details ?? null,
        sport: null,
        kpi_notes: season.kpi_notes ?? null,
      },
      periods: ((periods ?? []) as {
        name: string; focus: string | null; start_date: string; end_date: string
        intensity: string; notes: string | null; sort_order: number
      }[]).map(p => ({
        start_offset: dayOffset(p.start_date),
        end_offset: dayOffset(p.end_date),
        name: p.name,
        phase_type: p.focus ?? '',
        intensity: p.intensity,
        notes: p.notes,
        sort_order: p.sort_order,
      })),
      key_dates: ((keyDates ?? []) as {
        name: string; event_date: string; event_type: string
        sport: string | null; location: string | null; distance_format: string | null
        notes: string | null; is_peak_target: boolean | null
      }[]).map(k => ({
        day_offset: dayOffset(k.event_date),
        title: k.name,
        date_type: k.event_type,
        priority: k.event_type.startsWith('competition_') ? k.event_type.slice(-1) : 'c',
        sport: k.sport,
        location: k.location ?? null,
        distance_format: k.distance_format ?? null,
        notes: k.notes,
        is_peak_target: k.is_peak_target ?? false,
      })),
      markings: ((markings ?? []) as {
        name: string; is_training_camp: boolean | null; is_altitude: boolean | null
        location: string | null; altitude_meters: number | null; notes: string | null
        start_date: string; end_date: string
      }[]).map(m => ({
        start_offset: dayOffset(m.start_date),
        end_offset: dayOffset(m.end_date),
        is_training_camp: m.is_training_camp ?? false,
        is_altitude: m.is_altitude ?? false,
        name: m.name,
        location: m.location ?? null,
        altitude_meters: m.altitude_meters ?? null,
        notes: m.notes ?? null,
      })),
      volume_plans: volumePlans,
    },
    duration_days,
  }
}
