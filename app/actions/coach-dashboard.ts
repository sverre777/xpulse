'use server'

import { revalidatePath } from 'next/cache'
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

export interface CoachOverviewAthlete {
  id: string
  fullName: string | null
}

export interface NextCompetitionInfo {
  date: string                  // YYYY-MM-DD
  workoutType: string           // 'competition' | 'testlop' | 'test'
  workoutTypeLabel: string
  title: string
  athletes: CoachOverviewAthlete[]
  hrefBase: string              // peker mot første utøvers visning av økten
}

export interface NextGroupSessionInfo {
  date: string
  label: string | null
  title: string
  sport: string
  athletes: CoachOverviewAthlete[]
  hrefBase: string
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

// ── Trener-oversikt: neste konkurranse og neste fellestrening ──────────

const COMPETITION_TYPES = ['competition', 'testlop', 'test'] as const
const COMPETITION_LABEL: Record<string, string> = {
  competition: 'Konkurranse',
  testlop: 'Testløp',
  test: 'Test',
}

export async function getNextCompetitionForCoach(): Promise<
  NextCompetitionInfo | null | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: rels } = await supabase
    .from('coach_athlete_relations')
    .select('athlete_id')
    .eq('coach_id', user.id)
    .eq('status', 'active')
  const athleteIds = (rels ?? []).map(r => r.athlete_id)
  if (athleteIds.length === 0) return null

  const today = new Date().toISOString().slice(0, 10)
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, user_id, date, workout_type, title')
    .in('user_id', athleteIds)
    .in('workout_type', COMPETITION_TYPES as unknown as string[])
    .eq('is_planned', true)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(50)
  if (!workouts || workouts.length === 0) return null

  const firstDate = workouts[0].date
  const onFirstDate = workouts.filter(w => w.date === firstDate)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', onFirstDate.map(w => w.user_id))
  const profById = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

  const seen = new Set<string>()
  const athletes: CoachOverviewAthlete[] = []
  for (const w of onFirstDate) {
    if (seen.has(w.user_id)) continue
    seen.add(w.user_id)
    athletes.push({ id: w.user_id, fullName: profById.get(w.user_id) ?? null })
  }

  const top = onFirstDate[0]
  return {
    date: firstDate,
    workoutType: top.workout_type,
    workoutTypeLabel: COMPETITION_LABEL[top.workout_type] ?? top.workout_type,
    title: top.title,
    athletes,
    hrefBase: `/app/trener/${top.user_id}/plan?date=${firstDate}`,
  }
}

export async function getNextGroupSessionForCoach(): Promise<
  NextGroupSessionInfo | null | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: rels } = await supabase
    .from('coach_athlete_relations')
    .select('athlete_id')
    .eq('coach_id', user.id)
    .eq('status', 'active')
  const athleteIds = (rels ?? []).map(r => r.athlete_id)
  if (athleteIds.length === 0) return null

  const today = new Date().toISOString().slice(0, 10)
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, user_id, date, title, sport, group_session_label')
    .in('user_id', athleteIds)
    .eq('is_group_session', true)
    .eq('is_planned', true)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(200)
  if (!workouts || workouts.length === 0) return null

  // Grupper på (dato, label || tittel) — krev minst 2 utøvere for å regnes
  // som fellestrening i trener-oversikt.
  type Group = {
    date: string; label: string | null
    title: string; sport: string
    userIds: Set<string>
    sampleUserId: string
  }
  const groups = new Map<string, Group>()
  for (const w of workouts) {
    const key = `${w.date}::${w.group_session_label ?? `__t:${w.title}`}`
    const existing = groups.get(key)
    if (existing) {
      existing.userIds.add(w.user_id)
    } else {
      groups.set(key, {
        date: w.date,
        label: w.group_session_label ?? null,
        title: w.title,
        sport: w.sport,
        userIds: new Set([w.user_id]),
        sampleUserId: w.user_id,
      })
    }
  }

  // Sorter: nærmeste dato først, deretter flest utøvere.
  const sorted = Array.from(groups.values())
    .filter(g => g.userIds.size >= 2)
    .sort((a, b) => a.date.localeCompare(b.date) || b.userIds.size - a.userIds.size)
  const top = sorted[0]
  if (!top) return null

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', Array.from(top.userIds))
  const profById = new Map((profiles ?? []).map(p => [p.id, p.full_name]))
  const athletes: CoachOverviewAthlete[] = Array.from(top.userIds).map(id => ({
    id,
    fullName: profById.get(id) ?? null,
  }))

  return {
    date: top.date,
    label: top.label,
    title: top.title,
    sport: top.sport,
    athletes,
    hrefBase: `/app/trener/${top.sampleUserId}/plan?date=${top.date}`,
  }
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

