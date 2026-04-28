import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { buildStravaAuthUrl } from '@/lib/strava'

// Starter Strava OAuth-flyt. Genererer state-token (CSRF-beskyttelse)
// og lagrer det i cookie før redirect. Callback verifiserer state.
//
// Krever innlogget bruker — anonyme får 401. Lager redirect-URL med
// brukerens ID som del av state så callback vet hvem koblingen er for.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/app', getBaseUrl()))
  }

  // State = randomBytes(16).hex + ':' + user.id. Callback splitter og
  // sammenligner cookie + user.
  const csrfToken = randomBytes(16).toString('hex')
  const state = `${csrfToken}:${user.id}`

  const authUrl = buildStravaAuthUrl(state)
  const response = NextResponse.redirect(authUrl)

  // CSRF-cookie kun lesbar fra server, kort levetid (15 min).
  response.cookies.set('strava_oauth_state', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60,
    path: '/',
  })
  return response
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
}
