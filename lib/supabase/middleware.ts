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

// ---------------------------------------------------------------------------
// Kort cache av subscription-status i HMAC-signert cookie. Sparer 1–2 DB-
// spørringer (subscriptions + profiles) per /app-request — hovedkilden til
// Disk IO-forbruket. KUN positive resultater (aktiv sub) caches; manglende/
// utløpt sub re-sjekkes alltid mot DB, så betalingsmuren åpner seg umiddelbart
// etter kjøp. Verste konsekvens av stale cookie er 60s forsinket gating —
// RLS beskytter alltid selve dataene.
//
// Uten XP_MW_CACHE_SECRET i env er cachingen avslått (DB-spørring hver gang,
// som før). Rollebytte sletter cookien (se app/actions/roles.ts).
// ---------------------------------------------------------------------------
export const SUB_CACHE_COOKIE = 'xp-sub-cache'
const SUB_CACHE_TTL_S = 60

let hmacKeyPromise: Promise<CryptoKey> | null = null
function getHmacKey(): Promise<CryptoKey> | null {
  const secret = process.env.XP_MW_CACHE_SECRET
  if (!secret) return null
  if (!hmacKeyPromise) {
    hmacKeyPromise = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  }
  return hmacKeyPromise
}

function b64url(buf: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface SubCache {
  uid: string
  coach: boolean
  role: string // active_role hvis kjent, '' hvis ikke hentet ennå
  exp: number // unix sekunder
}

async function signSubCache(v: SubCache): Promise<string | null> {
  const keyP = getHmacKey()
  if (!keyP) return null
  const payload = `${v.uid}.${v.coach ? 1 : 0}.${v.role || '-'}.${v.exp}`
  const sig = b64url(await crypto.subtle.sign('HMAC', await keyP, new TextEncoder().encode(payload)))
  return `${payload}.${sig}`
}

async function readSubCache(raw: string | undefined, uid: string, nowS: number): Promise<SubCache | null> {
  if (!raw) return null
  const keyP = getHmacKey()
  if (!keyP) return null
  const parts = raw.split('.')
  if (parts.length !== 5) return null
  const [cuid, coach, role, expStr, sig] = parts
  const payload = `${cuid}.${coach}.${role}.${expStr}`
  const expected = b64url(await crypto.subtle.sign('HMAC', await keyP, new TextEncoder().encode(payload)))
  if (sig !== expected) return null
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < nowS) return null
  if (cuid !== uid) return null
  return { uid: cuid, coach: coach === '1', role: role === '-' ? '' : role, exp }
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Landing and pricing are fully public — no Supabase call, no auth.
  if (pathname === '/' || pathname === '/pris') {
    return NextResponse.next({ request })
  }

  // Anti-spoofing: x-xp-* identitets-headere settes KUN av middleware etter
  // server-validert auth (lib/auth.ts stoler på dem). Strip alltid innkommende.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-xp-uid')
  requestHeaders.delete('x-xp-email')

  // Ytelse: Next.js PREFETCH-requests (nav-baren prefetcher alle lenker
  // samtidig) skal IKKE betale full middleware (auth.getUser + subscriptions-
  // spørring + tier-gating). Selve navigasjonen kjører full middleware, og
  // hver side self-guarder via getAuthUser/getUser, så ingen data lekker.
  // (Re-innført fra 4f56a8f — reverten a958512 var mistanke under site-down;
  // ekte rotårsak var uhåndtert AuthRetryableFetchError, fikset i 17284eb.)
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch' ||
    (request.headers.get('sec-purpose')?.includes('prefetch') ?? false)
  if (isPrefetch) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Cookies som settes underveis (token-refresh fra Supabase + sub-cache).
  // Samles opp og legges på SLUTT-responsen — også redirects, så et refreshet
  // token ikke mistes når vi redirecter.
  const pendingCookies: { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }[] = []

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
          // requestHeaders er en KLONE — hold upstream Cookie-header i sync
          // så server-komponentene ser det refreshede tokenet.
          const cookieHeader = request.headers.get('cookie')
          if (cookieHeader) requestHeaders.set('cookie', cookieHeader)
          pendingCookies.push(...cookiesToSet.map(({ name, value, options }) => ({ name, value, options })))
        },
      },
    }
  )

  const withCookies = (res: NextResponse): NextResponse => {
    pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
    return res
  }
  const passThrough = () => withCookies(NextResponse.next({ request: { headers: requestHeaders } }))
  const redirectTo = (url: URL) => withCookies(NextResponse.redirect(url))

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']
  try {
    const { data } = await withTimeout(supabase.auth.getUser(), MW_TIMEOUT_MS)
    user = data.user
  } catch {
    // Supabase auth treg/utilgjengelig → IKKE heng edge-funksjonen. Slipp
    // requesten gjennom; sidene self-guarder (egen auth-sjekk) og RLS beskytter
    // data. Bedre degradert enn hele siten nede.
    return passThrough()
  }

  const isAppRoute = pathname === '/app' || pathname.startsWith('/app/')
  const isAuthPage = pathname === '/app' || pathname === '/app/register'

  if (!user) {
    // Unauthenticated: block /app/* except /app and /app/register
    if (isAppRoute && !isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      url.searchParams.set('return_to', pathname + request.nextUrl.search)
      return redirectTo(url)
    }
    // Onboarding krever også innlogget bruker — sendes til login med return_to.
    if (pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      url.searchParams.set('return_to', pathname + request.nextUrl.search)
      return redirectTo(url)
    }
    return passThrough()
  }

  // Sesjonen er server-validert: gjør identiteten tilgjengelig for sider og
  // actions via request-headere, så de slipper et NYTT Auth-API-kall (det
  // doble getUser-mønsteret var det som rate-limitet Supabase Auth).
  requestHeaders.set('x-xp-uid', user.id)
  if (user.email) requestHeaders.set('x-xp-email', encodeURIComponent(user.email))

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
      return redirectTo(url)
    }

    const { data: profile } = await withTimeout(supabase
      .from('profiles')
      .select('active_role, role')
      .eq('id', user.id)
      .single(), MW_TIMEOUT_MS)

    const activeRole = profile?.active_role ?? profile?.role
    const url = request.nextUrl.clone()
    url.pathname = activeRole === 'coach' ? '/app/trener' : '/app/dagbok'
    return redirectTo(url)
  }

  // Betalingsmur: sjekk subscription for /app/* (unntatt SUB_EXEMPT_PREFIXES).
  // Tier-gate /app/trener/*: krever Trener Basic eller Pro.
  if (isAppRoute && !isSubExempt(pathname)) {
    const nowS = Math.floor(Date.now() / 1000)
    const cached = await readSubCache(request.cookies.get(SUB_CACHE_COOKIE)?.value, user.id, nowS)

    let coach: boolean
    let cachedRole: string
    let cacheExp: number
    if (cached) {
      // Cache-treff: aktiv sub bekreftet < 60s siden — hopp over DB-spørringen.
      coach = cached.coach
      cachedRole = cached.role
      cacheExp = cached.exp
    } else {
      const { data: sub } = await withTimeout(supabase
        .from('subscriptions')
        .select('tier, status, current_period_end, trial_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle(), MW_TIMEOUT_MS)

      if (!sub) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding/abonnement'
        return redirectTo(url)
      }
      if (!hasActiveAccess(sub as ActiveSubscription)) {
        const url = request.nextUrl.clone()
        url.pathname = '/app/abonnement'
        url.searchParams.set('expired', 'true')
        return redirectTo(url)
      }
      coach = hasCoachTier(sub as ActiveSubscription)
      cachedRole = ''
      cacheExp = nowS + SUB_CACHE_TTL_S
      const token = await signSubCache({ uid: user.id, coach, role: '', exp: cacheExp })
      if (token) {
        pendingCookies.push({
          name: SUB_CACHE_COOKIE,
          value: token,
          options: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SUB_CACHE_TTL_S },
        })
      }
    }

    // Tier-gate: Athlete Pro-bruker som forsøker /app/trener/* sendes til
    // abonnement-siden med oppfordring til å bytte plan via Stripe Customer
    // Portal. /app/abonnement er i SUB_EXEMPT_PREFIXES (ikke isCoachRoute),
    // så det blir aldri redirect-loop.
    if (isCoachRoute(pathname) && !coach) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/abonnement'
      url.searchParams.set('upgrade', 'trener')
      return redirectTo(url)
    }

    // Coach-modus på en UTØVER-only rute → send til trener-hjemmet.
    // Utøver-rutene (dagbok/plan/analyse/maler/…) finnes kun i utøver-modus og
    // skal aldri rendres med blå coach-farge i MainNav. Når active_role='coach'
    // hører brukeren hjemme i /app/trener/* (CoachNav). Innboks er unntatt fordi
    // den har egen CoachNav-variant; abonnement/innstillinger er SUB_EXEMPT og
    // når aldri hit. Profil hentes KUN for trener-tier-brukere — vanlige utøvere
    // (Athlete Pro) treffer aldri denne grenen, så ingen ekstra spørring for dem.
    // Rollen caches i samme cookie; rollebytte-actionen sletter cookien.
    const isInbox = pathname === '/app/innboks' || pathname.startsWith('/app/innboks/')
    if (!isCoachRoute(pathname) && !isInbox && coach) {
      let activeRole = cachedRole
      if (!activeRole) {
        const { data: profile } = await withTimeout(supabase
          .from('profiles')
          .select('active_role, role')
          .eq('id', user.id)
          .maybeSingle(), MW_TIMEOUT_MS)
        activeRole = profile?.active_role ?? profile?.role ?? 'athlete'
        const token = await signSubCache({ uid: user.id, coach: true, role: activeRole, exp: cacheExp })
        if (token) {
          pendingCookies.push({
            name: SUB_CACHE_COOKIE,
            value: token,
            options: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: Math.max(1, cacheExp - nowS) },
          })
        }
      }
      if (activeRole === 'coach') {
        const url = request.nextUrl.clone()
        url.pathname = '/app/trener'
        url.search = ''
        return redirectTo(url)
      }
    }
  }
  } catch {
    // Supabase treg/utilgjengelig under gating → slipp gjennom, ikke heng edge.
    return passThrough()
  }

  return passThrough()
}
