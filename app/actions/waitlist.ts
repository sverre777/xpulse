'use server'

import { createClient } from '@/lib/supabase/server'

// Resultat-shape for landing-skjema. Konsumeres av WaitlistSignup-komponent.
export type WaitlistResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_email' | 'already_signed_up' | 'unknown' }

// Gyldig e-post: enkel sjekk — vi later databasen + e-post-leverandør gjøre
// resten. Mål er å avvise åpenbare feilskrivinger uten falsk-positives.
function isValidEmail(s: string): boolean {
  if (s.length < 5 || s.length > 254) return false
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(s)
}

// Hvilke features som er gyldige å melde seg på. Bruk en allow-list så vi
// ikke får søppel-rader hvis skjemaet manipuleres fra klienten.
const ALLOWED_FEATURES = new Set([
  'klokkesync',
  'athlete_pro_ai',
  'trener_pro_ai',
])

export async function joinWaitlist(
  email: string,
  feature: string,
): Promise<WaitlistResult> {
  const trimmed = email.trim().toLowerCase()
  if (!isValidEmail(trimmed)) return { ok: false, reason: 'invalid_email' }
  if (!ALLOWED_FEATURES.has(feature)) return { ok: false, reason: 'unknown' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('feature_waitlist')
    .insert({
      email: trimmed,
      feature,
      user_id: user?.id ?? null,
    })

  if (error) {
    // Postgres unique-constraint kode = 23505 — fanget her som duplikat,
    // ikke som teknisk feil siden brukeren har opplevd suksess før.
    if (error.code === '23505') return { ok: false, reason: 'already_signed_up' }
    console.error('joinWaitlist:', error)
    return { ok: false, reason: 'unknown' }
  }
  return { ok: true }
}
