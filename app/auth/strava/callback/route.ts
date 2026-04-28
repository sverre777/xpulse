import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/strava'

// Strava omdirigerer hit etter brukerens samtykke. Vi bytter authorization-
// code mot tokens og lagrer i strava_connections. Ved feil eller avslag
// returneres brukeren til innstillinger med en feil-parameter.

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin
  const settingsUrl = (status: string) =>
    new URL(`/app/innstillinger/klokkesync?strava=${status}`, baseUrl)

  if (error || !code || !state) {
    return NextResponse.redirect(settingsUrl('avbrutt'))
  }

  // Verifiser CSRF-state. State-format: csrf:userId
  const [csrfFromUrl, userIdFromState] = state.split(':')
  const csrfFromCookie = req.cookies.get('strava_oauth_state')?.value
  if (!csrfFromUrl || !userIdFromState || csrfFromCookie !== csrfFromUrl) {
    return NextResponse.redirect(settingsUrl('feil-state'))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userIdFromState) {
    return NextResponse.redirect(settingsUrl('ikke-innlogget'))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const { error: upsertErr } = await supabase
      .from('strava_connections')
      .upsert({
        user_id: user.id,
        strava_athlete_id: tokens.athlete_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
        scope: tokens.scope ?? null,
        auto_sync: true,
      })
    if (upsertErr) {
      console.error('Strava upsert error:', upsertErr)
      return NextResponse.redirect(settingsUrl('lagring-feilet'))
    }
  } catch (e) {
    console.error('Strava token exchange:', e)
    return NextResponse.redirect(settingsUrl('token-feilet'))
  }

  const response = NextResponse.redirect(settingsUrl('koblet'))
  // Rydder CSRF-cookie etter bruk.
  response.cookies.delete('strava_oauth_state')
  return response
}
