import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchPolarExercises,
  fetchPolarExerciseDetail,
  mapPolarSportToXpulse,
  parseIsoDuration,
  parsePolarSamples,
  polarLocalStart,
  type PolarConnection,
} from '@/lib/polar'
import { computeZoneSecondsFromSamples, getHeartZonesForUser } from '@/lib/heart-zones'
import type { Sport } from '@/lib/types'

// ENESTE importvei for Polar. Både webhooken (app/api/polar/webhook) og
// cron-fallbacken (app/api/cron/polar-sync) kaller denne — ingen parallell
// implementasjon.
//
// Gjenbruker den etablerte importlogikken i appen:
//  · anti-duplikat via imported_activities (external_id = `polar_<hash-id>`)
//  · konflikthåndtering: samme ±30-minutters vindu som Strava-importen, og
//    samme regel om at økter UTEN klokkeslett ikke teller som konflikt
//  · sonekalkulering fra BRUKERENS EGEN skala (user_heart_zones via
//    getHeartZonesForUser + computeZoneSecondsFromSamples — sekunder, fase 64)
//  · innboksvarsel per importert økt (notifications-tabellen)
//
// Polar-særegenheter som styrer utformingen:
//  · Ingen lap-data i hash-id-APIet → én workout_activities-rad per økt.
//  · Ingen økt-tittel fra Polar → tittelen utledes av bevegelsesformen.
//  · start_time er LOKAL tid → brukes direkte som dato + klokkeslett.
//  · Kun siste 30 dager, og kun økter lastet opp etter registrering.

const CONFLICT_WINDOW_MINUTES = 30

export type PolarImportStatus =
  | 'imported' | 'duplicate' | 'conflict' | 'not_found' | 'failed'

export interface PolarImportOutcome {
  external_id: string
  status: PolarImportStatus
  workout_id?: string
  error?: string
  notes?: string[]
}

export interface PolarImportSummary {
  user_id: string
  polar_user_id: number
  checked: number
  imported: number
  duplicates: number
  conflicts: number
  failed: number
  outcomes: PolarImportOutcome[]
  notes: string[]
}

function emptySummary(conn: PolarConnection): PolarImportSummary {
  return {
    user_id: conn.user_id,
    polar_user_id: conn.polar_user_id,
    checked: 0, imported: 0, duplicates: 0, conflicts: 0, failed: 0,
    outcomes: [], notes: [],
  }
}

