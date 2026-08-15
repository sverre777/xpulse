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

  const { data: stravaConn } = await supabase
    .from('strava_connections')
    .select('strava_athlete_id, auto_sync, last_sync_at, scope, token_expires_at, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  // Polar-tilkoblingen (fase 89). Vises kun når raden finnes — det fulle
  // Polar-kortet kommer i bolk 5, etter at frakoblingen (bolk 3) er på plass.
  const { data: polarConn } = await supabase
    .from('polar_connections')
    .select('polar_user_id, auto_sync, last_sync_at, registered_at, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  // Henter Strava-athlete-navn fra profile-table om vi har det. (Strava
  // returnerer firstname/lastname i athlete-objektet ved OAuth, men vi
  // lagrer ikke det enda — viser bare athlete_id som fallback.)
  const sp = await searchParams
  const stravaStatus = sp.strava ?? null
  const polarStatus = sp.polar ?? null
  // detail deles av begge flytene — kun én av dem redirecter av gangen.
  const stravaDetail = sp.detail ?? null

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
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
            registered_at: polarConn.registered_at,
            connected_at: polarConn.created_at,
          } : null}
          polarStatus={polarStatus}
        />
      </div>
    </div>
  )
}
