'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import type { FocusPoint, FocusScope, FocusContext } from '@/lib/focus-point-types'

function validScope(s: string): s is FocusScope {
  return s === 'day' || s === 'week' || s === 'month'
}
function validContext(c: string): c is FocusContext {
  return c === 'plan' || c === 'dagbok'
}

function revalidateContext(context: FocusContext) {
  if (context === 'plan') revalidatePath('/app/plan')
  else revalidatePath('/app/dagbok')
}

function requiredPermFor(context: FocusContext) {
  return context === 'dagbok' ? 'can_view_dagbok' : 'can_edit_plan'
}

export async function getFocusPoints(
  scope: FocusScope, periodKey: string, context: FocusContext, targetUserId?: string,
): Promise<FocusPoint[] | { error: string }> {
  try {
    if (!validScope(scope) || !validContext(context)) return { error: 'Ugyldig parameter' }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, requiredPermFor(context))
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('focus_points')
      .select('*')
      .eq('user_id', resolved.userId)
      .eq('scope', scope)
      .eq('period_key', periodKey)
      .eq('context', context)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return { error: error.message }
    return (data ?? []) as FocusPoint[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// Henter både plan- og dagbok-punktene i én runde (Dagbok-visning trenger begge).
export async function getFocusPointsBoth(
  scope: FocusScope, periodKey: string, targetUserId?: string,
): Promise<{ plan: FocusPoint[]; dagbok: FocusPoint[] } | { error: string }> {
  try {
    if (!validScope(scope)) return { error: 'Ugyldig scope' }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_view_dagbok')
    if ('error' in resolved) return { error: resolved.error }

    const { data, error } = await supabase
      .from('focus_points')
      .select('*')
      .eq('user_id', resolved.userId)
      .eq('scope', scope)
      .eq('period_key', periodKey)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return { error: error.message }
    const rows = (data ?? []) as FocusPoint[]
    return {
      plan: rows.filter(r => r.context === 'plan'),
      dagbok: rows.filter(r => r.context === 'dagbok'),
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function addFocusPoint(
  scope: FocusScope, periodKey: string, context: FocusContext, content: string, targetUserId?: string,
): Promise<{ id?: string; error?: string }> {
  try {
    if (!validScope(scope) || !validContext(context)) return { error: 'Ugyldig parameter' }
    const trimmed = content.trim()
    if (!trimmed) return { error: 'Innhold er påkrevd' }
    if (!periodKey) return { error: 'Periode-nøkkel mangler' }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, requiredPermFor(context))
    if ('error' in resolved) return { error: resolved.error }

    const { data: maxRow } = await supabase
      .from('focus_points')
      .select('sort_order')
      .eq('user_id', resolved.userId)
      .eq('scope', scope)
      .eq('period_key', periodKey)
      .eq('context', context)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrder = (maxRow?.sort_order ?? -1) + 1

    const { data, error } = await supabase
      .from('focus_points')
      .insert({
        user_id: resolved.userId,
        scope, period_key: periodKey, context,
        content: trimmed,
        sort_order: nextOrder,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidateContext(context)
    return { id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateFocusPoint(
  id: string, content: string, targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    const trimmed = content.trim()
    if (!trimmed) return { error: 'Innhold er påkrevd' }

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
    if ('error' in resolved) return { error: resolved.error }

    const { data: existing, error: fetchErr } = await supabase
      .from('focus_points')
      .select('context')
      .eq('id', id)
      .eq('user_id', resolved.userId)
      .single()
    if (fetchErr) return { error: fetchErr.message }

    const { error } = await supabase
      .from('focus_points')
      .update({ content: trimmed })
      .eq('id', id)
      .eq('user_id', resolved.userId)

    if (error) return { error: error.message }
    revalidateContext(existing.context as FocusContext)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteFocusPoint(
  id: string, targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
    if ('error' in resolved) return { error: resolved.error }

    const { data: existing, error: fetchErr } = await supabase
      .from('focus_points')
      .select('context')
      .eq('id', id)
      .eq('user_id', resolved.userId)
      .single()
    if (fetchErr) return { error: fetchErr.message }

    const { error } = await supabase
      .from('focus_points')
      .delete()
      .eq('id', id)
      .eq('user_id', resolved.userId)

    if (error) return { error: error.message }
    revalidateContext(existing.context as FocusContext)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function reorderFocusPoints(
  ids: string[], targetUserId?: string,
): Promise<{ error?: string }> {
  try {
    if (!Array.isArray(ids) || ids.length === 0) return {}

    const supabase = await createClient()
    const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
    if ('error' in resolved) return { error: resolved.error }

    const { data: rows, error: fetchErr } = await supabase
      .from('focus_points')
      .select('id,context')
      .in('id', ids)
      .eq('user_id', resolved.userId)
    if (fetchErr) return { error: fetchErr.message }

    const contexts = new Set<FocusContext>((rows ?? []).map(r => r.context as FocusContext))

    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from('focus_points')
        .update({ sort_order: i })
        .eq('id', ids[i])
        .eq('user_id', resolved.userId)
      if (error) return { error: error.message }
    }

    for (const c of contexts) revalidateContext(c)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
