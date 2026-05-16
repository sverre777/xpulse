import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Strava API Agreement § 5.4 + § 2.14.6: ved frakobling MÅ ALL Strava-data
// slettes innen 48 timer. Vi gjør det umiddelbart for å være på trygg side.
//
// Sletting i kaskade-rekkefølge (RLS sjekker user_id på hver tabell):
//   1. workout_samples for alle Strava-importerte workouts
//   2. workout_activities for samme
//   3. workouts (Strava-importerte) — imported_from='strava'
//   4. imported_activities-rader (source='strava')
//   5. Revoke OAuth-token hos Strava via deauthorize-endepunktet
//   6. Nullstill tokens + sett disconnected_at på strava_connections
//
// Returner antall slettede økter så UI kan vise "X økter slettet"-toast.

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  // 1. Hent alle Strava-workout-ids før sletting (trengs til samples/activities-delete).
  const { data: workouts, error: wErr } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', user.id)
    .eq('imported_from', 'strava')
  if (wErr) {
    return NextResponse.json({ error: `workouts-query: ${wErr.message}` }, { status: 500 })
  }
  const workoutIds = (workouts ?? []).map(w => w.id as string)

  // 2-3. Slett samples + activities for alle Strava-workouts (CASCADE skulle
  // håndtere dette via workouts-FK, men vi gjør det eksplisitt for å være
  // sikre på at ingenting blir orphan).
  let deletedSamples = 0
  let deletedActivities = 0
  if (workoutIds.length > 0) {
    const { count: sc } = await supabase
      .from('workout_samples').delete({ count: 'exact' })
      .in('workout_id', workoutIds).eq('user_id', user.id)
    deletedSamples = sc ?? 0

    const { count: ac } = await supabase
      .from('workout_activities').delete({ count: 'exact' })
      .in('workout_id', workoutIds)
    deletedActivities = ac ?? 0
  }

  // 4. Slett workouts-radene selv.
  let deletedWorkouts = 0
  if (workoutIds.length > 0) {
    const { count: wc } = await supabase
      .from('workouts').delete({ count: 'exact' })
      .in('id', workoutIds).eq('user_id', user.id)
    deletedWorkouts = wc ?? 0
  }

  // 5. Slett imported_activities-tracker (hindrer at de "dukker opp" igjen
  // ved ny tilkobling).
  const { count: ic } = await supabase
    .from('imported_activities').delete({ count: 'exact' })
    .eq('user_id', user.id).eq('source', 'strava')
  const deletedImports = ic ?? 0

  // 6. Hent access_token før revoke + nullstilling.
  const { data: conn } = await supabase
    .from('strava_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .maybeSingle()

  // 7. Revoke OAuth-token mot Strava deauthorize-endepunktet.
  // Hvis Strava er nede eller token allerede revoked: logg men ikke abort —
  // sletting i vår DB er gjort, det er hovedforpliktelsen.
  let revoked = false
  if (conn?.access_token) {
    try {
      const res = await fetch('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${conn.access_token}` },
      })
      revoked = res.ok
      if (!res.ok) {
        console.warn(`[strava-disconnect] revoke returnerte ${res.status} — fortsetter med lokal sletting`)
      }
    } catch (e) {
      console.warn('[strava-disconnect] revoke feilet (nettverk):', e instanceof Error ? e.message : String(e))
    }
  }

  // 8. Nullstill tokens + marker disconnected_at. Vi sletter ikke raden så
  // brukeren ser at frakobling skjedde + når.
  const now = new Date().toISOString()
  await supabase.from('strava_connections')
    .update({
      access_token: null,
      refresh_token: null,
      disconnected_at: now,
    })
    .eq('user_id', user.id)

  return NextResponse.json({
    ok: true,
    deleted_workouts: deletedWorkouts,
    deleted_activities: deletedActivities,
    deleted_samples: deletedSamples,
    deleted_imports: deletedImports,
    oauth_revoked: revoked,
    disconnected_at: now,
  })
}
