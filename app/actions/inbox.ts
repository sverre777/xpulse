'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ── Felles typer ────────────────────────────────────────────

export type ThreadKey = string // 'u:<userId>' | 'g:<groupId>'

export interface ConversationSummary {
  key: ThreadKey
  kind: 'dm' | 'group'
  title: string
  subtitle: string | null
  lastMessage: string | null
  lastAt: string | null
  unreadCount: number
  /** true hvis motparten (DM) har trener-rolle. Brukes for farge på listen. */
  counterpartIsCoach: boolean
}

export interface ThreadMessage {
  id: string
  senderId: string
  senderName: string | null
  senderIsCoach: boolean
  content: string
  isRead: boolean
  createdAt: string
}

export interface ThreadHeader {
  key: ThreadKey
  kind: 'dm' | 'group'
  title: string
  subtitle: string | null
  counterpartIsCoach: boolean
  /** For DM: den andre brukerens id. For gruppe: null. */
  counterpartId: string | null
  groupId: string | null
}

export interface InboxCommentItem {
  id: string
  athleteId: string
  athleteName: string | null
  authorId: string
  authorName: string | null
  authorIsCoach: boolean
  context: 'plan' | 'dagbok' | 'periodisering'
  scope: 'day' | 'week' | 'month' | 'workout'
  periodKey: string
  content: string
  createdAt: string
  isRead: boolean
  /** Lenke til der kommentaren hører hjemme, avhenger av om jeg er utøver eller trener. */
  href: string
}

export interface InboxNotification {
  id: string
  type: string
  title: string
  content: string | null
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

export interface InboxViewerContext {
  userId: string
  hasCoachRole: boolean
  hasAthleteRole: boolean
  activeRole: 'coach' | 'athlete'
}

// ── Hjelpere ────────────────────────────────────────────────

async function getViewer(): Promise<
  { ok: true; viewer: InboxViewerContext } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Ikke innlogget' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_coach_role, has_athlete_role, active_role')
    .eq('id', user.id)
    .single()

  return {
    ok: true,
    viewer: {
      userId: user.id,
      hasCoachRole: Boolean(profile?.has_coach_role),
      hasAthleteRole: profile?.has_athlete_role ?? true,
      activeRole: (profile?.active_role === 'coach' ? 'coach' : 'athlete') as 'coach' | 'athlete',
    },
  }
}

export async function getInboxViewer(): Promise<InboxViewerContext | { error: string }> {
  const res = await getViewer()
  if (!res.ok) return { error: res.error }
  return res.viewer
}

// ── Samtaler (conversations) ────────────────────────────────

export async function getConversations(): Promise<
  ConversationSummary[] | { error: string }
