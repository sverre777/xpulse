import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { STRIDEE_AKTIV } from '@/lib/stridee'
import { erStrideeProvider } from '@/lib/stridee-prosessering'
import { startStrideeConnect } from '@/lib/stridee-api'

/**
 * Starter tilkoblingen av en klokke via leverandøren:
 * GET /api/klokkesync/stridee/connect?provider=garmin|coros|wahoo|zepp
 *
 * Flyten (etter /docs/connections):
 *   1. Finn eller opprett brukerens stridee_link. RLS gir authenticated kun
 *      lesing — skrivingen skjer med service-role, og ruta er den ENESTE
 *      inngangen: koblingen avgjør hvem som eier treningsdata.
 *   2. Signert POST /v1/connect med vår external_user_id (den ugjennom-
 *      siktige — Supabase-uuid-en forlater aldri huset).
 *   3. Lagre stridee_user_id fra svaret. Dokumentert idempotent: samme
 *      external_user_id gir samme user_id igjen, aldri en ny identitet.
 *   4. 302 til connect_url — leverandørens side eier resten, og brukeren
 *      lander tilbake på klokkesync-sida (?status=…).
 *
 * Feil gir en LESBAR status på klokkesync-sida (?klokke=…), aldri 500 —
 * samme prinsipp som Polar-flyten. Regel 20 er dekket av at dette er en
 * ren lenkenavigasjon: browseren svarer i samme tick.
 */
export async function GET(req: NextRequest) {
  const tilbake = (status: string, detail?: string) => {
    const u = new URL('/app/innstillinger/klokkesync', getBaseUrl())
    u.searchParams.set('klokke', status)
    if (detail) u.searchParams.set('detail', detail.slice(0, 120))
    return NextResponse.redirect(u)
  }

  if (!STRIDEE_AKTIV) return tilbake('avslatt')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/app', getBaseUrl()))

  const provider = req.nextUrl.searchParams.get('provider')
  if (!erStrideeProvider(provider)) {
    return tilbake('ukjent-merke', `provider=${provider ?? 'mangler'}`)
  }

  const db = createAdminClient()

  // 1. Lenken. En 'slettet' rad gjenbrukes — den har allerede rotert
  //    external_user_id, så en ny tilkobling starter med ren identitet.
  let { data: link } = await db
    .from('stridee_link')
    .select('id, external_user_id, status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!link) {
    const { data: ny, error } = await db
      .from('stridee_link')
      .insert({ user_id: user.id, status: 'pending' })
      .select('id, external_user_id, status')
      .single()
    if (error || !ny) return tilbake('feil', `lenke-oppretting: ${error?.message ?? 'ukjent'}`)
    link = ny
  }

  // 2 + 3. Signert connect-kall og lagring av deres id.
  const svar = await startStrideeConnect(
    provider,
    link.external_user_id as string,
    `${getBaseUrl()}/app/innstillinger/klokkesync`,
  )
  if (svar.feil || !svar.data?.connect_url) {
    console.error(`[stridee-connect] ${svar.feil ?? 'tomt svar'}`)
    return tilbake('feil', svar.feil)
  }
  await db.from('stridee_link')
    .update({
      stridee_user_id: svar.data.user_id,
      // 'slettet' → 'pending': raden er i live igjen. En aktiv lenke
      // beholder statusen sin — å legge til klokke nr. 2 degraderer ingenting.
      ...(link.status === 'slettet' || link.status === 'frakoblet' ? { status: 'pending' } : {}),
      oppdatert_at: new Date().toISOString(),
    })
    .eq('id', link.id)

  // 4. Av gårde til leverandørens tilkoblingsside.
  return NextResponse.redirect(svar.data.connect_url)
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
}
