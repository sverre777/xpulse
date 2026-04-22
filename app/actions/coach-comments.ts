'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type CommentScope = 'day' | 'week' | 'month' | 'workout'
export type CommentContext = 'plan' | 'dagbok' | 'periodisering'

export interface CoachComment {
  id: string
  authorId: string
  authorName: string | null
  authorRole: 'athlete' | 'coach'
  athleteId: string
  scope: CommentScope
  periodKey: string
  context: CommentContext
  content: string
  parentId: string | null
  isRead: boolean
  createdAt: string
}

export async function getCoachComments(
  athleteId: string,
  context: CommentContext,
  scope: CommentScope,
  periodKey: string,
): Promise<CoachComment[] | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // Verifiser at brukeren er enten utøveren selv eller aktiv trener for utøveren.
  if (user.id !== athleteId) {
    const { data: rel } = await supabase
      .from('coach_athlete_relations')
      .select('id')
      .eq('coach_id', user.id)
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .maybeSingle()
    if (!rel) return { error: 'Ingen tilgang' }
  }

  const { data, error } = await supabase
    .from('coach_comments')
    .select('id, author_id, athlete_id, scope, period_key, context, content, parent_id, is_read, created_at')
    .eq('athlete_id', athleteId)
    .eq('context', context)
    .eq('scope', scope)
    .eq('period_key', periodKey)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const authorIds = Array.from(new Set((data ?? []).map(c => c.author_id)))
  const authorInfo = new Map<string, { name: string | null; isCoach: boolean }>()
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', authorIds)
    for (const p of profiles ?? []) {
      authorInfo.set(p.id, { name: p.full_name, isCoach: p.id !== athleteId })
    }
  }

  return (data ?? []).map(c => {
    const info = authorInfo.get(c.author_id)
    return {
      id: c.id,
      authorId: c.author_id,
      authorName: info?.name ?? null,
      authorRole: c.author_id === athleteId ? 'athlete' : 'coach',
      athleteId: c.athlete_id,
      scope: c.scope as CommentScope,
      periodKey: c.period_key,
      context: c.context as CommentContext,
      content: c.content,
      parentId: c.parent_id,
      isRead: c.is_read,
      createdAt: c.created_at,
    }
  })
}

export async function addCoachComment(
  input: {
    athleteId: string
    context: CommentContext
    scope: CommentScope
    periodKey: string
    content: string
    parentId?: string | null
  },
): Promise<{ id?: string; error?: string }> {
  const content = input.content?.trim()
  if (!content) return { error: 'Tom kommentar' }
  if (content.length > 4000) return { error: 'For lang (maks 4000 tegn)' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // RLS vil kaste bort ugyldige innsetninger, men vi sjekker først for å gi
  // bedre feilmeldinger.
  if (user.id !== input.athleteId) {
    const { data: rel } = await supabase
      .from('coach_athlete_relations')
      .select('id')
      .eq('coach_id', user.id)
      .eq('athlete_id', input.athleteId)
      .eq('status', 'active')
      .maybeSingle()
    if (!rel) return { error: 'Ingen aktiv relasjon til denne utøveren' }
  }

  const { data, error } = await supabase
    .from('coach_comments')
    .insert({
      author_id: user.id,
      athlete_id: input.athleteId,
      scope: input.scope,
      period_key: input.periodKey,
      context: input.context,
      content,
      parent_id: input.parentId ?? null,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Lagring feilet' }

  // Opprett varsel for mottakeren (utøver eller trener) hvis kommentaren er fra motparten.
  try {
    if (user.id !== input.athleteId) {
      // Trener skrev → varsle utøver.
      await supabase.from('notifications').insert({
        user_id: input.athleteId,
        type: 'coach_comment',
        title: 'Ny kommentar fra trener',
        content: content.slice(0, 200),
        link_url: `/app/${input.context === 'periodisering' ? 'periodisering' : input.context}?comment=${data.id}`,
      })
    } else {
      // Utøver skrev → varsle alle aktive trenere.
      const { data: rels } = await supabase
        .from('coach_athlete_relations')
        .select('coach_id')
        .eq('athlete_id', input.athleteId)
        .eq('status', 'active')
      for (const r of rels ?? []) {
        await supabase.from('notifications').insert({
          user_id: r.coach_id,
          type: 'athlete_comment',
          title: 'Ny kommentar fra utøver',
          content: content.slice(0, 200),
          link_url: `/app/trener/${input.athleteId}/${input.context === 'periodisering' ? 'periodisering' : input.context}?comment=${data.id}`,
        })
      }
    }
  } catch {
    // Varsel-svikt skal ikke blokkere selve kommentaren.
  }

  revalidatePath(`/app/trener/${input.athleteId}`)
  revalidatePath(`/app/${input.context === 'periodisering' ? 'periodisering' : input.context}`)
  return { id: data.id }
}

export async function markCommentRead(commentId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('coach_comments')
    .update({ is_read: true })
    .eq('id', commentId)
  if (error) return { error: error.message }
  return {}
}
