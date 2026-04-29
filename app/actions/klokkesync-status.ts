'use server'

import { createClient } from '@/lib/supabase/server'

// Lett-vekt status-action for topbar-ikonet. Returnerer kun det som
// trengs for å vise prikken og popup — minimal payload, kjapt kall.

export interface KlokkesyncStatus {
  connected: boolean
  // Hvis koblet: når sist Strava-synk gikk gjennom (cron eller manuell).
  lastSyncAt: string | null
  // Hvis koblet: nyeste importerte aktivitet (tittel + dato + workout_id
  // for klikk-til-detalj).
  lastWorkout: {
    id: string
    title: string
    date: string
    source: string  // 'strava' / 'fit_upload'
  } | null
  // Sant hvis token er utløpt og refresh ikke virker. Foreløpig avledet
  // fra utløpt token uten siste-synk i etterkant.
  hasError: boolean
}

export async function getKlokkesyncStatus(): Promise<KlokkesyncStatus> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { connected: false, lastSyncAt: null, lastWorkout: null, hasError: false }
  }

  const { data: conn } = await supabase
    .from('strava_connections')
    .select('last_sync_at, token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn) {
    return { connected: false, lastSyncAt: null, lastWorkout: null, hasError: false }
  }

  // Token er gyldig minst 5 min frem. last_sync_at som er mer enn 24t
  // gammel når token-expires er passert tolkes som feil-tilstand.
  const tokenExpired = new Date(conn.token_expires_at).getTime() < Date.now()
  const hasError = tokenExpired && !!conn.last_sync_at &&
    (Date.now() - new Date(conn.last_sync_at).getTime()) > 24 * 3600 * 1000

  // Hent nyeste importerte aktivitet (Strava eller .fit-upload).
  const { data: imported } = await supabase
    .from('imported_activities')
    .select('workout_id, source, imported_at, workouts(id, title, date)')
    .eq('user_id', user.id)
    .not('workout_id', 'is', null)
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const w = imported && Array.isArray(imported.workouts)
    ? imported.workouts[0]
    : (imported?.workouts as { id: string; title: string; date: string } | null | undefined)

  return {
    connected: true,
    lastSyncAt: conn.last_sync_at,
    lastWorkout: w ? {
      id: w.id,
      title: w.title,
      date: w.date,
      source: imported?.source ?? 'strava',
    } : null,
    hasError,
  }
}
