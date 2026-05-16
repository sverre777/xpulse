import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Daglig cleanup av utløpte abonnement etter 90-dagers grace-period.
// Finner brukere med data_deletion_scheduled_at < now() og sletter all
// trenings- og plan-data. auth.users-raden beholdes så brukeren kan
// re-registrere med samme e-post senere.
//
// Cascade-FK på workouts → workout_activities/samples/imported_activities,
// så vi kan delete fra workouts direkte. RLS er bypasset av service_role.

async function handler(request: Request) {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Uautorisert' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Mangler Supabase-env' }, { status: 500 })
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Finn alle subscriptions klare for sletting.
  const nowIso = new Date().toISOString()
  const { data: due, error } = await supabase
    .from('subscriptions')
    .select('user_id, stripe_subscription_id')
    .lt('data_deletion_scheduled_at', nowIso)
  if (error) {
    console.error('[cron cleanup-expired-subscriptions] query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{ user_id: string; deleted: boolean; error?: string }> = []

  for (const row of due ?? []) {
    const uid = row.user_id as string
    try {
      // Slett trenings- og plan-data. Cascade-FK på workouts dekker activities/samples/imports.
      await supabase.from('workouts').delete().eq('user_id', uid)
      await supabase.from('plan_templates').delete().eq('user_id', uid)
      await supabase.from('workout_templates').delete().eq('user_id', uid)
      await supabase.from('imported_activities').delete().eq('user_id', uid)
      await supabase.from('subscriptions').delete().eq('user_id', uid)
      await supabase.from('feature_waitlist').delete().eq('user_id', uid)
      // auth.users beholdes — brukeren kan re-registrere med samme e-post.
      results.push({ user_id: uid, deleted: true })
      console.log(`[cron cleanup-expired-subscriptions] slettet data for user ${uid}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[cron cleanup-expired-subscriptions] feilet for ${uid}:`, msg)
      results.push({ user_id: uid, deleted: false, error: msg })
    }
  }

  return NextResponse.json({
    ok: true,
    ran_at: nowIso,
    deleted_count: results.filter(r => r.deleted).length,
    failed_count: results.filter(r => !r.deleted).length,
    results,
  })
}

export async function GET(request: Request) { return handler(request) }
export async function POST(request: Request) { return handler(request) }
