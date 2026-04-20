'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type NoteScope = 'week' | 'month'
export type NoteContext = 'plan' | 'dagbok'

export interface PeriodNote {
  scope: NoteScope
  period_key: string
  context: NoteContext
  note: string
}

// Hent kommentarer for en gitt periode og kontekst.
export async function getPeriodNotes(
  scope: NoteScope,
  periodKeys: string[],
  context: NoteContext,
): Promise<Record<string, string>> {
  if (periodKeys.length === 0) return {}
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data } = await supabase
    .from('period_notes')
    .select('period_key, note')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .eq('context', context)
    .in('period_key', periodKeys)

  const out: Record<string, string> = {}
  for (const row of (data ?? []) as { period_key: string; note: string }[]) {
    out[row.period_key] = row.note
  }
  return out
}

export async function savePeriodNote(input: {
  scope: NoteScope
  period_key: string
  context: NoteContext
  note: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const trimmed = input.note.trim()

  // Tom tekst → slett raden (hold tabellen ryddig).
  if (trimmed === '') {
    const { error } = await supabase
      .from('period_notes')
      .delete()
      .eq('user_id', user.id)
      .eq('scope', input.scope)
      .eq('period_key', input.period_key)
      .eq('context', input.context)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('period_notes')
      .upsert({
        user_id: user.id,
        scope: input.scope,
        period_key: input.period_key,
        context: input.context,
        note: trimmed,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,scope,period_key,context' })
    if (error) return { error: error.message }
  }

  revalidatePath('/app/dagbok')
  revalidatePath('/app/plan')
  return {}
}
