import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Håndterer alle e-post-bekreftelser fra Supabase: password recovery, email
// change, magic link, signup-bekreftelse. Erstatter direkte redirectTo til
// UI-siden — uten dette steget har klienten ingen sesjon når den lander.
//
// Supabase email templates kan generere to lenke-formater:
//   1. PKCE: ?code=XXX → exchangeCodeForSession(code)
//   2. Token-hash: ?token_hash=XXX&type=recovery → verifyOtp({ token_hash, type })
// Vi støtter begge så bytte av flyt i Dashboard ikke bryter oss.
//
// next-parameter (whitelisted) styrer hvor brukeren lander etter verifisering.

const ALLOWED_NEXT = new Set([
  '/nytt-passord',
  '/app/dagbok',
  '/app/trener',
  '/app/innstillinger/bekreft-epost',
])

function safeNext(raw: string | null): string {
  if (!raw) return '/app/dagbok'
  if (ALLOWED_NEXT.has(raw)) return raw
  // Tillat også /app/* generelt (men ikke //evil.com eller andre origins).
  if (raw.startsWith('/app/') && !raw.startsWith('//')) return raw
  return '/app/dagbok'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as
    | 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email' | null
  const next = safeNext(searchParams.get('next'))

  const supabase = await createClient()

  if (code) {
    // PKCE-flow: bytt code mot session.
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.warn('[auth/confirm] exchangeCodeForSession failed:', error.message)
      return NextResponse.redirect(
        `${origin}/app?error=${encodeURIComponent('Lenken er ugyldig eller utløpt. Be om ny passord-reset.')}`,
      )
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  if (tokenHash && type) {
    // Token-hash-flow: verifiser OTP direkte.
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      console.warn('[auth/confirm] verifyOtp failed:', error.message)
      return NextResponse.redirect(
        `${origin}/app?error=${encodeURIComponent('Lenken er ugyldig eller utløpt. Be om ny passord-reset.')}`,
      )
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(
    `${origin}/app?error=${encodeURIComponent('Ugyldig bekreftelses-lenke (mangler code/token_hash).')}`,
  )
}
