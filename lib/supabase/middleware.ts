import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasActiveAccess, type ActiveSubscription } from '@/lib/subscriptions'

// Subscription-unntak: ruter brukeren må kunne nå selv uten aktivt abonnement
// (administrer, eksporter data, GDPR-handlinger).
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  // Authenticated: /app root og /app/register bounce til dagbok eller onboarding.
  if (isAuthPage) {
    // Sjekk subscription først — ny bruker uten sub skal til onboarding.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, status, current_period_end, trial_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!sub || !hasActiveAccess(sub as ActiveSubscription)) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding/abonnement'
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('active_role, role')
      .eq('id', user.id)
      .single()

    const activeRole = profile?.active_role ?? profile?.role
    const url = request.nextUrl.clone()
    url.pathname = activeRole === 'coach' ? '/app/trener' : '/app/dagbok'
    return NextResponse.redirect(url)
  }

  // Betalingsmur: sjekk subscription for /app/* (unntatt SUB_EXEMPT_PREFIXES).
  if (isAppRoute && !isSubExempt(pathname)) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, status, current_period_end, trial_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

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
  }

  return supabaseResponse
}
