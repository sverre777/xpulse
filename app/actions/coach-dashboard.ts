'use server'

import { createClient } from '@/lib/supabase/server'
import type { Sport } from '@/lib/types'

// ── Typer som eksponeres til komponentene ───────────────────

export type AthleteLoggingStatus = 'active' | 'delayed' | 'inactive'

export interface CoachAthleteCard {
  id: string
  name: string
  avatarUrl: string | null
  primarySport: Sport | null
  mainGoal: string | null
  lastWorkoutDate: string | null       // ISO yyyy-MM-dd
  lastWorkoutTitle: string | null
  status: AthleteLoggingStatus
  unreadCount: number                  // uleste meldinger fra denne utøveren
}

export type FeedItemType = 'workout_logged' | 'workout_completed' | 'sick' | 'rest' | 'goal_reached'

export interface CoachFeedItem {
  id: string
  type: FeedItemType
  athleteId: string
  athleteName: string
  label: string
  timestamp: string                    // ISO
  href: string                         // dypkobling til trener-utøverside
}

export interface CoachGroupSummary {
  id: string
  name: string
  memberCount: number
}

export interface CoachDashboardData {
  userName: string | null
  firstName: string
  stats: {
    activeAthletes: number
    unreadNotifications: number
  }
  athletes: CoachAthleteCard[]
  feed: CoachFeedItem[]
  groups: CoachGroupSummary[]
}

// ── Helpers ─────────────────────────────────────────────────

function daysBetween(isoDate: string, today: Date): number {
  const d = new Date(isoDate + 'T00:00:00')
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((t.getTime() - d.getTime()) / 86400000)
}

function deriveStatus(lastIso: string | null, today: Date): AthleteLoggingStatus {
  if (!lastIso) return 'inactive'
  const d = daysBetween(lastIso, today)
  if (d <= 1) return 'active'
  if (d <= 2) return 'delayed'
  return 'inactive'
}

function firstNameOf(name: string | null): string {
  if (!name) return 'Utøver'
  return name.split(' ')[0] ?? name
}

// ── Hovedfunksjon ───────────────────────────────────────────