> {
  const res = await getViewer()
  if (!res.ok) return { error: res.error }
  const viewer = res.viewer
  const supabase = await createClient()

  // DM-meldinger der jeg er deltaker
  const [sentRes, receivedRes, groupMembershipRes] = await Promise.all([
    supabase
      .from('messages')
      .select('id, sender_id, recipient_id, group_id, content, is_read, created_at')
      .eq('sender_id', viewer.userId)
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('messages')
      .select('id, sender_id, recipient_id, group_id, content, is_read, created_at')
      .eq('recipient_id', viewer.userId)
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('coach_group_members')
      .select('group_id')
      .eq('user_id', viewer.userId),
  ])

  if (sentRes.error) return { error: sentRes.error.message }
  if (receivedRes.error) return { error: receivedRes.error.message }

  // Bygg DM-samtaler nøklet på motpart-id
  type DmAgg = {
    counterpartId: string
    lastMessage: string
    lastAt: string
    unread: number
  }
  const dmByCounterpart = new Map<string, DmAgg>()
  const collect = (
    rows: Array<{
      id: string; sender_id: string; recipient_id: string | null;
      group_id: string | null; content: string; is_read: boolean; created_at: string
    }>,
    incoming: boolean,
  ) => {
    for (const m of rows) {
      const counterpart = incoming ? m.sender_id : (m.recipient_id ?? '')
      if (!counterpart) continue
      const existing = dmByCounterpart.get(counterpart)
      const unreadInc = incoming && !m.is_read ? 1 : 0
      if (!existing) {
        dmByCounterpart.set(counterpart, {
          counterpartId: counterpart,
          lastMessage: m.content,
          lastAt: m.created_at,
          unread: unreadInc,
        })
      } else {
        if (m.created_at > existing.lastAt) {
          existing.lastMessage = m.content
          existing.lastAt = m.created_at
        }
        existing.unread += unreadInc
      }
    }
  }
  collect(sentRes.data ?? [], false)
  collect(receivedRes.data ?? [], true)

  const counterpartIds = Array.from(dmByCounterpart.keys())
  const counterpartProfiles = new Map<string, {
    full_name: string | null; has_coach_role: boolean | null
  }>()
  if (counterpartIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, has_coach_role')
      .in('id', counterpartIds)
    for (const p of profs ?? []) {
      counterpartProfiles.set(p.id, { full_name: p.full_name, has_coach_role: p.has_coach_role })
    }
  }

  const dmConversations: ConversationSummary[] = Array.from(dmByCounterpart.values()).map(d => {
    const p = counterpartProfiles.get(d.counterpartId)
    return {
      key: `u:${d.counterpartId}`,
      kind: 'dm',
      title: p?.full_name ?? 'Ukjent bruker',
      subtitle: null,
      lastMessage: d.lastMessage,
      lastAt: d.lastAt,
      unreadCount: d.unread,
      counterpartIsCoach: Boolean(p?.has_coach_role),
    }
  })

  // Gruppe-samtaler
  const groupIds = (groupMembershipRes.data ?? []).map(r => r.group_id).filter(Boolean)
  const groupConversations: ConversationSummary[] = []
  if (groupIds.length > 0) {
    const [groupsRes, groupMsgsRes] = await Promise.all([
      supabase.from('coach_groups').select('id, name').in('id', groupIds),
      supabase
        .from('messages')
        .select('id, group_id, content, is_read, sender_id, created_at')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    const groupById = new Map<string, { id: string; name: string }>()
    for (const g of groupsRes.data ?? []) groupById.set(g.id, { id: g.id, name: g.name })
    const lastByGroup = new Map<string, { content: string; at: string; unread: number }>()
    for (const m of groupMsgsRes.data ?? []) {
      if (!m.group_id) continue
      const existing = lastByGroup.get(m.group_id)
      const unreadInc = m.sender_id !== viewer.userId && !m.is_read ? 1 : 0
      if (!existing) {
        lastByGroup.set(m.group_id, { content: m.content, at: m.created_at, unread: unreadInc })
      } else {
        if (m.created_at > existing.at) { existing.content = m.content; existing.at = m.created_at }
        existing.unread += unreadInc
      }
    }
    for (const [gid, g] of groupById.entries()) {
      const last = lastByGroup.get(gid)
      groupConversations.push({
        key: `g:${gid}`,
        kind: 'group',
        title: g.name,
        subtitle: 'Gruppe',
        lastMessage: last?.content ?? null,
        lastAt: last?.at ?? null,
        unreadCount: last?.unread ?? 0,
        counterpartIsCoach: false,
      })
    }
  }

  const all = [...dmConversations, ...groupConversations]
  all.sort((a, b) => {
    if (!!a.lastAt !== !!b.lastAt) return a.lastAt ? -1 : 1
    if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0
    return a.title.localeCompare(b.title, 'nb')
  })
  return all
}

// ── Tråd-header og meldinger ────────────────────────────────

function parseThreadKey(key: string): { kind: 'dm' | 'group'; id: string } | null {
  if (key.startsWith('u:')) return { kind: 'dm', id: key.slice(2) }
  if (key.startsWith('g:')) return { kind: 'group', id: key.slice(2) }
  return null
}

export async function getThreadHeader(key: ThreadKey): Promise<ThreadHeader | { error: string }> {
  const parsed = parseThreadKey(key)
  if (!parsed) return { error: 'Ugyldig tråd' }
  const res = await getViewer()
  if (!res.ok) return { error: res.error }
  const supabase = await createClient()

  if (parsed.kind === 'dm') {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, has_coach_role, primary_sport')
      .eq('id', parsed.id)
      .maybeSingle()
    if (error) return { error: error.message }
    if (!profile) return { error: 'Fant ikke bruker' }
    return {
      key,
      kind: 'dm',
      title: profile.full_name ?? 'Ukjent bruker',
      subtitle: profile.has_coach_role ? 'Trener' : 'Utøver',
      counterpartIsCoach: Boolean(profile.has_coach_role),
      counterpartId: profile.id,
      groupId: null,
    }
  }

  // Gruppe: verifiser medlemskap
  const { data: membership } = await supabase
    .from('coach_group_members')
    .select('id')
    .eq('group_id', parsed.id)
    .eq('user_id', res.viewer.userId)
    .maybeSingle()
  if (!membership) return { error: 'Ingen tilgang til gruppen' }

  const [groupRes, membersRes] = await Promise.all([
    supabase.from('coach_groups').select('id, name, description').eq('id', parsed.id).maybeSingle(),
    supabase.from('coach_group_members').select('user_id').eq('group_id', parsed.id),
  ])
  if (groupRes.error || !groupRes.data) return { error: groupRes.error?.message ?? 'Fant ikke gruppe' }
  const memberCount = (membersRes.data ?? []).length
  return {
    key,
    kind: 'group',
    title: groupRes.data.name,
    subtitle: `Gruppe · ${memberCount} medlemmer`,
    counterpartIsCoach: false,
    counterpartId: null,
    groupId: parsed.id,
  }
}

export async function getThreadMessages(key: ThreadKey): Promise<ThreadMessage[] | { error: string }> {
  const parsed = parseThreadKey(key)
  if (!parsed) return { error: 'Ugyldig tråd' }
  const res = await getViewer()
  if (!res.ok) return { error: res.error }
  const viewer = res.viewer
  const supabase = await createClient()

  let query = supabase
    .from('messages')
    .select('id, sender_id, content, is_read, created_at, recipient_id, group_id')

  if (parsed.kind === 'dm') {
    // Alle meldinger mellom meg og motparten
    query = query
      .is('group_id', null)
      .or(
        `and(sender_id.eq.${viewer.userId},recipient_id.eq.${parsed.id}),` +
        `and(sender_id.eq.${parsed.id},recipient_id.eq.${viewer.userId})`,
      )
  } else {
    query = query.eq('group_id', parsed.id)
  }

  const { data, error } = await query.order('created_at', { ascending: true }).limit(500)
  if (error) return { error: error.message }

  const senderIds = Array.from(new Set((data ?? []).map(m => m.sender_id)))
  const senderInfo = new Map<string, { name: string | null; isCoach: boolean }>()
  if (senderIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, has_coach_role')
      .in('id', senderIds)
    for (const p of profs ?? []) {
      senderInfo.set(p.id, { name: p.full_name, isCoach: Boolean(p.has_coach_role) })
    }
  }

  return (data ?? []).map(m => {
    const info = senderInfo.get(m.sender_id)
    return {
      id: m.id,
      senderId: m.sender_id,
      senderName: info?.name ?? null,
      senderIsCoach: info?.isCoach ?? false,
      content: m.content,
      isRead: m.is_read,
      createdAt: m.created_at,
    }
  })
}

export async function sendMessage(
  key: ThreadKey,
  content: string,
): Promise<{ id?: string; error?: string }> {
  const body = content?.trim()
  if (!body) return { error: 'Tom melding' }
  if (body.length > 4000) return { error: 'For lang (maks 4000 tegn)' }

  const parsed = parseThreadKey(key)
  if (!parsed) return { error: 'Ugyldig tråd' }
  const res = await getViewer()
  if (!res.ok) return { error: res.error }
  const viewer = res.viewer
  const supabase = await createClient()

  if (parsed.kind === 'dm') {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: viewer.userId,
        recipient_id: parsed.id,
        group_id: null,
        content: body,
      })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'Sending feilet' }

    // Varsle mottakeren
    try {
      await supabase.from('notifications').insert({
        user_id: parsed.id,
        type: 'message',
        title: 'Ny melding',
        content: body.slice(0, 200),
        link_url: `/app/innboks/meldinger?thread=u:${viewer.userId}`,
      })
    } catch { /* ignorer */ }

    revalidatePath('/app/innboks')
    return { id: data.id }
  }

  // Gruppe: verifiser medlemskap først
  const { data: membership } = await supabase
    .from('coach_group_members')
    .select('id')
    .eq('group_id', parsed.id)
    .eq('user_id', viewer.userId)
    .maybeSingle()
  if (!membership) return { error: 'Ingen tilgang til gruppen' }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: viewer.userId,
      recipient_id: null,
      group_id: parsed.id,
      content: body,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Sending feilet' }
  revalidatePath('/app/innboks')
  return { id: data.id }
}

