import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Header-basert identitet for LESE-baner (visning). Middleware validerer
// sesjonen mot Supabase Auth (auth.getUser) på hver request og setter
// x-xp-uid/x-xp-email på request-headerne ETTERPÅ — og stripper alltid
// innkommende x-xp-* først, så headerne kan ikke spoofes utenfra (matcheren
// i proxy.ts dekker alle side-/RSC-/action-requests).
//
// Dermed koster identitets-oppslag her INGEN ekstra Auth-rundtur. Hvis
// middleware var timeout-degradert (satte ingen header), faller vi tilbake
// til full server-validert getUser — sidene self-guarder fortsatt.
//
// VIKTIG: bruk denne for visning/lesing. Mutasjoner og sensitive handlinger
// skal fortsatt bruke supabase.auth.getUser() direkte (defense-in-depth).

export interface AuthUser {
  id: string
  email: string | null
}

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const h = await headers()
  const uid = h.get('x-xp-uid')
  if (uid) {
    const email = h.get('x-xp-email')
    return { id: uid, email: email ? decodeURIComponent(email) : null }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { id: user.id, email: user.email ?? null } : null
})
