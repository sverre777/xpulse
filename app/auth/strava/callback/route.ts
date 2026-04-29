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
  const stravaError = url.searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin
  const settingsUrl = (status: string, detail?: string) => {
    const u = new URL('/app/innstillinger/klokkesync', baseUrl)
    u.searchParams.set('strava', status)
    if (detail) u.searchParams.set('detail', detail.slice(0, 120))
    return u
  }

  console.log('[strava-callback] start', {
    hasCode: !!code, hasState: !!state, stravaError,
    cookiePresent: !!req.cookies.get('strava_oauth_state')?.value,
  })

  if (stravaError) {
    return NextResponse.redirect(settingsUrl('avbrutt', `strava=${stravaError}`))
  }
  if (!code || !state) {
    return NextResponse.redirect(settingsUrl('avbrutt', 'mangler code eller state'))
  }

  // Verifiser CSRF-state. State-format: csrf:userId
  const [csrfFromUrl, userIdFromState] = state.split(':')
  const csrfFromCookie = req.cookies.get('strava_oauth_state')?.value
  if (!csrfFromUrl || !userIdFromState) {
    return NextResponse.redirect(settingsUrl('feil-state', 'state-format'))
  }
  if (!csrfFromCookie) {
    return NextResponse.redirect(settingsUrl('feil-state', 'cookie mangler — sjekk SameSite/Secure'))
  }
  if (csrfFromCookie !== csrfFromUrl) {
    return NextResponse.redirect(settingsUrl('feil-state', 'csrf-mismatch'))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(settingsUrl('ikke-innlogget', 'session mangler i callback'))
  }
  if (user.id !== userIdFromState) {
    return NextResponse.redirect(settingsUrl('ikke-innlogget', 'user-id mismatch'))
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
      console.error('[strava-callback] upsert error:', upsertErr)
      return NextResponse.redirect(settingsUrl('lagring-feilet', upsertErr.message))
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[strava-callback] token exchange failed:', msg)
    return NextResponse.redirect(settingsUrl('token-feilet', msg))
  }

  console.log('[strava-callback] success for user', user.id)
  const response = NextResponse.redirect(settingsUrl('koblet'))
  response.cookies.delete('strava_oauth_state')
  return response
}
