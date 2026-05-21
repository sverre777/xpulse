import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Håndterer alle e-post-bekreftelser fra Supabase: password recovery, email
// change, magic link, signup-bekreftelse. Erstatter direkte redirectTo til
// UI-siden — uten dette steget har klienten ingen sesjon når den lander.
//
// Supabase email templates kan generere to lenke-formater:
//   1. PKCE: ?code=XXX → exchangeCodeForSession(code)
//   2. Token-hash: ?token_hash=XXX&type=recovery → verifyOtp({ token_hash, type })
// Vi støtter begge.
//
// VIKTIG: Cookies må settes på respons-objektet for at sesjonen skal være
// tilgjengelig på neste side-load. createClient() håndterer dette via
// cookieStore.set i en try/catch. I route handlers fungerer det (i motsetning
// til server components). Hvis cookies ikke settes — sesjon er borte ved
// redirect og /nytt-passord ser brukeren som utlogget.

const ALLOWED_NEXT = new Set([
  '/nytt-passord',
  '/app/dagbok',
  '/app/trener',
  '/app/innstillinger/bekreft-epost',
])

function safeNext(raw: string | null): string {
  if (!raw) return '/app/dagbok'
  if (ALLOWED_NEXT.has(raw)) return raw
  if (raw.startsWith('/app/') && !raw.startsWith('//')) return raw
  return '/app/dagbok'
}

// Bygg redirect til /app med ?error=... så bruker ser konkret melding.
// Inkluder type-parameter i URL-en for å vise hvilken flow som feilet —
// nyttig under diagnose.
function errorRedirect(origin: string, message: string, debug?: Record<string, string | null>): NextResponse {
  const params = new URLSearchParams({ error: message })
  if (debug) {
    for (const [k, v] of Object.entries(debug)) {
      if (v) params.set(`debug_${k}`, v)
    }
  }
  return NextResponse.redirect(`${origin}/app?${params.toString()}`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as
    | 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email' | null
  const next = safeNext(searchParams.get('next'))

  // Detaljert logging — i Netlify Function Logs kan vi se nøyaktig hva
  // Supabase sender. Hvis token_hash mangler eller type=null: email template
  // genererer feil format. Hvis exchangeCodeForSession feiler med "PKCE
  // verifier missing": cookies-flow er brutt (typisk cross-device der bruker
  // åpner lenken i annen browser enn der den ble bedt om).
  console.log('[auth/confirm] incoming', {
    hasCode: !!code,
    hasTokenHash: !!tokenHash,
    type,
    next,
    allParams: Object.fromEntries(searchParams.entries()),
  })

  const supabase = await createClient()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.warn('[auth/confirm] exchangeCodeForSession failed:', error.message, error.status)
      return errorRedirect(origin, `Lenken er ugyldig eller utløpt (${error.message}). Be om ny passord-reset.`, {
        flow: 'pkce',
        err: error.message,
      })
    }
    console.log('[auth/confirm] exchangeCodeForSession OK, user:', data.user?.id, '→ redirecting to', next)
    return NextResponse.redirect(`${origin}${next}`)
  }

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      console.warn('[auth/confirm] verifyOtp failed:', error.message, 'type:', type, 'status:', error.status)
      return errorRedirect(origin, `Lenken er ugyldig eller utløpt (${error.message}). Be om ny passord-reset.`, {
        flow: 'token_hash',
        type,
        err: error.message,
      })
    }
    console.log('[auth/confirm] verifyOtp OK, type:', type, 'user:', data.user?.id, '→ redirecting to', next)
    return NextResponse.redirect(`${origin}${next}`)
  }

  console.warn('[auth/confirm] mangler både code og token_hash', { allParams: Object.fromEntries(searchParams.entries()) })
  return errorRedirect(origin, 'Ugyldig bekreftelses-lenke (mangler code/token_hash). Sjekk Supabase Email Template — body må inneholde {{ .ConfirmationURL }}.')
}
