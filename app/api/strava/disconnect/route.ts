import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Strava API Agreement § 5.4 + § 2.14.6: ved frakobling MÅ ALL Strava-data
// slettes innen 48 timer. Vi gjør det umiddelbart for å være på trygg side.
//
// Sletting i rekkefølge:
//   1. workout_samples for alle Strava-importerte workouts
//   2. workout_activities for samme
//   3. workouts (Strava-importerte) — imported_from='strava'
//   4. imported_activities-rader (source='strava')
//   5. Revoke OAuth-token hos Strava via deauthorize-endepunktet — DETTE
//      er det som faktisk får Strava sin athlete-teller til å gå ned.
//      Hvis det feiler, blir telleren stående oppe selv om vi sletter
//      raden vår.
//   6. SLETT hele strava_connections-raden (ikke bare nullstill tokens).
//
// Returnerer detaljert status om deauthorize i JSON-response så vi kan
// diagnostisere uten å lese serverlogger — særlig viktig fordi Strava
// telleren bare oppdateres når Strava sin egen API-call mot deauthorize
// returnerer 2xx.

// Strava deauthorize-endepunkter:
//   - https://www.strava.com/oauth/deauthorize (offisielt per docs)
//   - https://www.strava.com/api/v3/oauth/deauthorize (alternativ, kommer
//     ofte opp ved spørringer mot Strava-backend)
//
// Vi har observert 404 "Record Not Found" + "resource:path:invalid" mot
// /oauth/deauthorize — det er Strava sitt API-v3-format på feilmelding,
// så requesten traff sannsynligvis API-handleren via intern redirect og
// fant ikke matching route. Vi prøver derfor 4 kombinasjoner i prioritets-
// rekkefølge og returnerer detaljert logg av hver attempt så vi kan se
// hvilken som faktisk virker mot dagens Strava-API.
async function deauthorizeOnStrava(accessToken: string): Promise<{
  ok: boolean
  status: number
  format_used: string
  body: string
  attempts: Array<{ url: string; method: string; status: number; body: string }>
}> {
  const attempts: Array<{ url: string; method: string; status: number; body: string }> = []
  const endpoints = [
    'https://www.strava.com/oauth/deauthorize',
    'https://www.strava.com/api/v3/oauth/deauthorize',
  ] as const
  const methods = ['bearer', 'form-body'] as const

  for (const url of endpoints) {
    for (const method of methods) {
      try {
        const init: RequestInit = method === 'bearer'
          ? {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ access_token: accessToken }).toString(),
            }
        const res = await fetch(url, init)
        const body = (await res.text().catch(() => '')).slice(0, 300)
        attempts.push({ url, method, status: res.status, body })
        if (res.ok) {
          return {
            ok: true,
            status: res.status,
            format_used: `${method} @ ${url}`,
            body,
            attempts,
          }
        }
      } catch (e) {
        attempts.push({
          url,
          method,
          status: 0,
          body: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  // Alle 4 forsøk feilet — returner siste status + samlet logg.
  const last = attempts[attempts.length - 1]
  return {
    ok: false,
    status: last?.status ?? 0,
    format_used: `alle ${attempts.length} forsøk feilet`,
    body: last?.body ?? '',
    attempts,
  }
}

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

  // 2-3. Slett samples + activities for alle Strava-workouts.
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

  // 5. Slett imported_activities-tracker.
  const { count: ic } = await supabase
    .from('imported_activities').delete({ count: 'exact' })
    .eq('user_id', user.id).eq('source', 'strava')
  const deletedImports = ic ?? 0

  // 6. Hent access_token FØR vi sletter raden — trengs for deauthorize.
  const { data: conn } = await supabase
    .from('strava_connections')
    .select('access_token, strava_athlete_id')
    .eq('user_id', user.id)
    .maybeSingle()

  // 7. Revoke OAuth-token mot Strava deauthorize-endepunktet. Detaljert
  // resultat returneres til UI så vi vet om Strava-telleren faktisk gikk ned.
  type DeauthAttempt = { url: string; method: string; status: number; body: string }
  let deauth: {
    attempted: boolean
    ok: boolean
    status: number
    format_used: string
    body: string
    attempts: DeauthAttempt[]
  } = { attempted: false, ok: false, status: 0, format_used: 'ikke forsøkt (mangler token)', body: '', attempts: [] }
  if (conn?.access_token) {
    const r = await deauthorizeOnStrava(conn.access_token)
    deauth = { attempted: true, ...r }
    if (!r.ok) {
      console.warn(`[strava-disconnect] deauthorize feilet etter ${r.attempts.length} forsøk:`, JSON.stringify(r.attempts))
    } else {
      console.log(`[strava-disconnect] deauthorize OK via ${r.format_used} — andre forsøk:`, JSON.stringify(r.attempts.slice(0, -1)))
    }
  } else {
    console.warn(`[strava-disconnect] ingen access_token funnet — kan ikke deauthorize. Strava-teller går trolig ikke ned automatisk for user ${user.id}.`)
  }

  // 8. SLETT hele strava_connections-raden UANSETT om deauthorize fungerte.
  // Hvis vi beholdt raden ved deauth-feil ville bruker sitte fast i en
  // tilstand de ikke kunne komme ut av (gammel token, kan ikke re-koble).
  const { error: delErr } = await supabase
    .from('strava_connections')
    .delete()
    .eq('user_id', user.id)
  if (delErr) {
    console.error('[strava-disconnect] DELETE feilet:', delErr.message)
    return NextResponse.json({
      ok: false,
      error: `Kunne ikke slette tilkoblings-rad: ${delErr.message}`,
      deleted_workouts: deletedWorkouts,
      deauth,
    }, { status: 500 })
  }

  // 9. Invalider klokkesync-siden så server-komponenten re-fetcher.
  revalidatePath('/app/innstillinger/klokkesync')

  return NextResponse.json({
    ok: true,
    deleted_workouts: deletedWorkouts,
    deleted_activities: deletedActivities,
    deleted_samples: deletedSamples,
    deleted_imports: deletedImports,
    deauth,
    // Hjelpetekst til UI: hvis deauth.ok=false vil Strava sin athlete-teller
    // potensielt ikke gå ned automatisk. Brukeren må da gå til
    // strava.com/settings/apps og fjerne X-PULSE manuelt for å redusere
    // telleren.
    note: deauth.ok
      ? 'Strava-tilgang trukket tilbake. Strava-telleren bør gå ned innen kort tid.'
      : 'Vi slettet alt lokalt, men Strava-deauthorize feilet (' +
        deauth.format_used + '). For å fjerne X-PULSE fra Strava sin athlete-teller, ' +
        'gå til https://www.strava.com/settings/apps og fjern X-PULSE manuelt.',
  })
}
