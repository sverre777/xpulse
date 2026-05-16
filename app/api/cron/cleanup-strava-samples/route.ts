import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Daglig cron som sletter Strava-samples som er over 7 dager gamle.
// Strava API Agreement § 7 krever sletting av rå data innen 7d.
//
// Aggregerte verdier på workouts og workout_activities beholdes — kun
// workout_samples-radens sekund-data fjernes.
//
// Setup på Netlify Scheduled Functions (eksternt):
//   schedule.add('0 3 * * *', '/api/cron/cleanup-strava-samples')
// Authorization: Bearer ${CRON_SECRET}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Uautorisert' }, { status: 401 })
  }

  // Bruk service-role-client siden cron-jobben opererer på vegne av alle
  // brukere (ingen auth-session).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const nowIso = new Date().toISOString()

  // Slett samples som er forfalt. RLS er bypasset av service-role.
  const { data: deleted, error } = await supabase
    .from('workout_samples')
    .delete()
    .eq('source', 'strava')
    .lt('cache_expires_at', nowIso)
    .select('id')
  if (error) {
    console.error('[cron cleanup-strava-samples] failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const count = deleted?.length ?? 0
  console.log(`[cron cleanup-strava-samples] slettet ${count} forfalte Strava-samples`)
  return NextResponse.json({ ok: true, deleted_count: count, ran_at: nowIso })
}
