import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { KlokkesyncView } from '@/components/klokkesync/KlokkesyncView'

interface Props {
  searchParams: Promise<{ strava?: string }>
}

export default async function KlokkesyncInnstillinger({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: stravaConn } = await supabase
    .from('strava_connections')
    .select('strava_athlete_id, auto_sync, last_sync_at, scope, token_expires_at, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  // Henter Strava-athlete-navn fra profile-table om vi har det. (Strava
  // returnerer firstname/lastname i athlete-objektet ved OAuth, men vi
  // lagrer ikke det enda — viser bare athlete_id som fallback.)
  const sp = await searchParams
  const stravaStatus = sp.strava ?? null

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
        />
      </div>
    </div>
  )
}
