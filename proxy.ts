import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  // Serve the static landing HTML at `/` with no auth checks.
  if (request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/xpulse.html', request.url))
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    // Fonter og statiske filer går ALDRI gjennom auth-middlewaren (Sverre
    // 15. sep): på kald start tok getClaims opptil 3 s per fontfil, og da
    // hadde nettleseren alt gitt opp og tegnet heroen i reservefont.
    '/((?!_next/static|_next/image|favicon.ico|xpulse\\.html|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|woff|css|ico)$).*)',
  ],
}
