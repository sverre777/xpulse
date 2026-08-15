'use server'

// Kø #47 bolk 4: EGNE skytetest-maler (shooting_test_templates, fase 85).
// Standardbiblioteket (NSSF) er låst i kode — se lib/shooting-test-templates.
// Egne maler er private (RLS user_id = auth.uid()); ingen trener-deling her.

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

export interface OwnShootingTest {
  id: string
  name: string
  config: {
    surface: 'papp' | 'metall' | 'issf' | ''
    scoring: 'treff' | 'ring'
    series: { position: 'L' | 'S'; shots: number }[]
  }
}

export async function listMyShootingTests(): Promise<OwnShootingTest[] | { error: string }> {
  try {
    const supabase = await createClient()
    const user = await getAuthUser()
    if (!user) return { error: 'Ikke innlogget' }
    const { data, error } = await supabase
      .from('shooting_test_templates')
      .select('id, name, config')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) return { error: error.message }
    return (data ?? []) as OwnShootingTest[]
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function saveMyShootingTest(
  name: string,
  config: OwnShootingTest['config'],
): Promise<{ id?: string; error?: string }> {
  try {
    if (!name.trim()) return { error: 'Navn er påkrevd' }
    if (!config.series || config.series.length === 0) return { error: 'Malen må ha minst én serie' }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }
    const { data, error } = await supabase
      .from('shooting_test_templates')
      .insert({ user_id: user.id, name: name.trim(), config })
      .select('id')
      .single()
    if (error) return { error: error.message }
    return { id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteMyShootingTest(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Ikke innlogget' }
    const { error } = await supabase
      .from('shooting_test_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
