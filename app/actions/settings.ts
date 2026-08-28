'use server'

import { slettStrideeKonto } from '@/lib/stridee-api'
import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PaceUnit } from '@/lib/pace-utils'
import type { Sport } from '@/lib/types'

type DistanceUnit = 'km' | 'mi'
type TemperatureUnit = 'c' | 'f'
type WeightUnit = 'kg' | 'lb'
type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say'

// ── Måleenheter ─────────────────────────────────────────────
//
// Kun pace-enhet i denne omgang. Distance/temp/weight forblir SI-enheter
// (km/°C/kg). Når en bruker setter denne, brukes den som default-visning i
// PaceInput og PaceDisplay; rader kan fortsatt overstyre per aktivitet.
export async function saveDefaultPaceUnit(unit: PaceUnit | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  if (unit !== null && unit !== 'min_per_km' && unit !== 'km_per_h') {
    return { error: 'Ugyldig enhet' }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ default_pace_unit: unit, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger')
  return {}
}

function parseOptionalInt(v: string, lo: number, hi: number): number | null {
  const n = parseInt(v)
  if (!Number.isFinite(n)) return null
  if (n < lo || n > hi) return null
  return n
}

// saveHeartRateProfile/saveCustomHeartZones/resetHeartZonesToAuto er
// AVLØST av terskler.ts (prestasjonsmodellen bolk 1) og slettet (regel 21).

const VALID_SPORTS: Sport[] = [
  'running', 'cross_country_skiing', 'biathlon', 'triathlon',
  'cycling', 'long_distance_skiing', 'endurance',
]
const VALID_GENDERS: Gender[] = ['male', 'female', 'other', 'prefer_not_to_say']

export interface ProfileUpdateInput {
  first_name: string
  last_name: string
  full_name?: string
  birth_year: string
  primary_sport: string
  gender: string
  country: string
  // Bolk 6 — nye felter (alle valgfrie i input; tomt = null).
  username?: string
  birth_date?: string       // YYYY-MM-DD; birth_year avledes når satt
  height_cm?: string
  secondary_sport?: string  // én valgfri sekundærsport (lagres i arrayen)
}

// Brukernavn: 3–20 tegn, a–z/0–9/._ — normaliseres til lowercase før
// lagring, og unikheten håndheves case-insensitivt i basen.
const BRUKERNAVN_REGEX = /^[a-z0-9_.]{3,20}$/

function nullifyEmpty(v: string): string | null {
  const s = v.trim()
  return s.length === 0 ? null : s
}

export async function updateProfile(input: ProfileUpdateInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const first = nullifyEmpty(input.first_name)
  const last = nullifyEmpty(input.last_name)
  const fullName = input.full_name !== undefined && input.full_name.trim().length > 0
    ? input.full_name.trim()
    : [first, last].filter(Boolean).join(' ') || null

  const birthYear = input.birth_year.trim() === ''
    ? null
    : parseOptionalInt(input.birth_year, 1900, new Date().getFullYear())
  if (input.birth_year.trim() !== '' && birthYear === null) {
    return { error: 'Ugyldig fødselsår' }
  }

  const sportRaw = nullifyEmpty(input.primary_sport)
  const primary_sport = sportRaw && VALID_SPORTS.includes(sportRaw as Sport)
    ? sportRaw as Sport
    : null

  const genderRaw = nullifyEmpty(input.gender)
  const gender = genderRaw && VALID_GENDERS.includes(genderRaw as Gender)
    ? genderRaw as Gender
    : null

  const country = nullifyEmpty(input.country)

  // Bolk 6-feltene.
  const usernameRaw = nullifyEmpty(input.username ?? '')
  const username = usernameRaw ? usernameRaw.toLowerCase() : null
  if (username && !BRUKERNAVN_REGEX.test(username)) {
    return { error: 'Brukernavn må være 3–20 tegn: små bokstaver a–z, tall, punktum eller understrek' }
  }
  const birthDate = nullifyEmpty(input.birth_date ?? '')
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return { error: 'Ugyldig fødselsdato' }
  }
  const heightRaw = nullifyEmpty(input.height_cm ?? '')
  const heightCm = heightRaw ? parseInt(heightRaw, 10) : null
  if (heightCm != null && (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250)) {
    return { error: 'Høyde må være mellom 100 og 250 cm' }
  }
  const secondaryRaw = nullifyEmpty(input.secondary_sport ?? '')
  const secondarySports = secondaryRaw && VALID_SPORTS.includes(secondaryRaw as Sport)
    ? [secondaryRaw]
    : []
  // Fødselsdato er fasit når den finnes — birth_year AVLEDES (sone-
  // fallback leser år; én kilde, aldri to som kan sprike).
  const birthYearEndelig = birthDate
    ? parseInt(birthDate.slice(0, 4), 10)
    : birthYear

  const { error } = await supabase.from('profiles').update({
    first_name: first,
    last_name: last,
    full_name: fullName,
    birth_year: birthYearEndelig,
    birth_date: birthDate,
    username,
    height_cm: heightCm,
    secondary_sports: secondarySports,
    primary_sport,
    gender,
    country,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id)
  if (error) {
    // Unik-indeksen på lower(username): ærlig melding, ikke DB-språk.
    if (error.code === '23505' && error.message.includes('username')) {
      return { error: 'Brukernavnet er opptatt — velg et annet' }
    }
    return { error: error.message }
  }
  // birth_year styrer auto-HFmax → påvirker auto-soner.
  updateTag(`heart-zones-${user.id}`)
  revalidatePath('/app/innstillinger')
  return {}
}

// Førstegangsvarselet (bolk 6): lukking huskes SERVER-SIDE — aldri
// localStorage alene (glemmes per enhet). Vises til minst én terskel
// er satt ELLER brukeren har lukket det; aldri mas etterpå.
export async function lukkProfilvarsel(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase.from('profiles')
    .update({ profilvarsel_lukket_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { error: error.message }
  return {}
}

// ── Sikkerhet ────────────────────────────────────────────────
//
// Endre passord via Supabase auth. Krever at brukeren er innlogget; Supabase
// validerer minimumslengde mot prosjekt-policy.
export async function updatePassword(newPassword: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return { error: 'Passord må være minst 8 tegn' }
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return {}
}

// Endre e-post: skriver pending-felt + trigger Supabase magic-link til ny adresse.
// Bekreftelseslenken kaller confirmEmailChange via /app/innstillinger/bekreft-epost.
export async function requestEmailChange(newEmail: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const trimmed = newEmail.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { error: 'Ugyldig e-postadresse' }
  }
  if (trimmed === user.email?.toLowerCase()) {
    return { error: 'Ny e-post er lik nåværende' }
  }

  // Supabase håndterer bekreftelse: setter ny e-post som pending og sender lenke.
  const { error: authError } = await supabase.auth.updateUser({ email: trimmed })
  if (authError) return { error: authError.message }

  await supabase.from('profiles').update({
    email_change_pending: trimmed,
    email_change_requested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', user.id)

  revalidatePath('/app/innstillinger')
  return {}
}

// Markerer pending-feltene som ferdig prosessert (auth.email speiler ny adresse
// fra og med Supabase-bekreftelse — vi bare nuller pending-tilstanden).
export async function confirmEmailChange(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase.from('profiles').update({
    email: user.email,
    email_change_pending: null,
    email_change_requested_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger')
  return {}
}

// ── Profilbilde (Storage) ─────────────────────────────────────
//
// Tar imot fil-bytes fra klient (FormData) og laster opp til
// profile-images/<user_id>/<timestamp>.<ext>. Eksisterende bilder slettes ikke
// automatisk — kun pekeren oppdateres. Bucket er public, så vi lagrer public URL.
export async function uploadProfileImage(formData: FormData): Promise<{ error?: string; url?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Mangler fil' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Filen er større enn 5 MB' }
  if (!file.type.startsWith('image/')) return { error: 'Filen må være et bilde' }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage
    .from('profile-images')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })
  if (upErr) return { error: upErr.message }

  const { data: pub } = supabase.storage.from('profile-images').getPublicUrl(path)
  const url = pub.publicUrl

  const { error } = await supabase.from('profiles')
    .update({ profile_image_url: url, avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app/innstillinger')
  return { url }
}

// ── Måleenheter ──────────────────────────────────────────────
export interface UnitsInput {
  pace?: PaceUnit | null
  distance?: DistanceUnit | null
  temperature?: TemperatureUnit | null
  weight?: WeightUnit | null
}

export async function updateUnitsSettings(input: UnitsInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.pace !== undefined) {
    if (input.pace !== null && input.pace !== 'min_per_km' && input.pace !== 'km_per_h') {
      return { error: 'Ugyldig pace-enhet' }
    }
    payload.default_pace_unit = input.pace
  }
  if (input.distance !== undefined) {
    if (input.distance !== null && input.distance !== 'km' && input.distance !== 'mi') {
      return { error: 'Ugyldig distanse-enhet' }
    }
    payload.default_distance_unit = input.distance
  }
  if (input.temperature !== undefined) {
    if (input.temperature !== null && input.temperature !== 'c' && input.temperature !== 'f') {
      return { error: 'Ugyldig temperatur-enhet' }
    }
    payload.default_temperature_unit = input.temperature
  }
  if (input.weight !== undefined) {
    if (input.weight !== null && input.weight !== 'kg' && input.weight !== 'lb') {
      return { error: 'Ugyldig vekt-enhet' }
    }
    payload.default_weight_unit = input.weight
  }

  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger')
  return {}
}

// ── Varsler ─────────────────────────────────────────────────
export interface NotificationSettingsInput {
  notify_email_coach_comment?: boolean
  notify_email_new_message?: boolean
  notify_email_plan_pushed?: boolean
  notify_email_weekly_summary?: boolean
  notify_email_product_updates?: boolean
}

export async function updateNotificationSettings(input: NotificationSettingsInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of [
    'notify_email_coach_comment',
    'notify_email_new_message',
    'notify_email_plan_pushed',
    'notify_email_weekly_summary',
    'notify_email_product_updates',
  ] as const) {
    if (input[key] !== undefined) payload[key] = !!input[key]
  }
  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger')
  return {}
}

// ── GDPR: eksport ────────────────────────────────────────────
//
// Aggregerer alle bruker-data fra relevante tabeller til en kombinert JSON-payload.
// CSV-zip lages klient-side fra denne payloaden (kjøres via DataExportButton).
const EXPORT_TABLES = [
  'workouts', 'workout_activities', 'workout_activity_exercises',
  'workout_activity_exercise_sets', 'workout_activity_lactate_measurements',
  'workout_movements', 'workout_zones', 'workout_tags', 'workout_exercises',
  'workout_lactate_measurements', 'workout_competition_data', 'workout_test_data',
  'workout_templates', 'plan_templates', 'periodization_templates',
  'training_phases', 'seasons', 'training_goals',
  'period_notes', 'weekly_reflections', 'focus_points', 'day_states',
  'recovery_entries', 'daily_health',
  // Helse og søvn (fase 91). Eksporten er brukerens egen — alt de har ført
  // og alt som er importert til dem, inkludert kilde per verdi.
  'sleep_records', 'health_metrics', 'health_brand_metrics',
  'user_heart_zones', 'user_movement_types', 'user_exercises',
  'favorite_charts', 'monthly_volume_targets',
  'tests_and_prs', 'inbox_messages',
] as const

export interface ExportPayload {
  exported_at: string
  user_id: string
  email: string | null
  profile: Record<string, unknown> | null
  data: Record<string, unknown[]>
}

export async function exportAllUserData(): Promise<{ error?: string; payload?: ExportPayload }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const data: Record<string, unknown[]> = {}
  for (const table of EXPORT_TABLES) {
    const { data: rows, error } = await supabase.from(table).select('*').eq('user_id', user.id)
    if (error) {
      // Tabell finnes kanskje ikke / mangler user_id-kolonne — hopp over uten å feile hele eksporten.
      data[table] = []
      continue
    }
    data[table] = rows ?? []
  }

  return {
    payload: {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      email: user.email ?? null,
      profile: profile ?? null,
      data,
    },
  }
}

// ── GDPR: konto-sletting (soft delete med 7-dagers angrefrist) ─
export async function requestAccountDeletion(): Promise<{ error?: string; scheduledFor?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const now = new Date()
  const scheduledFor = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { error } = await supabase.from('profiles').update({
    deletion_requested_at: now.toISOString(),
    updated_at: now.toISOString(),
  }).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger')
  return { scheduledFor: scheduledFor.toISOString() }
}

export async function cancelAccountDeletion(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { error } = await supabase.from('profiles').update({
    deletion_requested_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/app/innstillinger')
  return {}
}

// Hard slette: kalles av cron-jobb når > 7 dager. Eksponert som server action
// så bruker kan tvinge umiddelbar sletting (selv-confirm). Sletter alle
// bruker-rader + auth-user. Krever at deletion_requested_at er satt.
export async function confirmAccountDeletion(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data: prof } = await supabase.from('profiles')
    .select('deletion_requested_at').eq('id', user.id).single()
  if (!prof?.deletion_requested_at) {
    return { error: 'Ingen aktiv sletteforespørsel' }
  }

  // Klokkesynk-leverandøren: slett kontoen der FØR radene våre forsvinner
  // (vi trenger stridee_user_id fra lenka). Best effort — feiler kallet,
  // logges det og slettinga hos oss fortsetter; leverandørens konto rydder
  // seg selv når webhooken vår slutter å svare, og vilkårene peker på at
  // tilgangen også kan trekkes hos klokkeprodusenten.
  try {
    const { data: strideeLenke } = await supabase
      .from('stridee_link')
      .select('stridee_user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (strideeLenke?.stridee_user_id) {
      const res = await slettStrideeKonto(strideeLenke.stridee_user_id)
      if (!res.ok) console.warn(`[konto-sletting] leverandør-sletting feilet: ${res.feil}`)
    }
  } catch (e) {
    console.warn(`[konto-sletting] leverandør-sletting kastet: ${e instanceof Error ? e.message : e}`)
  }

  // Profil cascades via foreign keys (on delete cascade). Auth-bruker må slettes
  // separat — gjøres normalt fra admin-API. Vi nuller bare profil-rad her;
  // brukeren beholder auth-tilgang inntil cron-jobb fullfører.
  const { error } = await supabase.from('profiles').delete().eq('id', user.id)
  if (error) return { error: error.message }

  await supabase.auth.signOut()
  return {}
}
