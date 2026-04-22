import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Authenticated: /app root and /app/register bounce to the role home
  if (isAuthPage) {
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

  return supabaseResponse
}
