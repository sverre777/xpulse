'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

// To server-actions for topbar-status:
//
// getKlokkesyncBadge — hentes server-side i layout, kjører før første
//   render så ikonet rendres med riktig fargedot fra start. Én DB-query.
//
// getKlokkesyncStatus — full status med siste imported workout, kalles
//   først når brukeren åpner popup. To DB-queries.

export interface KlokkesyncBadge {
  connected: boolean
  lastSyncAt: string | null
  hasError: boolean
}

export interface KlokkesyncStatus extends KlokkesyncBadge {
  lastWorkout: {
    id: string
    title: string
    date: string
    source: string
  } | null
}

// Liten payload for badge-ren­dering. Brukes fra (authed)-layout server-
// side så ikonet vises samtidig med de andre topbar-ikonene.
export async function getKlokkesyncBadge(): Promise<KlokkesyncBadge> {
  const supabase = await createClient()
  // Ren lesebane på hver sidelast — header-identitet, ingen Auth-rundtur.
  const user = await getAuthUser()
  if (!user) {
    return { connected: false, lastSyncAt: null, hasError: false }
  }
  const { strava, polar } = await readConnections(supabase, user.id)
  if (!strava && !polar) {
    return { connected: false, lastSyncAt: null, hasError: false }
  }
  return {
    connected: true,
    lastSyncAt: newestIso(strava?.last_sync_at ?? null, polar?.last_sync_at ?? null),
    hasError: hasSyncError(strava, polar),
  }
}

// ── Delt lesing på tvers av klokkemerker ─────────────────────
// Badge og popup skal vise status for ALLE tilkoblede merker, ikke bare
// Strava. Legges et nytt merke til, utvides disse to helperne (og
// KLOKKESYNC_BRANDS), ikke kall-stedene.

interface StravaConnRow { last_sync_at: string | null; token_expires_at: string }
interface PolarConnRow { last_sync_at: string | null; registered_at: string | null }

async function readConnections(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ strava: StravaConnRow | null; polar: PolarConnRow | null }> {
  const [stravaRes, polarRes] = await Promise.all([
    supabase.from('strava_connections')
      .select('last_sync_at, token_expires_at').eq('user_id', userId).maybeSingle(),
    supabase.from('polar_connections')
      .select('last_sync_at, registered_at').eq('user_id', userId).maybeSingle(),
  ])
  return {
    strava: (stravaRes.data as StravaConnRow | null) ?? null,
    polar: (polarRes.data as PolarConnRow | null) ?? null,
  }
}

function newestIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

// Feil-tilstander som fortjener rød prikk:
//  · Strava: token utløpt OG ingen vellykket synk siste døgn
//  · Polar: tilkoblet, men registreringen hos Polar ble aldri fullført —
//    da får vi ingen data før brukeren fullfører den
function hasSyncError(strava: StravaConnRow | null, polar: PolarConnRow | null): boolean {
  const stravaError = !!strava &&
    new Date(strava.token_expires_at).getTime() < Date.now() &&
    !!strava.last_sync_at &&
    (Date.now() - new Date(strava.last_sync_at).getTime()) > 24 * 3600 * 1000
  const polarError = !!polar && !polar.registered_at
  return stravaError || polarError
}

export async function getKlokkesyncStatus(): Promise<KlokkesyncStatus> {
  const supabase = await createClient()
  // Ren lesebane — header-identitet, ingen Auth-rundtur.
  const user = await getAuthUser()
  if (!user) {
    return { connected: false, lastSyncAt: null, lastWorkout: null, hasError: false }
  }

  const { strava, polar } = await readConnections(supabase, user.id)
  if (!strava && !polar) {
    return { connected: false, lastSyncAt: null, lastWorkout: null, hasError: false }
  }

  const hasError = hasSyncError(strava, polar)

  // Hent nyeste importerte aktivitet (Strava, Polar eller .fit-upload).
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
    lastSyncAt: newestIso(strava?.last_sync_at ?? null, polar?.last_sync_at ?? null),
    lastWorkout: w ? {
      id: w.id,
      title: w.title,
      date: w.date,
      source: imported?.source ?? 'strava',
    } : null,
    hasError,
  }
}
