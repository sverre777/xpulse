'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport } from '@/lib/types'

// ── Typer ───────────────────────────────────────────────────

export type Intensity = 'rolig' | 'medium' | 'hard'
export type KeyEventType =
  | 'competition_a' | 'competition_b' | 'competition_c'
  | 'test' | 'camp' | 'other'

export interface Season {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  goal_main: string | null
  goal_details: string | null
  kpi_notes: string | null
  created_at: string
  updated_at: string
}

export interface SeasonPeriod {
  id: string
  season_id: string
  name: string
  focus: string | null
  start_date: string
  end_date: string
  intensity: Intensity
  notes: string | null
  sort_order: number
  created_at: string
}

export interface SeasonKeyDate {
  id: string
  season_id: string
  event_type: KeyEventType
  event_date: string
  name: string
  sport: Sport | null
  location: string | null
  distance_format: string | null
  notes: string | null
  linked_workout_id: string | null
  created_at: string
}

export interface PeriodizationOverlay {
  season: Season | null
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
}

// ── Read actions ────────────────────────────────────────────

export async function getSeasons(): Promise<Season[] | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })

    if (error) return { error: error.message }
    return (data ?? []) as Season[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getActiveSeason(
  date?: string,
): Promise<Season | null | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const today = date ?? new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', user.id)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1)

    if (error) return { error: error.message }
    return ((data ?? [])[0] as Season | undefined) ?? null
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getSeasonPeriods(
  seasonId: string,
): Promise<SeasonPeriod[] | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const { data, error } = await supabase
      .from('season_periods')
      .select('*')
      .eq('season_id', seasonId)
      .order('start_date', { ascending: true })

    if (error) return { error: error.message }
    return (data ?? []) as SeasonPeriod[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getSeasonKeyDates(
  seasonId: string,
): Promise<SeasonKeyDate[] | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const { data, error } = await supabase
      .from('season_key_dates')
      .select('*')
      .eq('season_id', seasonId)
      .order('event_date', { ascending: true })

    if (error) return { error: error.message }
    return (data ?? []) as SeasonKeyDate[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Alt overlay-data for Plan-kalenderen i et datointervall.
// Henter sesongen som overlapper [fromDate, toDate] og dens perioder/datoer.
export async function getPeriodizationForDateRange(
  fromDate: string,
  toDate: string,
): Promise<PeriodizationOverlay | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }

    const { data: seasonRows, error: seasonErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', user.id)
      .lte('start_date', toDate)
      .gte('end_date', fromDate)
      .order('start_date', { ascending: false })
      .limit(1)

    if (seasonErr) return { error: seasonErr.message }
    const season = ((seasonRows ?? [])[0] as Season | undefined) ?? null

    if (!season) return { season: null, periods: [], keyDates: [] }

    const [periodsRes, keyDatesRes] = await Promise.all([
      supabase
        .from('season_periods')
        .select('*')
        .eq('season_id', season.id)
        .order('start_date', { ascending: true }),
      supabase
        .from('season_key_dates')
        .select('*')
        .eq('season_id', season.id)
        .order('event_date', { ascending: true }),
    ])

    if (periodsRes.error) return { error: periodsRes.error.message }
    if (keyDatesRes.error) return { error: keyDatesRes.error.message }

    return {
      season,
      periods: (periodsRes.data ?? []) as SeasonPeriod[],
      keyDates: (keyDatesRes.data ?? []) as SeasonKeyDate[],
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
