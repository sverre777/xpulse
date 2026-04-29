import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Diagnose-endepunkt — sjekker at klokkesync-infrastrukturen er på plass.
// Krever innlogget bruker. Returnerer JSON med status på env-vars og DB-
// tabeller. Dum og åpen — ingen sensitive verdier eksponeres.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  // Env-vars vi trenger. Sjekker kun om de er satt — ikke verdiene selv.
  const env = {
    STRAVA_CLIENT_ID: !!process.env.STRAVA_CLIENT_ID,
    STRAVA_CLIENT_SECRET: !!process.env.STRAVA_CLIENT_SECRET,
    STRAVA_REDIRECT_URI: process.env.STRAVA_REDIRECT_URI ?? null,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? null,
    URL: process.env.URL ?? null, // Netlify autofyller
  }

  // DB-tabeller — sjekker ved å gjøre en HEAD-style query mot hver.
  const tables = {
    strava_connections: false,
    imported_activities: false,
    workout_samples: false,
  }
  for (const t of Object.keys(tables) as (keyof typeof tables)[]) {
    const { error } = await supabase.from(t).select('*', { count: 'exact', head: true }).limit(0)
    tables[t] = !error
  }

  // Sjekk om brukeren har en strava_connections-rad.
  const { data: conn } = await supabase
    .from('strava_connections')
    .select('strava_athlete_id, token_expires_at, last_sync_at, auto_sync')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    user_id: user.id,
    env,
    tables,
    user_strava_connection: conn ? {
      has_athlete_id: !!conn.strava_athlete_id,
      token_expires_at: conn.token_expires_at,
      token_expired: conn.token_expires_at
        ? new Date(conn.token_expires_at).getTime() < Date.now()
        : null,
      last_sync_at: conn.last_sync_at,
      auto_sync: conn.auto_sync,
    } : null,
  })
}
