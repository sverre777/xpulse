'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Server-actions for stjerne-markerte favoritt-grafer i Analyse.
// En rad per (bruker, chart_key) i public.user_favorite_charts. Se
// supabase/phase18_favorite_charts.sql for skjema.

export type FavorittConfig = Record<string, unknown>

export interface FavoriteChart {
  chart_key: string
  sort_order: number
  created_at: string
  /** Fase 122: lagret oppsett for custom-grafer (jsonb). null = standardoppsett. */
  config: FavorittConfig | null
}

/** targetUserId (trenervisning): UTØVERENS favoritter — lesing via policy
    «Coaches can view athlete favorite charts» (fase 122, aktiv relasjon). */
export async function getFavoriteCharts(targetUserId?: string): Promise<{ favorites: FavoriteChart[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('user_favorite_charts')
    .select('chart_key, sort_order, created_at, config')
    .eq('user_id', targetUserId ?? user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { favorites: (data ?? []) as FavoriteChart[] }
}

export async function addFavoriteChart(chartKey: string): Promise<{ error?: string }> {
  const key = chartKey.trim()
  if (key === '') return { error: 'Mangler chart_key' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // Plasser nyeste stjerne sist via max(sort_order)+1. Unik-constraint hindrer duplikat.
  const { data: maxRow } = await supabase
    .from('user_favorite_charts')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.sort_order ?? -1) + 1

  const { error } = await supabase
    .from('user_favorite_charts')
    .upsert(
      { user_id: user.id, chart_key: key, sort_order: nextOrder },
      { onConflict: 'user_id,chart_key', ignoreDuplicates: true },
    )

  if (error) return { error: error.message }
  revalidatePath('/app/analyse')
  return {}
}

export async function removeFavoriteChart(chartKey: string): Promise<{ error?: string }> {
  const key = chartKey.trim()
  if (key === '') return { error: 'Mangler chart_key' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('user_favorite_charts')
    .delete()
    .eq('user_id', user.id)
    .eq('chart_key', key)

  if (error) return { error: error.message }
  revalidatePath('/app/analyse')
  return {}
}

export async function toggleFavoriteChart(chartKey: string, config?: FavorittConfig | null): Promise<{ favorited: boolean } | { error: string }> {
  const key = chartKey.trim()
  if (key === '') return { error: 'Mangler chart_key' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: existing } = await supabase
    .from('user_favorite_charts')
    .select('id')
    .eq('user_id', user.id)
    .eq('chart_key', key)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('user_favorite_charts')
      .delete()
      .eq('user_id', user.id)
      .eq('chart_key', key)
    if (error) return { error: error.message }
    revalidatePath('/app/analyse')
    return { favorited: false }
  }

  const { data: maxRow } = await supabase
    .from('user_favorite_charts')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.sort_order ?? -1) + 1

  const { error } = await supabase
    .from('user_favorite_charts')
    .insert({ user_id: user.id, chart_key: key, sort_order: nextOrder, config: config ?? null })

  if (error) return { error: error.message }
  revalidatePath('/app/analyse')
  return { favorited: true }
}

/** Oppsettet på en custom-favoritt (fase 122) — skrives når brukeren endrer
    kontrollene på en stjernet graf. Egne rader bare (RLS). */
export async function saveFavoriteConfig(chartKey: string, config: FavorittConfig | null): Promise<{ error?: string }> {
  const key = chartKey.trim()
  if (key === '') return { error: 'Mangler chart_key' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('user_favorite_charts')
    .update({ config })
    .eq('user_id', user.id)
    .eq('chart_key', key)
  if (error) return { error: error.message }
  return {}
}

/** Ny rekkefølge for favorittene (Favoritter-fanen, dra-og-slipp). Skriver
    sort_order = plass i lista; nøkler som ikke er med beholder sin. */
export async function reorderFavoriteCharts(chartKeys: string[]): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const keys = chartKeys.map(k => k.trim()).filter(k => k !== '')
  if (keys.length === 0) return {}
  const { error } = await supabase
    .from('user_favorite_charts')
    .upsert(keys.map((chart_key, sort_order) => ({ user_id: user.id, chart_key, sort_order })), { onConflict: 'user_id,chart_key' })
  if (error) return { error: error.message }
  revalidatePath('/app/analyse')
  return {}
}
