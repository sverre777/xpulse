'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport } from '@/lib/types'

// Datalag for /app/trener/utovere — utvider trener-dashboard-kortet med
// 7-dagers og 30-dagers volum per utøver.

export type UtoverStatus = 'active' | 'delayed' | 'inactive'

export interface UtoverPeriodStats {
  sessions: number
  minutes: number
  km: number
}

export interface UtoverCard {
  id: string
  name: string
  avatarUrl: string | null
  primarySport: Sport | null
  mainGoal: string | null
  lastWorkoutDate: string | null
  lastWorkoutTitle: string | null
  status: UtoverStatus
  unreadCount: number
  stats7d: UtoverPeriodStats
  stats30d: UtoverPeriodStats
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(isoDate: string, today: Date): number {
  const d = new Date(isoDate + 'T00:00:00')
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((t.getTime() - d.getTime()) / 86400000)
}

function deriveStatus(lastIso: string | null, today: Date): UtoverStatus {
  if (!lastIso) return 'inactive'
  const d = daysBetween(lastIso, today)
  if (d <= 1) return 'active'
  if (d <= 2) return 'delayed'
  return 'inactive'
}

export async function getCoachUtovere(): Promise<
  { athletes: UtoverCard[] } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('has_coach_role')
    .eq('id', user.id)
    .single()
  if (profErr || !profile) return { error: 'Fant ikke profil' }
  if (!profile.has_coach_role) return { error: 'Brukeren har ikke trener-rolle' }

  const { data: relationsRaw, error: relErr } = await supabase
    .from('coach_athlete_relations')
    .select('athlete_id')
    .eq('coach_id', user.id)
    .eq('status', 'active')
  if (relErr) return { error: relErr.message }

  const athleteIds = (relationsRaw ?? []).map(r => r.athlete_id)
  if (athleteIds.length === 0) return { athletes: [] }

  const today = new Date()
  const horizon30 = new Date(today); horizon30.setDate(today.getDate() - 29)
  const horizon7 = new Date(today); horizon7.setDate(today.getDate() - 6)
  const horizon30Iso = isoDay(horizon30)
  const horizon7Iso = isoDay(horizon7)

  const [profilesRes, workoutsRes, seasonsRes, unreadMessagesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, primary_sport')
      .in('id', athleteIds),
    supabase
      .from('workouts')
      .select('id, user_id, title, date, duration_minutes, distance_km, is_planned, is_completed')
      .in('user_id', athleteIds)
      .gte('date', horizon30Iso)
      .eq('is_planned', false),
    supabase
      .from('seasons')
      .select('user_id, goal_main, end_date')
      .in('user_id', athleteIds)
      .order('end_date', { ascending: false }),
    supabase
      .from('messages')
      .select('sender_id')
      .eq('recipient_id', user.id)
      .eq('is_read', false)
      .in('sender_id', athleteIds),
  ])

  if (profilesRes.error) return { error: profilesRes.error.message }

  const profilesById = new Map<string, {
    id: string; full_name: string | null; avatar_url: string | null; primary_sport: Sport | null
  }>()
  for (const p of profilesRes.data ?? []) profilesById.set(p.id, p)

  // Aggreger 7d og 30d, og finn siste gjennomførte økt.
  const stats30 = new Map<string, UtoverPeriodStats>()
  const stats7 = new Map<string, UtoverPeriodStats>()
  const lastByAthlete = new Map<string, { date: string; title: string }>()

  for (const id of athleteIds) {
    stats30.set(id, { sessions: 0, minutes: 0, km: 0 })
    stats7.set(id, { sessions: 0, minutes: 0, km: 0 })
  }

  for (const w of workoutsRes.data ?? []) {
    if (!w.is_completed) continue
    const m30 = stats30.get(w.user_id)
    if (m30) {
      m30.sessions += 1
      m30.minutes += Number(w.duration_minutes) || 0
      m30.km += Number(w.distance_km) || 0
    }
    if (w.date >= horizon7Iso) {
      const m7 = stats7.get(w.user_id)
      if (m7) {
        m7.sessions += 1
        m7.minutes += Number(w.duration_minutes) || 0
        m7.km += Number(w.distance_km) || 0
      }
    }
    const existing = lastByAthlete.get(w.user_id)
    if (!existing || w.date > existing.date) {
      lastByAthlete.set(w.user_id, { date: w.date, title: w.title })
    }
  }

  const mainGoalByAthlete = new Map<string, string>()
  for (const s of seasonsRes.data ?? []) {
    if (mainGoalByAthlete.has(s.user_id)) continue
    if (s.goal_main) mainGoalByAthlete.set(s.user_id, s.goal_main as string)
  }

  const unreadBySender = new Map<string, number>()
  for (const m of unreadMessagesRes.data ?? []) {
    unreadBySender.set(m.sender_id, (unreadBySender.get(m.sender_id) ?? 0) + 1)
  }

  const athletes: UtoverCard[] = athleteIds.map(id => {
    const p = profilesById.get(id)
    const last = lastByAthlete.get(id) ?? null
    return {
      id,
      name: p?.full_name ?? 'Ukjent utøver',
      avatarUrl: p?.avatar_url ?? null,
      primarySport: p?.primary_sport ?? null,
      mainGoal: mainGoalByAthlete.get(id) ?? null,
      lastWorkoutDate: last?.date ?? null,
      lastWorkoutTitle: last?.title ?? null,
      status: deriveStatus(last?.date ?? null, today),
      unreadCount: unreadBySender.get(id) ?? 0,
      stats7d: stats7.get(id) ?? { sessions: 0, minutes: 0, km: 0 },
      stats30d: stats30.get(id) ?? { sessions: 0, minutes: 0, km: 0 },
    }
  })

  return { athletes }
}
