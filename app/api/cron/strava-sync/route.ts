import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchStravaActivities,
  fetchStravaActivityDetail,
  fetchStravaStreams,
  mapStravaSportToXpulse,
  type StravaConnection,
  type StravaActivityDetail,
  type StravaStreamSet,
  type StravaLap,
} from '@/lib/strava'

// Cron-route for auto-synk fra Strava. Konfigurer Vercel cron til å treffe
// denne hver time (eller hver 15. min). Eksternt kall må sende
// Authorization: Bearer ${CRON_SECRET} så ikke åpen for offentlig spam.
//
// Sjekker alle brukere med auto_sync=true, henter siste 24t aktiviteter,
// importerer ikke-konflikterende. Konflikter må brukeren selv håndtere
// via /app/innstillinger/klokkesync. Lager innboks-varsel per importert
// aktivitet.
//
// Bruker service-role for å bypass RLS — vi har null bruker-session her.

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: connections, error } = await supabase
    .from('strava_connections')
    .select('*')
    .eq('auto_sync', true)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!connections || connections.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  const SINCE = Math.floor((Date.now() - 24 * 3600 * 1000) / 1000)
  let totalImported = 0
  const results: { user_id: string; imported: number; error?: string }[] = []

  for (const conn of connections as StravaConnection[]) {
    try {
      const imported = await syncOneUser(supabase, conn, SINCE)
      totalImported += imported
      results.push({ user_id: conn.user_id, imported })
    } catch (e) {
      console.error(`Strava cron sync failed for user ${conn.user_id}:`, e)
      results.push({ user_id: conn.user_id, imported: 0, error: String(e) })
    }
  }

  return NextResponse.json({ ok: true, processed: connections.length, totalImported, results })
}

async function syncOneUser(
  supabase: ReturnType<typeof createAdminClient>,
  conn: StravaConnection,
  since: number,
): Promise<number> {
  // Bruk samme fetch-helpers som server-actionen — de tar supabase-klient
  // som arg, så fungerer fint med admin-klient også. Token-fornying
  // skriver til DB direkte med admin-bypassed RLS.
  const stravaActivities = await fetchStravaActivities(
    supabase, conn, { after: since, per_page: 30 },
  )

  if (stravaActivities.length === 0) return 0

  // Filter ut allerede importerte.
  const externalIds = stravaActivities.map(a => `strava_${a.id}`)
  const { data: alreadyImported } = await supabase
    .from('imported_activities')
    .select('external_id')
    .eq('user_id', conn.user_id)
    .eq('source', 'strava')
    .in('external_id', externalIds)
  const importedSet = new Set((alreadyImported ?? []).map(r => r.external_id as string))

  // Filter ut konflikter (samme dato +/- 30 min).
  const dates = Array.from(new Set(stravaActivities.map(a => a.start_date.slice(0, 10))))
  const { data: existingWorkouts } = await supabase
    .from('workouts')
    .select('id, date, time_of_day')
    .eq('user_id', conn.user_id)
    .in('date', dates)

  let imported = 0
  for (const sa of stravaActivities) {
    const externalId = `strava_${sa.id}`
    if (importedSet.has(externalId)) continue
    if (hasConflict(sa.start_date, existingWorkouts ?? [])) continue

    // Hent detalj + streams og lag workout.
    const detail: StravaActivityDetail = await fetchStravaActivityDetail(supabase, conn, sa.id)
    const streams: StravaStreamSet = await fetchStravaStreams(supabase, conn, sa.id)

    const workoutId = await createWorkoutFromStrava(supabase, conn.user_id, detail, streams, externalId)
    if (workoutId) {
      imported++
      await insertImportNotification(supabase, conn.user_id, detail, workoutId)
    }
  }

  await supabase
    .from('strava_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', conn.user_id)

  return imported
}

function hasConflict(
  isoStart: string,
  workouts: { date: string; time_of_day: string | null }[],
): boolean {
  const stravaTs = new Date(isoStart).getTime()
  const stravaDate = isoStart.slice(0, 10)
  for (const w of workouts) {
    if (w.date !== stravaDate) continue
    if (!w.time_of_day) return true
    const wTs = new Date(`${w.date}T${w.time_of_day.slice(0, 5)}:00`).getTime()
    if (Math.abs(stravaTs - wTs) / 60000 <= 30) return true
  }
  return false
}

async function createWorkoutFromStrava(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  detail: StravaActivityDetail,
  streams: StravaStreamSet,
  externalId: string,
): Promise<string | null> {
  const sport = mapStravaSportToXpulse(detail.sport_type)
  const startDate = new Date(detail.start_date)
  const dateStr = startDate.toISOString().slice(0, 10)
  const timeStr = startDate.toISOString().slice(11, 16)

  const { data: workout, error } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      title: detail.name,
      notes: detail.description ?? null,
      sport,
      workout_type: 'long_run',
      date: dateStr,
      time_of_day: timeStr,
      duration_minutes: Math.round(detail.elapsed_time / 60),
      distance_km: Math.round((detail.distance / 1000) * 100) / 100,
      avg_heart_rate: detail.average_heartrate ?? null,
      max_heart_rate: detail.max_heartrate ?? null,
      elevation_meters: Math.round(detail.total_elevation_gain),
      is_planned: false,
      is_completed: true,
    })
    .select('id')
    .single()
  if (error || !workout) return null

  if (detail.laps && detail.laps.length > 0) {
    const rows = detail.laps.map((lap: StravaLap, idx: number) => ({
      workout_id: workout.id,
      activity_type: sport,
      duration_seconds: lap.elapsed_time,
      distance_meters: Math.round(lap.distance),
      avg_heart_rate: lap.average_heartrate ?? null,
      elevation_gain_m: Math.round(lap.total_elevation_gain),
      sort_order: idx,
      strava_lap_index: lap.lap_index,
      external_id: `strava_lap_${lap.id}`,
    }))
    await supabase.from('workout_activities').insert(rows)
  }

  if (hasStreamData(streams)) {
    await supabase.from('workout_samples').insert({
      workout_id: workout.id,
      user_id: userId,
      ...mapStreamsToSamples(streams),
      source: 'strava',
    })
  }

  await supabase.from('imported_activities').insert({
    user_id: userId,
    source: 'strava',
    external_id: externalId,
    workout_id: workout.id,
  })

  return workout.id
}

function hasStreamData(s: StravaStreamSet): boolean {
  return !!(s.heartrate || s.watts || s.velocity_smooth || s.altitude || s.cadence)
}

function mapStreamsToSamples(streams: StravaStreamSet) {
  const time = streams.time?.data ?? []
  const arr = (s: { data: number[] } | undefined, key: string) => {
    if (!s?.data) return null
    return s.data.map((val, i) => ({ t: time[i] ?? i, [key]: val }))
  }
  return {
    hr_samples:       arr(streams.heartrate, 'hr'),
    watt_samples:     arr(streams.watts, 'w'),
    pace_samples:     arr(streams.velocity_smooth, 'mps'),
    altitude_samples: arr(streams.altitude, 'alt'),
    cadence_samples:  arr(streams.cadence, 'cad'),
  }
}

async function insertImportNotification(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  detail: StravaActivityDetail,
  workoutId: string,
) {
  const durMin = Math.round(detail.elapsed_time / 60)
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'strava_imported',
    title: 'Ny økt importert fra Strava',
    content: `${detail.name} · ${durMin} min`,
    link_url: `/app/dagbok?edit=${workoutId}`,
  })
}
