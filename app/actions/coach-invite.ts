'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Unngå forvekslbare tegn: I, O, 0, 1
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const CODE_TTL_DAYS = 7

function randomCode(): string {
  let out = ''
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return `XP-${out}`
}

export interface ActiveInviteCode {
  id: string
  code: string
  expiresAt: string
  createdAt: string
}

export interface AthleteCoachRelation {
  id: string
  coachId: string
  coachName: string | null
  coachEmail: string | null
  status: 'pending' | 'active' | 'inactive'
  createdAt: string
  can_edit_plan: boolean
  can_view_dagbok: boolean
  can_view_analysis: boolean
  can_edit_periodization: boolean
}

export interface AthletePermissionsPatch {
  can_edit_plan?: boolean
  can_view_dagbok?: boolean
  can_view_analysis?: boolean
  can_edit_periodization?: boolean
}

// ── Utøver: hent aktiv kode + koblinger ─────────────────────

export async function getAthleteCoachSetup(): Promise<
  { activeCode: ActiveInviteCode | null; relations: AthleteCoachRelation[] } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const nowIso = new Date().toISOString()
  const [codesRes, relationsRes] = await Promise.all([
    supabase
      .from('coach_invite_codes')
      .select('id, code, expires_at, used_at, created_at')
      .eq('athlete_id', user.id)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('coach_athlete_relations')
      .select('id, coach_id, status, created_at, can_edit_plan, can_view_dagbok, can_view_analysis, can_edit_periodization')
      .eq('athlete_id', user.id)
      .neq('status', 'inactive')
      .order('created_at', { ascending: false }),
  ])

  if (codesRes.error) return { error: codesRes.error.message }
  if (relationsRes.error) return { error: relationsRes.error.message }

  const coachIds = Array.from(new Set((relationsRes.data ?? []).map(r => r.coach_id)))
  const coachMap = new Map<string, { name: string | null; email: string | null }>()
  if (coachIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', coachIds)
    for (const p of profiles ?? []) {
      coachMap.set(p.id, { name: p.full_name, email: p.email })
    }
  }

  const active = (codesRes.data ?? [])[0]
  return {
    activeCode: active ? {
      id: active.id,
      code: active.code,
      expiresAt: active.expires_at,
      createdAt: active.created_at,
    } : null,
    relations: (relationsRes.data ?? []).map(r => {
      const c = coachMap.get(r.coach_id)
      return {
        id: r.id,
        coachId: r.coach_id,
        coachName: c?.name ?? null,
        coachEmail: c?.email ?? null,
        status: r.status as AthleteCoachRelation['status'],
        createdAt: r.created_at,
        can_edit_plan: r.can_edit_plan ?? true,
        can_view_dagbok: r.can_view_dagbok ?? true,
        can_view_analysis: r.can_view_analysis ?? true,
        can_edit_periodization: r.can_edit_periodization ?? true,
      }
    }),
  }
}

// ── Utøver: generer ny kode (overskriver gammel) ────────────

export async function generateInviteCode(): Promise<
  { code: string; expiresAt: string } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // Fjern tidligere ubrukte koder for denne utøveren.
  await supabase
    .from('coach_invite_codes')
    .delete()
    .eq('athlete_id', user.id)
    .is('used_at', null)

  const expiresAt = new Date(Date.now() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Prøv opptil 5 ganger ved eventuell unik-kollisjon.
  let lastError: string | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const { data, error } = await supabase
      .from('coach_invite_codes')
      .insert({ athlete_id: user.id, code, expires_at: expiresAt })
      .select('code, expires_at')
      .single()
    if (!error && data) {
      revalidatePath('/app/innstillinger/trener')
      return { code: data.code, expiresAt: data.expires_at }
    }
    lastError = error?.message ?? 'Ukjent feil'
    // 23505 = unique_violation — prøv igjen med ny kode
    if (!error || !/23505|unique/i.test(error.message)) break
  }
  return { error: lastError ?? 'Kunne ikke generere kode' }
}

