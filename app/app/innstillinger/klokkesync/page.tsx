import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { KlokkesyncView } from '@/components/klokkesync/KlokkesyncView'

interface Props {
  searchParams: Promise<{ strava?: string; polar?: string; detail?: string }>
}

export default async function KlokkesyncInnstillinger({ searchParams }: Props) {
  const supabase = await createClient()
  // Lesebane: header-basert auth (29026a9-mønsteret). Direkte auth.getUser
  // her var rate-limit-utsatt (AuthRetryableFetchError) og ga intermitterende
  // heng — «trykker på klokkesynk og den åpner ikke».
  const user = await getAuthUser()
  if (!user) redirect('/app')

  // ÉN rundtur, ikke tre. De to tilkoblingene er uavhengige av hverandre, og
  // searchParams avhenger ikke av noe av det — de sto likevel på rad og ga
  // mobilen full ventetid før noe kunne rendres.
  //
  // Polar-tilkoblingen (fase 89) vises kun når raden finnes — det fulle
  // Polar-kortet kommer i bolk 5, etter at frakoblingen (bolk 3) er på plass.
  // Stridee-lenken hentes i samme rundtur. TÅLER AT TABELLEN IKKE FINNES:
  // migreringen (fase 106) venter på godkjenning, og sida skal ikke feile av
  // at en tabell mangler — da får utøveren en hvit skjerm av noe som ikke
  // engang er skrudd på ennå. Feil ⇒ ingen Stridee-seksjon, ingenting mer.
  const [{ data: stravaConn }, { data: polarConn }, strideeSvar, sp] = await Promise.all([
    supabase
      .from('strava_connections')
      .select('strava_athlete_id, auto_sync, last_sync_at, scope, token_expires_at, created_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('polar_connections')
      .select('polar_user_id, auto_sync, last_sync_at, last_webhook_at, registered_at, created_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('stridee_link')
      .select('status, stridee_connections(provider, status, koblet_at)')
      .eq('user_id', user.id)
      .maybeSingle(),
    searchParams,
  ])
  // Ingen rad, eller tabellen finnes ikke ennå: ingen klokker å vise.
  const strideeConnections = (strideeSvar?.data?.stridee_connections ?? []) as Array<{
    provider: 'garmin' | 'coros' | 'wahoo' | 'zepp'
    status: 'aktiv' | 'reauth_required' | 'frakoblet'
    koblet_at: string
  }>
  const stravaStatus = sp.strava ?? null
  const polarStatus = sp.polar ?? null
  // detail deles av begge flytene — kun én av dem redirecter av gangen.
  const stravaDetail = sp.detail ?? null

  return (
    <div style={{ backgroundColor: 'var(--flate-3)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader title="Klokkesync" />
        <KlokkesyncView
          stravaConnection={stravaConn ? {
            athlete_id: stravaConn.strava_athlete_id,
            auto_sync: stravaConn.auto_sync,
            last_sync_at: stravaConn.last_sync_at,
            scope: stravaConn.scope,
            connected_at: stravaConn.created_at,
          } : null}
          status={stravaStatus}
          detail={stravaDetail}
          polarConnection={polarConn ? {
            polar_user_id: polarConn.polar_user_id,
            auto_sync: polarConn.auto_sync,
            last_sync_at: polarConn.last_sync_at,
            last_webhook_at: polarConn.last_webhook_at,
            registered_at: polarConn.registered_at,
            connected_at: polarConn.created_at,
          } : null}
          polarStatus={polarStatus}
          strideeConnections={strideeConnections}
        />
      </div>
    </div>
  )
}
