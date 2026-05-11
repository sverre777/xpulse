import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { backfillStravaZones } from '@/app/actions/strava-sync'

// Throwaway-endepunkt for å backfille zones på eksisterende Strava-importer
// som mangler I1-I5-fordeling. Åpne i nettleseren mens innlogget; rapporten
// returneres som JSON med per-workout detalj så vi ser HVORFOR enkelte ikke
// fikk zones (ingen hr_samples, alle vinduer tomme, osv).
//
// Bruker samme auth-sjekk som /api/diagnostics/strava — krever innlogget
// bruker. Backfillen er per-bruker (kun den innloggedes egne workouts).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const result = await backfillStravaZones()
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  const successCount = result.details.filter(d => d.updated_laps > 0).length
  const failedCount = result.details.filter(d => d.updated_laps === 0).length

  return NextResponse.json({
    user_id: user.id,
    checked: result.checked,
    success_count: successCount,
    failed_count: failedCount,
    details: result.details,
  })
}
