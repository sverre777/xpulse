'use server'

import { createClient } from '@/lib/supabase/server'

// Data-portability (GDPR Art. 20). Genererer JSON-eksport av brukerens egne
// data: workouts, activities, samples (ikke Strava-raw eldre enn 7d),
// planlagte økter, maler, tester, helsedata, profil.
//
// Returnerer JSON-streng (klient laster ned via Blob). For store datasett
// kan flyten splittes til signed-URL fra storage senere — for nå er JSON
// in-memory tilstrekkelig.

export interface DataExport {
  exported_at: string
  user_id: string
  profile: Record<string, unknown> | null
  workouts: unknown[]
  workout_activities: unknown[]
  workout_samples: unknown[]
  plan_templates: unknown[]
  workout_templates: unknown[]
  seasons: unknown[]
  season_periods: unknown[]
  season_key_dates: unknown[]
  imported_activities: unknown[]
  excluded: {
    strava_raw_samples_older_than_7d: string
    other_users_data: string
    stripe_billing_history: string
  }
}

export async function generateDataExport(): Promise<{ json?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  // Hent profile (eks. passord-hash er ikke i denne tabellen — auth.users er separat).
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // Workouts + child-tabeller via separate queries (cascade-FK gir filtering på user_id).
  const [
    workoutsRes, activitiesRes, samplesRes,
    planTplRes, workoutTplRes,
    seasonsRes, periodsRes, keyDatesRes,
    importsRes,
  ] = await Promise.all([
    supabase.from('workouts').select('*').eq('user_id', user.id),
    supabase.from('workout_activities')
      .select('*, workout:workouts!inner(user_id)')
      .eq('workout.user_id', user.id),
    supabase.from('workout_samples').select('*').eq('user_id', user.id)
      // Ekskluder Strava-samples eldre enn 7 dager (cache_expires_at < now).
      .or('source.neq.strava,cache_expires_at.gte.' + new Date().toISOString()),
    supabase.from('plan_templates').select('*').eq('user_id', user.id),
    supabase.from('workout_templates').select('*').eq('user_id', user.id),
    supabase.from('seasons').select('*').eq('user_id', user.id),
    supabase.from('season_periods').select('*').eq('user_id', user.id),
    supabase.from('season_key_dates').select('*').eq('user_id', user.id),
    supabase.from('imported_activities').select('*').eq('user_id', user.id),
  ])

  const exportData: DataExport = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    profile: profile ?? null,
    workouts: workoutsRes.data ?? [],
    workout_activities: (activitiesRes.data ?? []) as unknown[],
    workout_samples: samplesRes.data ?? [],
    plan_templates: planTplRes.data ?? [],
    workout_templates: workoutTplRes.data ?? [],
    seasons: seasonsRes.data ?? [],
    season_periods: periodsRes.data ?? [],
    season_key_dates: keyDatesRes.data ?? [],
    imported_activities: importsRes.data ?? [],
    excluded: {
      strava_raw_samples_older_than_7d: 'Slettes per Strava API Agreement § 7. Last ned .fit-filer manuelt fra strava.com for permanent lagring.',
      other_users_data: 'Inkluderer kun dine egne data. Som trener: hver utøver eksporterer selv.',
      stripe_billing_history: 'Tilgjengelig i Stripe Customer Portal via /app/abonnement.',
    },
  }

  return { json: JSON.stringify(exportData, null, 2) }
}