// Importer nye Polar-økter for én tilkobling.
//   onlyExerciseId satt  → kun den økta (webhook-veien: vi har id-en, og
//                          slipper å liste)
//   onlyExerciseId utelatt → alle økter Polar tilbyr (siste 30 dager)
export async function importPolarExercises(
  supabase: SupabaseClient,
  conn: PolarConnection,
  opts: { onlyExerciseId?: string } = {},
): Promise<PolarImportSummary> {
  const summary = emptySummary(conn)

  let ids: string[]
  if (opts.onlyExerciseId) {
    ids = [opts.onlyExerciseId]
  } else {
    try {
      const list = await fetchPolarExercises(supabase, conn)
      ids = list.map(e => String(e.id)).filter(Boolean)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      summary.notes.push(`kunne ikke hente øktliste: ${msg}`)
      return summary
    }
  }
  summary.checked = ids.length
  if (ids.length === 0) return summary

  // Anti-duplikat i én spørring for hele settet.
  const externalIds = ids.map(id => `polar_${id}`)
  const { data: already } = await supabase
    .from('imported_activities')
    .select('external_id')
    .eq('user_id', conn.user_id)
    .eq('source', 'polar')
    .in('external_id', externalIds)
  const importedSet = new Set((already ?? []).map(r => r.external_id as string))

  for (const id of ids) {
    const externalId = `polar_${id}`
    if (importedSet.has(externalId)) {
      summary.duplicates++
      summary.outcomes.push({ external_id: externalId, status: 'duplicate' })
      continue
    }
    try {
      const outcome = await importOneExercise(supabase, conn, id)
      summary.outcomes.push(outcome)
      if (outcome.status === 'imported') summary.imported++
      else if (outcome.status === 'conflict') summary.conflicts++
      else if (outcome.status === 'duplicate') summary.duplicates++
      else summary.failed++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[polar-import] ${externalId} feilet:`, msg)
      summary.failed++
      summary.outcomes.push({ external_id: externalId, status: 'failed', error: msg })
    }
  }

  if (summary.imported > 0 || !opts.onlyExerciseId) {
    await supabase
      .from('polar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', conn.user_id)
  }

  return summary
}

async function importOneExercise(
  supabase: SupabaseClient,
  conn: PolarConnection,
  exerciseId: string,
): Promise<PolarImportOutcome> {
  const externalId = `polar_${exerciseId}`

  const detail = await fetchPolarExerciseDetail(supabase, conn, exerciseId, { samples: true })
  if (!detail) {
    return { external_id: externalId, status: 'not_found' }
  }

  const start = polarLocalStart(detail)
  if (!start.date) {
    return { external_id: externalId, status: 'failed', error: 'økta mangler start_time' }
  }

  // Konflikt: eksisterende økt samme dato innenfor ±30 min. Økter uten
  // klokkeslett (typisk manuelt ført) regnes IKKE som konflikt — samme regel
  // som Strava-importen, ellers ville hver manuell loggføring blokkert
  // importen den dagen.
  const { data: sameDay } = await supabase
    .from('workouts')
    .select('id, date, time_of_day')
    .eq('user_id', conn.user_id)
    .eq('date', start.date)
  const conflictId = findConflict(start, (sameDay ?? []) as SameDayWorkout[])
  if (conflictId) {
    return { external_id: externalId, status: 'conflict', workout_id: conflictId }
  }

  const mapping = mapPolarSportToXpulse(detail.sport, detail.detailed_sport_info)
  const durationSec = parseIsoDuration(detail.duration)
  const parsed = parsePolarSamples(detail)
  if (parsed.notes.length > 0) {
    console.log(`[polar-import] ${externalId} sample-merknader: ${parsed.notes.join(' · ')}`)
  }

  // workouts.sport = brukerens hovedidrett fra profilen (en langrennsutøver er
  // fortsatt langrennsutøver selv om økta er en sykkeltur). Polar-sporten
  // styrer kun aktivitetsradens bevegelsesform.
  const { data: profile } = await supabase
    .from('profiles')
    .select('primary_sport')
    .eq('id', conn.user_id)
    .maybeSingle()
  const sport = (profile?.primary_sport as Sport | null) ?? 'endurance'

  const title = mapping.movement !== 'Annet' ? mapping.movement : 'Økt fra Polar'

  const { data: workout, error: wErr } = await supabase
    .from('workouts')
    .insert({
      user_id: conn.user_id,
      title,
      sport,
      // Polar gir ingen økttype-tagg. 'other' er den ærlige verdien — vi vil
      // ikke merke alt som langtur og forurense type-basert analyse.
      workout_type: 'other',
      date: start.date,
      time_of_day: start.time,
      duration_minutes: Math.round(durationSec / 60),
      distance_km: detail.distance != null ? Math.round((detail.distance / 1000) * 100) / 100 : null,
      avg_heart_rate: detail.heart_rate?.average ?? null,
      max_heart_rate: detail.heart_rate?.maximum ?? null,
      calories: detail.calories ?? null,
      is_planned: false,
      is_completed: true,
      imported_from: 'polar',
    })
    .select('id')
    .single()
  if (wErr || !workout) {
    return { external_id: externalId, status: 'failed', error: wErr?.message ?? 'workout-insert feilet' }
  }

  // Én aktivitetsrad — hash-id-APIet gir ingen lap-inndeling.
  //
  // workout_activities.distance_meters er numeric(7,2), altså maks 99 999,99 m
  // (~100 km). Strava kommer unna med det fordi hver rad er ett lap, men vi
  // legger HELE økta i én rad — en 150 km sykkeltur ville sprengt kolonnen og
  // feilet inserten. Da lar vi feltet stå tomt heller enn å miste aktiviteten;
  // workouts.distance_km (numeric(6,2), maks 9 999,99 km) holder distansen.
  const ACTIVITY_DISTANCE_MAX_M = 99999.99
  const rawDistanceM = detail.distance != null ? Math.round(detail.distance) : null
  const activityDistanceM = rawDistanceM != null && rawDistanceM <= ACTIVITY_DISTANCE_MAX_M
    ? rawDistanceM
    : null
  if (rawDistanceM != null && activityDistanceM == null) {
    console.warn(
      `[polar-import] ${externalId}: distanse ${rawDistanceM} m overskrider ` +
      'workout_activities.distance_meters (numeric(7,2)) — lagres kun på økta',
    )
  }

  const zones = await computeZonesForWorkout(supabase, conn.user_id, parsed, durationSec)
  const { data: activity, error: aErr } = await supabase
    .from('workout_activities')
    .insert({
      workout_id: workout.id,
      activity_type: 'aktivitet',
      movement_name: mapping.movement,
      movement_subcategory: mapping.subcategory,
      duration_seconds: durationSec,
      distance_meters: activityDistanceM,
      avg_heart_rate: detail.heart_rate?.average ?? null,
      max_heart_rate: detail.heart_rate?.maximum ?? null,
      sort_order: 0,
      zones,
      external_id: externalId,
    })
    .select('id')
    .single()
  if (aErr) {
    console.error(`[polar-import] ${externalId} aktivitets-insert feilet:`, aErr.message)
  }

  if (parsed.hasAny) {
    const { error: sErr } = await supabase.from('workout_samples').insert({
      workout_id: workout.id,
      activity_id: activity?.id ?? null,
      user_id: conn.user_id,
      ...parsed.samples,
      source: 'polar',
    })
    if (sErr) {
      console.error(`[polar-import] ${externalId} samples-insert feilet:`, sErr.message)
    }
  }

  // Anti-duplikat-sporingen er det som hindrer at økta importeres på nytt.
  // Feiler den, RULLER VI TILBAKE økta (cascade tar aktivitet + samples) —
  // ellers ville neste kjøring laget en duplikat-økt.
  //
  // 23505 = unique_violation på (user_id, source, external_id): webhooken og
  // cronen kjørte samtidig og den andre vant. Da er økta allerede importert,
  // og vår er den som skal bort.
  const { error: impErr } = await supabase.from('imported_activities').insert({
    user_id: conn.user_id,
    source: 'polar',
    external_id: externalId,
    workout_id: workout.id,
  })
  if (impErr) {
    const raceLost = impErr.code === '23505'
    console[raceLost ? 'log' : 'error'](
      `[polar-import] ${externalId} imported_activities-insert ${raceLost ? 'tapte kappløp' : 'feilet'}: ${impErr.message} — ruller tilbake økta`,
    )
    await supabase.from('workouts').delete().eq('id', workout.id).eq('user_id', conn.user_id)
    return {
      external_id: externalId,
      status: raceLost ? 'duplicate' : 'failed',
      error: raceLost ? undefined : impErr.message,
    }
  }

  const durMin = Math.round(durationSec / 60)
  await supabase.from('notifications').insert({
    user_id: conn.user_id,
    type: 'polar_imported',
    title: 'Ny økt importert fra Polar',
    content: `${title} · ${durMin} min`,
    link_url: `/app/dagbok?edit=${workout.id}`,
  })

  return {
    external_id: externalId,
    status: 'imported',
    workout_id: workout.id,
    notes: parsed.notes.length > 0 ? parsed.notes : undefined,
  }
}

// Soner fra brukerens EGEN pulsskala. Hopper over hvis pulsdataene ikke er
// til å stole på (kryssjekket i parsePolarSamples) eller brukeren ikke har
// soner — vi skriver heller ingen soner enn feil soner.
async function computeZonesForWorkout(
  supabase: SupabaseClient,
  userId: string,
  parsed: ReturnType<typeof parsePolarSamples>,
  durationSec: number,
): Promise<Record<string, number> | null> {
  const hr = parsed.samples.hr_samples
  if (!hr || hr.length < 2 || !parsed.hrTrusted) return null

  const zones = await getHeartZonesForUser(supabase, userId)
  if (zones.length === 0) return null

  const seconds = computeZoneSecondsFromSamples(hr, zones, 0, durationSec > 0 ? durationSec : undefined)
  const total = seconds.I1 + seconds.I2 + seconds.I3 + seconds.I4 + seconds.I5
  if (total <= 0) return null
  return { ...seconds, Hurtighet: 0 }
}

interface SameDayWorkout {
  id: string
  date: string
  time_of_day: string | null
}

function findConflict(
  start: { date: string; time: string; ms: number },
  workouts: SameDayWorkout[],
): string | null {
  for (const w of workouts) {
    if (w.date !== start.date) continue
    if (!w.time_of_day) continue
    const wMs = new Date(`${w.date}T${w.time_of_day.slice(0, 5)}:00Z`).getTime()
    if (Math.abs(start.ms - wMs) / 60000 <= CONFLICT_WINDOW_MINUTES) return w.id
  }
  return null
}