export async function getCoachDashboard(): Promise<
  CoachDashboardData | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('full_name, has_coach_role, active_role')
    .eq('id', user.id)
    .single()
  if (profErr || !profile) return { error: 'Fant ikke profil' }
  if (!profile.has_coach_role) return { error: 'Brukeren har ikke trener-rolle' }

  // Hent alle aktive relasjoner.
  const { data: relationsRaw, error: relErr } = await supabase
    .from('coach_athlete_relations')
    .select('athlete_id, created_at')
    .eq('coach_id', user.id)
    .eq('status', 'active')
  if (relErr) return { error: relErr.message }

  const relations = relationsRaw ?? []
  const athleteIds = relations.map(r => r.athlete_id)

  // Hvis ingen utøvere, returner tom struktur.
  if (athleteIds.length === 0) {
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    const { data: groupMemRows } = await supabase
      .from('coach_group_members')
      .select('group_id')
      .eq('user_id', user.id)
    const groupIds = (groupMemRows ?? []).map(g => g.group_id)
    const groups = await fetchGroupsWithCounts(supabase, groupIds)
    return {
      userName: profile.full_name,
      firstName: firstNameOf(profile.full_name),
      stats: { activeAthletes: 0, unreadNotifications: unreadCount ?? 0 },
      athletes: [],
      feed: [],
      groups,
    }
  }

  // Parallelle batch-spørringer.
  const today = new Date()
  const feedHorizon = new Date(today); feedHorizon.setDate(today.getDate() - 14)
  const feedHorizonIso = feedHorizon.toISOString().slice(0, 10)

  const [
    profilesRes,
    workoutsRes,
    dayStatesRes,
    seasonsRes,
    unreadMessagesRes,
    unreadNotificationsRes,
    groupsMembershipRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, primary_sport')
      .in('id', athleteIds),
    supabase
      .from('workouts')
      .select('id, user_id, title, date, created_at, updated_at, is_planned, is_completed')
      .in('user_id', athleteIds)
      .gte('date', feedHorizonIso)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('day_states')
      .select('id, user_id, date, state_type, created_at')
      .in('user_id', athleteIds)
      .gte('date', feedHorizonIso)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('seasons')
      .select('user_id, name, goal_main, end_date')
      .in('user_id', athleteIds)
      .order('end_date', { ascending: false }),
    supabase
      .from('messages')
      .select('sender_id')
      .eq('recipient_id', user.id)
      .eq('is_read', false)
      .in('sender_id', athleteIds),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
    supabase
      .from('coach_group_members')
      .select('group_id')
      .eq('user_id', user.id),
  ])

  if (profilesRes.error) return { error: profilesRes.error.message }

  const profilesById = new Map<string, {
    id: string; full_name: string | null; avatar_url: string | null; primary_sport: Sport | null
  }>()
  for (const p of profilesRes.data ?? []) profilesById.set(p.id, p)

  // Siste gjennomførte økt per utøver (sortert desc på date, deretter created_at).
  const lastCompletedByAthlete = new Map<string, { date: string; title: string }>()
  for (const w of workoutsRes.data ?? []) {
    if (!w.is_completed) continue
    const existing = lastCompletedByAthlete.get(w.user_id)
    if (!existing || w.date > existing.date) {
      lastCompletedByAthlete.set(w.user_id, { date: w.date, title: w.title })
    }
  }

  // Hovedmål: første (nyeste end_date) sesong med goal_main per utøver.
  const mainGoalByAthlete = new Map<string, string>()
  for (const s of seasonsRes.data ?? []) {
    if (mainGoalByAthlete.has(s.user_id)) continue
    if (s.goal_main) mainGoalByAthlete.set(s.user_id, s.goal_main as string)
  }

  // Uleste meldinger per avsender.
  const unreadBySender = new Map<string, number>()
  for (const m of unreadMessagesRes.data ?? []) {
    unreadBySender.set(m.sender_id, (unreadBySender.get(m.sender_id) ?? 0) + 1)
  }

  // Bygg utøver-kort.
  const athletes: CoachAthleteCard[] = athleteIds.map(id => {
    const p = profilesById.get(id)
    const last = lastCompletedByAthlete.get(id) ?? null
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
    }
  })
  // Sorter: uleste først, så røde, så gule, så grønne.
  const statusRank: Record<AthleteLoggingStatus, number> = { inactive: 0, delayed: 1, active: 2 }
  athletes.sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
    if (a.status !== b.status) return statusRank[a.status] - statusRank[b.status]
    return a.name.localeCompare(b.name, 'nb')
  })

  // Aktivitetsfeed: flett workouts og day_states, sorter på created_at desc.
  type RawFeed = {
    sort: string
    item: CoachFeedItem
  }
  const rawFeed: RawFeed[] = []
  for (const w of workoutsRes.data ?? []) {
    const p = profilesById.get(w.user_id)
    const athleteName = firstNameOf(p?.full_name ?? null)
    const type: FeedItemType = w.is_completed ? 'workout_completed' : 'workout_logged'
    const verb = w.is_completed ? 'loggførte' : 'planla'
    rawFeed.push({
      sort: w.created_at,
      item: {
        id: `w:${w.id}`,
        type,
        athleteId: w.user_id,
        athleteName: p?.full_name ?? 'Utøver',
        label: `${athleteName} ${verb} ${w.title}`,
        timestamp: w.created_at,
        href: `/app/trener/${w.user_id}`,
      },
    })
  }
  for (const s of dayStatesRes.data ?? []) {
    const p = profilesById.get(s.user_id)
    const athleteName = firstNameOf(p?.full_name ?? null)
    const type: FeedItemType = s.state_type === 'sykdom' ? 'sick' : 'rest'
    const label =
      s.state_type === 'sykdom'
        ? `${athleteName} markerte syk`
        : `${athleteName} markerte hviledag`
    rawFeed.push({
      sort: s.created_at,
      item: {
        id: `d:${s.id}`,
        type,
        athleteId: s.user_id,
        athleteName: p?.full_name ?? 'Utøver',
        label,
        timestamp: s.created_at,
        href: `/app/trener/${s.user_id}`,
      },
    })
  }
  rawFeed.sort((a, b) => (a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : 0))
  const feed = rawFeed.slice(0, 10).map(r => r.item)

  // Grupper: hent grupper jeg er medlem i og tell medlemmer.
  const groupIds = (groupsMembershipRes.data ?? []).map(g => g.group_id)
  const groups = await fetchGroupsWithCounts(supabase, groupIds)

  return {
    userName: profile.full_name,
    firstName: firstNameOf(profile.full_name),
    stats: {
      activeAthletes: athletes.length,
      unreadNotifications: unreadNotificationsRes.count ?? 0,
    },
    athletes,
    feed,
    groups,
  }
}

async function fetchGroupsWithCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupIds: string[],
): Promise<CoachGroupSummary[]> {
  if (groupIds.length === 0) return []
  const [groupsRes, countsRes] = await Promise.all([
    supabase.from('coach_groups').select('id, name').in('id', groupIds),
    supabase.from('coach_group_members').select('group_id').in('group_id', groupIds),
  ])
  if (groupsRes.error) return []
  const counts = new Map<string, number>()
  for (const row of countsRes.data ?? []) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1)
  }
  return (groupsRes.data ?? [])
    .map(g => ({ id: g.id, name: g.name, memberCount: counts.get(g.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
}

// ── Enkle write-actions for gruppe-opprettelse ──────────────

export async function createCoachGroup(formData: FormData): Promise<{ error?: string; id?: string }> {
  const name = (formData.get('name') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() ?? null
  if (!name) return { error: 'Navn er påkrevd' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: group, error } = await supabase
    .from('coach_groups')
    .insert({ name, description, created_by: user.id })
    .select('id')
    .single()
  if (error || !group) return { error: error?.message ?? 'Kunne ikke opprette gruppe' }

  // Oppretter blir admin.
  const { error: memErr } = await supabase
    .from('coach_group_members')
    .insert({ group_id: group.id, user_id: user.id, role: 'admin' })
  if (memErr) return { error: memErr.message }

  return { id: group.id }
}
