'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Server-actions for stjerne-markerte favoritt-grafer i Analyse.
// En rad per (bruker, chart_key) i public.user_favorite_charts. Se
// supabase/phase18_favorite_charts.sql for skjema.

export interface FavoriteChart {
  chart_key: string
  sort_order: number
  created_at: string
}

export async function getFavoriteCharts(): Promise<{ favorites: FavoriteChart[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('user_favorite_charts')
    .select('chart_key, sort_order, created_at')
    .eq('user_id', user.id)
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

export async function toggleFavoriteChart(chartKey: string): Promise<{ favorited: boolean } | { error: string }> {
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
    .insert({ user_id: user.id, chart_key: key, sort_order: nextOrder })

  if (error) return { error: error.message }
  revalidatePath('/app/analyse')
  return { favorited: true }
}
