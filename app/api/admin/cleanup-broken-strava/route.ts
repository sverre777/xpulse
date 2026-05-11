import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Throwaway-endepunkt for å slette ødelagte Strava-importer slik at de kan
// re-importeres rent via vanlig sync-flyt. "Ødelagt" = workout finnes, men
// enten har ingen workout_activities (lap-insert feilet ved opprinnelig
// import) eller mangler workout_samples (samples-insert feilet, eller
// Strava ga ikke streams).
//
// Sletter for INNLOGGET BRUKER kun:
//   1. workout_samples WHERE workout_id = broken
//   2. workout_activities WHERE workout_id = broken
//   3. imported_activities WHERE workout_id = broken
//   4. workouts WHERE id = broken AND user_id = me
//
// Etter dette kan brukeren kjøre vanlig Strava-sync — eksisterende
// imported_activities-rader for broken er fjernet, så aktivitetene dukker
// opp i listSyncableActivities igjen.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  // Hent alle Strava-importer med workout_id satt.
  const { data: imports, error: impErr } = await supabase
    .from('imported_activities')
    .select('workout_id, external_id')
    .eq('user_id', user.id)
    .eq('source', 'strava')
    .not('workout_id', 'is', null)
  if (impErr) {
    return NextResponse.json({ error: `imported_activities-query: ${impErr.message}` }, { status: 500 })
  }

  type BrokenDetail = {
    workout_id: string
    external_id: string | null
    lap_count: number
    has_samples: boolean
    reason: string
    deleted: boolean
    delete_error?: string
  }
  const broken: BrokenDetail[] = []
  const kept: Array<{ workout_id: string; external_id: string | null; lap_count: number; has_samples: boolean }> = []

  // Identifiser ødelagte: lap_count=0 ELLER manglende workout_samples-rad.
  for (const imp of imports ?? []) {
    if (!imp.workout_id) continue

    const [{ count: lapCount }, { count: sampleCount }] = await Promise.all([
      supabase
        .from('workout_activities')
        .select('*', { count: 'exact', head: true })
        .eq('workout_id', imp.workout_id),
      supabase
        .from('workout_samples')
        .select('*', { count: 'exact', head: true })
        .eq('workout_id', imp.workout_id),
    ])

    const lc = lapCount ?? 0
    const hasSamples = (sampleCount ?? 0) > 0
    const isBroken = lc === 0 || !hasSamples

    if (!isBroken) {
      kept.push({
        workout_id: imp.workout_id,
        external_id: imp.external_id,
        lap_count: lc,
        has_samples: hasSamples,
      })
      continue
    }

    const reasons: string[] = []
    if (lc === 0) reasons.push('lap_count=0')
    if (!hasSamples) reasons.push('has_samples=false')

    broken.push({
      workout_id: imp.workout_id,
      external_id: imp.external_id,
      lap_count: lc,
      has_samples: hasSamples,
      reason: reasons.join(' + '),
      deleted: false,
    })
  }

  // Slett ødelagte i rekkefølge: samples → activities → imported → workout.
  for (const b of broken) {
    const sampleDel = await supabase
      .from('workout_samples')
      .delete()
      .eq('workout_id', b.workout_id)
    if (sampleDel.error) {
      b.delete_error = `workout_samples: ${sampleDel.error.message}`
      continue
    }

    const actDel = await supabase
      .from('workout_activities')
      .delete()
      .eq('workout_id', b.workout_id)
    if (actDel.error) {
      b.delete_error = `workout_activities: ${actDel.error.message}`
      continue
    }

    const impDel = await supabase
      .from('imported_activities')
      .delete()
      .eq('user_id', user.id)
      .eq('workout_id', b.workout_id)
    if (impDel.error) {
      b.delete_error = `imported_activities: ${impDel.error.message}`
      continue
    }

    const wkDel = await supabase
      .from('workouts')
      .delete()
      .eq('id', b.workout_id)
      .eq('user_id', user.id)
    if (wkDel.error) {
      b.delete_error = `workouts: ${wkDel.error.message}`
      continue
    }

    b.deleted = true
  }

  const deletedCount = broken.filter(b => b.deleted).length
  const failedCount = broken.filter(b => !b.deleted).length

  return NextResponse.json({
    user_id: user.id,
    total_strava_imports: imports?.length ?? 0,
    broken_found: broken.length,
    deleted_count: deletedCount,
    failed_count: failedCount,
    kept_count: kept.length,
    broken_details: broken,
    kept_details: kept,
  })
}