// ── Utøver: oppdater permissions eller tilbakekall relasjon ─

export async function updateCoachPermissions(
  relationId: string, patch: AthletePermissionsPatch,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('coach_athlete_relations')
    .update(patch)
    .eq('id', relationId)
    .eq('athlete_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/trener')
  return {}
}

export async function revokeTrainerRelation(
  relationId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('coach_athlete_relations')
    .update({ status: 'inactive' })
    .eq('id', relationId)
    .eq('athlete_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger/trener')
  return {}
}

// ── Trener: løs inn kode ────────────────────────────────────

export interface RedeemResult {
  relationId: string
  athleteId: string
  athleteName: string | null
  alreadyConnected: boolean
}

export async function redeemInviteCode(
  rawCode: string,
): Promise<RedeemResult | { error: string }> {
  const code = (rawCode ?? '').trim().toUpperCase()
  if (!code) return { error: 'Kode er påkrevd' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // Sjekk at brukeren har trener-rolle.
  const { data: profile } = await supabase
    .from('profiles')
    .select('has_coach_role, active_role')
    .eq('id', user.id)
    .single()
  if (!profile?.has_coach_role) return { error: 'Brukeren har ikke trener-rolle' }

  const { data: invite, error: inviteErr } = await supabase
    .from('coach_invite_codes')
    .select('id, athlete_id, expires_at, used_at')
    .eq('code', code)
    .maybeSingle()
  if (inviteErr) return { error: inviteErr.message }
  if (!invite) return { error: 'Koden finnes ikke eller er utløpt' }
  if (invite.used_at) return { error: 'Koden er allerede brukt' }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { error: 'Koden er utløpt' }
  }
  if (invite.athlete_id === user.id) {
    return { error: 'Du kan ikke bruke din egen kode' }
  }

  // Opprett eller reaktiver relasjon (unique(coach_id, athlete_id)).
  const { data: existing } = await supabase
    .from('coach_athlete_relations')
    .select('id, status')
    .eq('coach_id', user.id)
    .eq('athlete_id', invite.athlete_id)
    .maybeSingle()

  let relationId: string
  let alreadyConnected = false
  if (existing) {
    alreadyConnected = existing.status === 'active'
    if (existing.status !== 'active') {
      const { error: upErr } = await supabase
        .from('coach_athlete_relations')
        .update({
          status: 'active',
          can_edit_plan: true,
          can_view_dagbok: true,
          can_view_analysis: true,
          can_edit_periodization: true,
        })
        .eq('id', existing.id)
      if (upErr) return { error: upErr.message }
    }
    relationId = existing.id
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('coach_athlete_relations')
      .insert({
        coach_id: user.id,
        athlete_id: invite.athlete_id,
        status: 'active',
        can_edit_plan: true,
        can_view_dagbok: true,
        can_view_analysis: true,
        can_edit_periodization: true,
      })
      .select('id')
      .single()
    if (insErr || !inserted) return { error: insErr?.message ?? 'Kunne ikke opprette kobling' }
    relationId = inserted.id
  }

  // Marker koden som brukt.
  await supabase
    .from('coach_invite_codes')
    .update({ used_at: new Date().toISOString(), used_by_coach_id: user.id })
    .eq('id', invite.id)

  // Hent utøvernavn for bekreftelse.
  const { data: athleteProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', invite.athlete_id)
    .single()

  // Varsle utøveren.
  try {
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    await supabase.from('notifications').insert({
      user_id: invite.athlete_id,
      type: 'coach_connected',
      title: 'Trener koblet til',
      content: `${coachProfile?.full_name ?? 'En trener'} er nå koblet til din konto.`,
      link_url: '/app/innstillinger/trener',
    })
  } catch { /* ignorer */ }

  revalidatePath('/app/trener')
  revalidatePath('/app/innstillinger/trener')
  return {
    relationId,
    athleteId: invite.athlete_id,
    athleteName: athleteProfile?.full_name ?? null,
    alreadyConnected,
  }
}
