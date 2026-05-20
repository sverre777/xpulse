import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Debug-route — sjekker faktisk DB-state for innlogget brukers strava_connections.
// Brukes når UI sier "frakoblet" men noe oppfører seg som om kobling er aktiv,
// eller motsatt. Returnerer rå-data så vi raskt kan diagnosere mismatch mellom
// UI og DB uten å gå til Supabase SQL Editor.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const { data: conn, error } = await supabase
    .from('strava_connections')
    .select('strava_athlete_id, access_token, refresh_token, token_expires_at, scope, auto_sync, created_at, last_sync_at, disconnected_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: `query feilet: ${error.message}` }, { status: 500 })
  }

  const hasRow = conn !== null
  const hasAccessToken = !!conn?.access_token
  const tokenExpired = conn?.token_expires_at
    ? new Date(conn.token_expires_at).getTime() < Date.now()
    : null

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    has_row: hasRow,
    has_access_token: hasAccessToken,
    is_disconnected: conn?.disconnected_at != null,
    token_expires_at: conn?.token_expires_at ?? null,
    token_expired: tokenExpired,
    last_sync_at: conn?.last_sync_at ?? null,
    disconnected_at: conn?.disconnected_at ?? null,
    scope: conn?.scope ?? null,
    strava_athlete_id: conn?.strava_athlete_id ?? null,
    auto_sync: conn?.auto_sync ?? null,
    // Konklusjon basert på UI-logikk: side viser "Koble til Strava" hvis rad
    // mangler eller access_token er null; ellers viser den "Frakoble".
    ui_would_show: hasRow && hasAccessToken ? 'Frakoble Strava' : 'Koble til Strava',
  })
}