// ── Gruppe-detaljer og redigering ──────────────────────────

export interface CoachGroupMember {
  userId: string
  fullName: string | null
  email: string | null
  role: 'admin' | 'coach' | 'athlete'
  isViewer: boolean
}

export interface CoachGroupDetails {
  id: string
  name: string
  description: string | null
  members: CoachGroupMember[]
}

async function ensureGroupAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  groupId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('coach_group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data || data.role !== 'admin') return { ok: false, error: 'Ikke admin i gruppen' }
  return { ok: true }
}

export async function getCoachGroupDetails(
  groupId: string,
): Promise<CoachGroupDetails | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: membership } = await supabase
    .from('coach_group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return { error: 'Ingen tilgang til gruppen' }

  const [groupRes, membersRes] = await Promise.all([
    supabase.from('coach_groups').select('id, name, description').eq('id', groupId).single(),
    supabase.from('coach_group_members').select('user_id, role').eq('group_id', groupId),
  ])
  if (groupRes.error || !groupRes.data) {
    return { error: groupRes.error?.message ?? 'Fant ikke gruppe' }
  }

  const memberIds = (membersRes.data ?? []).map(m => m.user_id)
  const profilesById = new Map<string, { full_name: string | null; email: string | null }>()
  if (memberIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', memberIds)
    for (const p of profs ?? []) profilesById.set(p.id, { full_name: p.full_name, email: p.email })
  }

  const members: CoachGroupMember[] = (membersRes.data ?? []).map(m => {
    const p = profilesById.get(m.user_id)
    return {
      userId: m.user_id,
      fullName: p?.full_name ?? null,
      email: p?.email ?? null,
      role: m.role as 'admin' | 'coach' | 'athlete',
      isViewer: m.user_id === user.id,
    }
  }).sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'nb'))

  return {
    id: groupRes.data.id,
    name: groupRes.data.name,
    description: groupRes.data.description,
    members,
  }
}

export async function updateCoachGroup(
  groupId: string,
  patch: { name?: string; description?: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const guard = await ensureGroupAdmin(supabase, user.id, groupId)
  if (!guard.ok) return { error: guard.error }

  const update: { name?: string; description?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (typeof patch.name === 'string') {
    const trimmed = patch.name.trim()
    if (!trimmed) return { error: 'Navn kan ikke være tomt' }
    update.name = trimmed
  }
  if (patch.description !== undefined) {
    update.description = patch.description?.trim() || null
  }

  const { error } = await supabase.from('coach_groups').update(update).eq('id', groupId)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/grupper')
  return {}
}

export async function deleteCoachGroup(groupId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const guard = await ensureGroupAdmin(supabase, user.id, groupId)
  if (!guard.ok) return { error: guard.error }

  const { error } = await supabase.from('coach_groups').delete().eq('id', groupId)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/grupper')
  return {}
}

export async function updateCoachGroupMemberRole(
  groupId: string,
  memberUserId: string,
  role: 'admin' | 'coach' | 'athlete',
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const guard = await ensureGroupAdmin(supabase, user.id, groupId)
  if (!guard.ok) return { error: guard.error }

  const { error } = await supabase
    .from('coach_group_members')
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', memberUserId)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/grupper')
  return {}
}

export async function removeCoachGroupMember(
  groupId: string,
  memberUserId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const guard = await ensureGroupAdmin(supabase, user.id, groupId)
  if (!guard.ok) return { error: guard.error }

  // Tillat ikke å fjerne seg selv hvis det vil etterlate gruppen uten admin.
  if (memberUserId === user.id) {
    const { count } = await supabase
      .from('coach_group_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('role', 'admin')
    if ((count ?? 0) <= 1) {
      return { error: 'Gruppen må ha minst én admin' }
    }
  }

  const { error } = await supabase
    .from('coach_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', memberUserId)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/grupper')
  return {}
}

export async function addCoachGroupMembers(
  groupId: string,
  memberUserIds: string[],
  role: 'coach' | 'athlete' = 'athlete',
): Promise<{ error?: string; added?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const guard = await ensureGroupAdmin(supabase, user.id, groupId)
  if (!guard.ok) return { error: guard.error }

  if (memberUserIds.length === 0) return { added: 0 }

  const rows = memberUserIds.map(uid => ({ group_id: groupId, user_id: uid, role }))
  const { error, count } = await supabase
    .from('coach_group_members')
    .upsert(rows, { onConflict: 'group_id,user_id', count: 'exact' })
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/grupper')
  return { added: count ?? memberUserIds.length }
}