export async function markThreadRead(key: ThreadKey): Promise<{ error?: string }> {
  const parsed = parseThreadKey(key)
  if (!parsed) return { error: 'Ugyldig tråd' }
  const res = await getViewer()
  if (!res.ok) return { error: res.error }
  const viewer = res.viewer
  const supabase = await createClient()

  if (parsed.kind === 'dm') {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('recipient_id', viewer.userId)
      .eq('sender_id', parsed.id)
      .eq('is_read', false)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('group_id', parsed.id)
      .neq('sender_id', viewer.userId)
      .eq('is_read', false)
    if (error) return { error: error.message }
  }
  revalidatePath('/app/innboks')
  return {}
}

// ── Kommentar-feed ──────────────────────────────────────────

export async function getInboxComments(): Promise<InboxCommentItem[] | { error: string }> {
  const res = await getViewer()
  if (!res.ok) return { error: res.error }
  const viewer = res.viewer
  const supabase = await createClient()

  // Finn hvilke utøvere kommentarene skal filtreres for.
  // Hvis aktiv rolle er coach: kommentarer for alle mine aktive utøvere.
  // Hvis aktiv rolle er athlete: kommentarer der athlete_id = meg.
  let athleteIds: string[] = []
  if (viewer.activeRole === 'coach') {
    const { data: rels, error } = await supabase
      .from('coach_athlete_relations')
      .select('athlete_id')
      .eq('coach_id', viewer.userId)
      .eq('status', 'active')
    if (error) return { error: error.message }
    athleteIds = (rels ?? []).map(r => r.athlete_id)
    if (athleteIds.length === 0) return []
  } else {
    athleteIds = [viewer.userId]
  }

  const { data, error } = await supabase
    .from('coach_comments')
    .select('id, author_id, athlete_id, scope, period_key, context, content, is_read, created_at')
    .in('athlete_id', athleteIds)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { error: error.message }

  const peopleIds = new Set<string>()
  for (const c of data ?? []) { peopleIds.add(c.author_id); peopleIds.add(c.athlete_id) }
  const peopleList = Array.from(peopleIds)
  const peopleMap = new Map<string, { name: string | null; isCoach: boolean }>()
  if (peopleList.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, has_coach_role')
      .in('id', peopleList)
    for (const p of profs ?? []) {
      peopleMap.set(p.id, { name: p.full_name, isCoach: Boolean(p.has_coach_role) })
    }
  }

  return (data ?? []).map(c => {
    const author = peopleMap.get(c.author_id)
    const athlete = peopleMap.get(c.athlete_id)
    const context = c.context as 'plan' | 'dagbok' | 'periodisering'
    const contextPath =
      viewer.activeRole === 'coach'
        ? `/app/trener/${c.athlete_id}/${context}`
        : `/app/${context}`
    return {
      id: c.id,
      athleteId: c.athlete_id,
      athleteName: athlete?.name ?? null,
      authorId: c.author_id,
      authorName: author?.name ?? null,
      authorIsCoach: author?.isCoach ?? false,
      context,
      scope: c.scope as 'day' | 'week' | 'month' | 'workout',
      periodKey: c.period_key,
      content: c.content,
      createdAt: c.created_at,
      isRead: c.is_read,
      href: `${contextPath}?comment=${c.id}`,
    }
  })
}

export async function markInboxCommentRead(commentId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('coach_comments')
    .update({ is_read: true })
    .eq('id', commentId)
  if (error) return { error: error.message }
  revalidatePath('/app/innboks')
  return {}
}

// ── Varsler (notifications) ─────────────────────────────────

export async function getInboxNotifications(): Promise<InboxNotification[] | { error: string }> {
  const res = await getViewer()
  if (!res.ok) return { error: res.error }
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, content, link_url, is_read, created_at')
    .eq('user_id', res.viewer.userId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { error: error.message }

  return (data ?? []).map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    content: n.content,
    linkUrl: n.link_url,
    isRead: n.is_read,
    createdAt: n.created_at,
  }))
}

export async function markNotificationRead(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/app/innboks')
  return {}
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const res = await getViewer()
  if (!res.ok) return { error: res.error }
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', res.viewer.userId)
    .eq('is_read', false)
  if (error) return { error: error.message }
  revalidatePath('/app/innboks')
  return {}
}
