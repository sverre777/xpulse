'use server'

// Kø #48 bolk 2: standardøkt-SERIER (standard_session_series, fase 88).
// Serie = egen entitet (navn/sport/bev.form/sted/mal-kobling/beskrivelse);
// økter kobles via workouts.standard_session_series_id. Sletting av serie
// sletter ALDRI økter (FK on delete set null — kjerneprinsipp 4).
// Lesebaner bruker getAuthUser (8e657a7-mønsteret); mutasjoner auth.getUser.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { resolveTargetUser } from '@/lib/target-user'

export interface StandardSessionSeries {
  id: string
  name: string
  sport: string | null
  movement_name: string | null
  location: string | null
  template_id: string | null
  description: string | null
  workout_count: number
  last_date: string | null
}

export async function listMySessionSeries(): Promise<StandardSessionSeries[] | { error: string }> {
  try {
    const supabase = await createClient()
    const user = await getAuthUser()
    if (!user) return { error: 'Ikke innlogget' }

    const [{ data: rows, error }, { data: links, error: lErr }] = await Promise.all([
      supabase
        .from('standard_session_series')
        .select('id, name, sport, movement_name, location, template_id, description')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('workouts')
        .select('standard_session_series_id, date')
        .eq('user_id', user.id)
        .not('standard_session_series_id', 'is', null),
    ])
    if (error) return { error: error.message }
    if (lErr) return { error: lErr.message }

    const counts = new Map<string, { n: number; last: string | null }>()
    for (const l of (links ?? [])) {
      const id = l.standard_session_series_id as string
      const prev = counts.get(id) ?? { n: 0, last: null }
      prev.n += 1
      const d = l.date as string
      if (prev.last == null || d > prev.last) prev.last = d
      counts.set(id, prev)
    }
    return (rows ?? []).map(r => ({
      id: r.id as string,
      name: r.name as string,
      sport: (r.sport as string | null) ?? null,
      movement_name: (r.movement_name as string | null) ?? null,
      location: (r.location as string | null) ?? null,
      template_id: (r.template_id as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      workout_count: counts.get(r.id as string)?.n ?? 0,
      last_date: counts.get(r.id as string)?.last ?? null,
    }))
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function createSessionSeries(input: {
  name: string
  location?: string
  sport?: string
  movement_name?: string
  template_id?: string | null
}): Promise<{ id?: string; error?: string }> {
  const name = input.name.trim()
  if (!name) return { error: 'Navn er påkrevd' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('standard_session_series')
    .insert({
      user_id: user.id,
      name,
      location: input.location?.trim() || null,
      sport: input.sport ?? null,
      movement_name: input.movement_name?.trim() || null,
      template_id: input.template_id ?? null,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Kunne ikke opprette serie' }
  revalidatePath('/app/analyse')
  return { id: data.id as string }
}

export async function updateSessionSeries(id: string, patch: {
  name?: string
  location?: string | null
  movement_name?: string | null
  description?: string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) {
    const n = patch.name.trim()
    if (!n) return { error: 'Navn er påkrevd' }
    update.name = n
  }
  if (patch.location !== undefined) update.location = patch.location?.trim() || null
  if (patch.movement_name !== undefined) update.movement_name = patch.movement_name?.trim() || null
  if (patch.description !== undefined) update.description = patch.description?.trim() || null

  const { error } = await supabase
    .from('standard_session_series')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/analyse')
  return {}
}

// ── Kø #48 bolk 3: BIBLIOTEKET under Analyse ────────────────
// Serieliste m/ gjennomføringer (kronologisk) for sparkline + seriedetalj.
// Trener leser via resolveTargetUser + can_view_analysis — aldri egen logikk.

export interface SeriesExecution {
  workout_id: string
  date: string
  title: string
  total_seconds: number | null
  distance_meters: number | null
  avg_heart_rate: number | null
}

export interface SessionSeriesWithExecutions extends StandardSessionSeries {
  executions: SeriesExecution[]   // kronologisk stigende, kun gjennomførte
}

export async function getSessionSeriesLibrary(
  targetUserId?: string,
): Promise<SessionSeriesWithExecutions[] | { error: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_analysis', 'read')
    if ('error' in resolved) return { error: resolved.error }
    const userId = resolved.userId

    const [{ data: rows, error }, { data: links, error: lErr }] = await Promise.all([
      supabase
        .from('standard_session_series')
        .select('id, name, sport, movement_name, location, template_id, description')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('workouts')
        .select('id, date, title, duration_minutes, distance_km, avg_heart_rate, standard_session_series_id')
        .eq('user_id', userId)
        .not('standard_session_series_id', 'is', null)
        .or('is_completed.eq.true,and(is_planned.eq.false,live_started_at.is.null)')
        .order('date', { ascending: true }),
    ])
    if (error) return { error: error.message }
    if (lErr) return { error: lErr.message }

    const bySerie = new Map<string, SeriesExecution[]>()
    for (const l of (links ?? [])) {
      const sid = l.standard_session_series_id as string
      const arr = bySerie.get(sid) ?? []
      arr.push({
        workout_id: l.id as string,
        date: l.date as string,
        title: (l.title as string | null) ?? '',
        total_seconds: l.duration_minutes != null ? (l.duration_minutes as number) * 60 : null,
        distance_meters: l.distance_km != null ? Math.round((l.distance_km as number) * 1000) : null,
        avg_heart_rate: (l.avg_heart_rate as number | null) ?? null,
      })
      bySerie.set(sid, arr)
    }

    return (rows ?? []).map(r => {
      const executions = bySerie.get(r.id as string) ?? []
      return {
        id: r.id as string,
        name: r.name as string,
        sport: (r.sport as string | null) ?? null,
        movement_name: (r.movement_name as string | null) ?? null,
        location: (r.location as string | null) ?? null,
        template_id: (r.template_id as string | null) ?? null,
        description: (r.description as string | null) ?? null,
        workout_count: executions.length,
        last_date: executions.length > 0 ? executions[executions.length - 1].date : null,
        executions,
      }
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Slette serie = KUN koblingen forsvinner fra øktene (FK on delete set null).
// Bekreftelsesdialogen på klienten skal si akkurat det.
export async function deleteSessionSeries(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('standard_session_series')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/analyse')
  return {}
}
