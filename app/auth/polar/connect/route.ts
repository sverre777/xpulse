import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { buildPolarAuthUrl } from '@/lib/polar'

// Starter Polar AccessLink OAuth-flyt. Samme oppsett som Strava-varianten:
// state = randomBytes(16).hex + ':' + user.id, CSRF-token speiles i en
// httpOnly-cookie med 15 min levetid, og callback verifiserer begge deler.
//
// Krever innlogget bruker. Manglende env gir en LESBAR status på
// klokkesync-siden i stedet for 500 — vi feilsøker denne flyten i prod
// (én Polar-klient, ingen localhost-runde), så alt må kunne diagnostiseres
// fra UI.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/app', getBaseUrl()))
  }

  const csrfToken = randomBytes(16).toString('hex')
  const state = `${csrfToken}:${user.id}`

  let authUrl: string
  try {
    authUrl = buildPolarAuthUrl(state)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[polar-connect] kunne ikke bygge auth-URL:', msg)
    const u = new URL('/app/innstillinger/klokkesync', getBaseUrl())
    u.searchParams.set('polar', 'oppsett-mangler')
    u.searchParams.set('detail', msg.slice(0, 120))
    return NextResponse.redirect(u)
  }

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('polar_oauth_state', csrfToken, {
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
