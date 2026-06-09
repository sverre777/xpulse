import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasActiveAccess, hasCoachTier, type ActiveSubscription } from '@/lib/subscriptions'

// Subscription-unntak: ruter brukeren må kunne nå selv uten aktivt abonnement
// (administrer, eksporter data, GDPR-handlinger). Disse er også eksempte fra
// tier-gating så Athlete Pro-bruker kan nå /app/abonnement uten loop.
const SUB_EXEMPT_PREFIXES = [
  '/app/abonnement',
  '/app/innstillinger',
  '/app/register',
  '/app/recover',
  '/app/reset-password',
]

function isSubExempt(pathname: string): boolean {
  return SUB_EXEMPT_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Trener-prefix: ruter som krever Trener Basic eller Trener Pro tier.
// Tier-gate gjøres I MIDDLEWARE — ikke layout — fordi layout→layout-redirects
// kan skape sykluser (forrige forsøk på dette: 3a83319/15a0766 → rollback).
function isCoachRoute(pathname: string): boolean {
  return pathname === '/app/trener' || pathname.startsWith('/app/trener/')
}

// Defensiv: middleware kjører som Edge Function med streng tidsgrense. Hvis et
// Supabase-kall henger (treg/utilgjengelig DB/auth), MÅ vi ikke henge til
// edge-timeout (= hele siten nede). withTimeout kaster etter `ms`, og kalleren
// faller tilbake til å slippe requesten gjennom — sidene self-guarder (kaller
// selv auth/getUser) og RLS beskytter data uansett.
class TimeoutError extends Error {}
function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    p as Promise<T>,
    new Promise<T>((_, reject) => setTimeout(() => reject(new TimeoutError('supabase-timeout')), ms)),
  ])
}
const MW_TIMEOUT_MS = 3000

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Landing and pricing are fully public — no Supabase call, no auth.
  if (pathname === '/' || pathname === '/pris') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']
  try {
    const { data } = await withTimeout(supabase.auth.getUser(), MW_TIMEOUT_MS)
    user = data.user
  } catch {
    // Supabase auth treg/utilgjengelig → IKKE heng edge-funksjonen. Slipp
    // requesten gjennom; sidene self-guarder (egen auth-sjekk) og RLS beskytter
    // data. Bedre degradert enn hele siten nede.
    return supabaseResponse
  }

  const isAppRoute = pathname === '/app' || pathname.startsWith('/app/')
  const isAuthPage = pathname === '/app' || pathname === '/app/register'

  if (!user) {
    // Unauthenticated: block /app/* except /app and /app/register
    if (isAppRoute && !isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      url.searchParams.set('return_to', pathname + request.nextUrl.search)
      return NextResponse.redirect(url)
    }
    // Onboarding krever også innlogget bruker — sendes til login med return_to.
    if (pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      url.searchParams.set('return_to', pathname + request.nextUrl.search)
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Alle gjenstående Supabase-spørringer (abonnement/profil) er timeout-guardet.
  // Hvis noen henger/feiler slipper vi requesten gjennom i stedet for å henge
  // edge-funksjonen til timeout (= site down). Betalingsmur degraderes da kort-
  // varig; RLS beskytter fortsatt data.
  try {
  // Authenticated: /app root og /app/register bounce til dagbok eller onboarding.
  if (isAuthPage) {
    // Sjekk subscription først — ny bruker uten sub skal til onboarding.
    const { data: sub } = await withTimeout(supabase
      .from('subscriptions')
      .select('tier, status, current_period_end, trial_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle(), MW_TIMEOUT_MS)
    if (!sub || !hasActiveAccess(sub as ActiveSubscription)) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding/abonnement'
      return NextResponse.redirect(url)
    }

    const { data: profile } = await withTimeout(supabase
      .from('profiles')
      .select('active_role, role')
      .eq('id', user.id)
      .single(), MW_TIMEOUT_MS)

    const activeRole = profile?.active_role ?? profile?.role
    const url = request.nextUrl.clone()
    url.pathname = activeRole === 'coach' ? '/app/trener' : '/app/dagbok'
    return NextResponse.redirect(url)
  }

  // Betalingsmur: sjekk subscription for /app/* (unntatt SUB_EXEMPT_PREFIXES).
  // Tier-gate /app/trener/*: krever Trener Basic eller Pro.
  if (isAppRoute && !isSubExempt(pathname)) {
    const { data: sub } = await withTimeout(supabase
      .from('subscriptions')
      .select('tier, status, current_period_end, trial_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle(), MW_TIMEOUT_MS)

    if (!sub) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding/abonnement'
      return NextResponse.redirect(url)
    }
    if (!hasActiveAccess(sub as ActiveSubscription)) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/abonnement'
      url.searchParams.set('expired', 'true')
      return NextResponse.redirect(url)
    }
    // Tier-gate: Athlete Pro-bruker som forsøker /app/trener/* sendes til
    // abonnement-siden med oppfordring til å bytte plan via Stripe Customer
    // Portal. /app/abonnement er i SUB_EXEMPT_PREFIXES (ikke isCoachRoute),
    // så det blir aldri redirect-loop.
    if (isCoachRoute(pathname) && !hasCoachTier(sub as ActiveSubscription)) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/abonnement'
      url.searchParams.set('upgrade', 'trener')
      return NextResponse.redirect(url)
    }

    // Coach-modus på en UTØVER-only rute → send til trener-hjemmet.
    // Utøver-rutene (dagbok/plan/analyse/maler/…) finnes kun i utøver-modus og
    // skal aldri rendres med blå coach-farge i MainNav. Når active_role='coach'
    // hører brukeren hjemme i /app/trener/* (CoachNav). Innboks er unntatt fordi
    // den har egen CoachNav-variant; abonnement/innstillinger er SUB_EXEMPT og
    // når aldri hit. Profil hentes KUN for trener-tier-brukere — vanlige utøvere
    // (Athlete Pro) treffer aldri denne grenen, så ingen ekstra spørring for dem.
    const isInbox = pathname === '/app/innboks' || pathname.startsWith('/app/innboks/')
    if (!isCoachRoute(pathname) && !isInbox && hasCoachTier(sub as ActiveSubscription)) {
      const { data: profile } = await withTimeout(supabase
        .from('profiles')
        .select('active_role, role')
        .eq('id', user.id)
        .maybeSingle(), MW_TIMEOUT_MS)
      const activeRole = profile?.active_role ?? profile?.role
      if (activeRole === 'coach') {
        const url = request.nextUrl.clone()
        url.pathname = '/app/trener'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
  }
  } catch {
    // Supabase treg/utilgjengelig under gating → slipp gjennom, ikke heng edge.
    return supabaseResponse
  }

  return supabaseResponse
}
