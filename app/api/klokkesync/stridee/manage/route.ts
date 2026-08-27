import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hentManageLink } from '@/lib/stridee-api'

// «Administrer hos leverandøren»: minter en fersk manage-lenke (signert
// POST /v1/connections/manage-link) og sender brukeren dit. Lenka lister
// personens tilkoblinger hos OSS med frakoblingsknapper hos leverandøren.
// Mintes per besøk — aldri lagret (den varer 30 dager, men skal være fersk).
// Regel 20: nås som vanlig lenke-navigasjon fra innstillingene.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${getBaseUrl()}/app`)

  const admin = createAdminClient()
  const { data: lenke } = await admin
    .from('stridee_link')
    .select('external_user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!lenke) {
    return NextResponse.redirect(`${getBaseUrl()}/app/innstillinger/klokkesync?klokke=feil`)
  }

  const res = await hentManageLink(lenke.external_user_id)
  if (!res.url) {
    console.warn(`[stridee-manage] manage-link feilet: ${res.feil}`)
    return NextResponse.redirect(`${getBaseUrl()}/app/innstillinger/klokkesync?klokke=feil`)
  }
  return NextResponse.redirect(res.url)
}

// Samme fallback-kjede som connect-ruta.
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL
    ?? process.env.URL
    ?? 'http://localhost:3000'
}
