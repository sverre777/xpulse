import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { backfillStravaZones } from '@/app/actions/strava-sync'

// Batch-versjon: prosesserer `batch` Strava-importer per kall fra `offset`.
// Edge function 10s timeout sluker hele 187+-loopen i én operasjon, så runner
// looper offset+=batch til is_done.
//
// Query-params:
//   ?batch=20  (default, max 50)
//   ?offset=0  (default)

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const url = new URL(request.url)
  const batch = Math.max(1, Math.min(50, Number(url.searchParams.get('batch') ?? 20)))
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))

  const result = await backfillStravaZones({ batch, offset })
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  // Per-reason aggregering så runner kan vise "X stk OK, Y mangler hr_samples,
  // Z mangler workout_activities" uten å scrolle gjennom hver detalj-rad.
  const reasonSummary: Record<string, number> = {}
  for (const d of result.details) {
    reasonSummary[d.reason] = (reasonSummary[d.reason] ?? 0) + 1
  }
  const successInBatch = result.details.filter(d => d.updated_laps > 0).length
  const failedInBatch = result.details.filter(d => d.updated_laps === 0).length

  return NextResponse.json({
    user_id: user.id,
    batch,
    offset,
    total: result.total,
    processed_in_batch: result.processed_in_batch,
    success_this_batch: successInBatch,
    failed_this_batch: failedInBatch,
    updated_workouts_in_batch: result.updated_in_batch,
    processed_through: result.processed_through,
    total_remaining: Math.max(0, result.total - result.processed_through),
    next_offset: result.next_offset,
    is_done: result.is_done,
    reason_summary: reasonSummary,
    results: result.details,
  })
}
