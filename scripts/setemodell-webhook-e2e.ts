// SETEMODELLEN — webhook-E2E i TESTMODUS (bolk 2, DB-halvdelene).
// Kjører hele kjeden: Stripe test-API → `stripe listen`-forwarding →
// http://localhost:3000/api/stripe/webhook → Supabase. Rapporterer FAKTISK
// utfall. Forutsetter at dev-serveren og stripe listen kjører.
//
// Dekker DB-halvdelene av scenarioene:
//   A  — seat_quantity speiles i subscriptions via webhook
//   E  — deleted → trener-rad canceled + granted-KASKADEN m/ grace-felter
//   G  — fail-closed: granted current_period_end synkes til trenerens
//        periodeslutt ved subscription.updated; utløpt dato = ingen tilgang
//        (hasActiveAccess) selv uten webhook
//   +  — nytt abonnement for samme bruker ERSTATTER raden (user_id-upsert,
//        ingen unique-krasj), og sene events for det gamle abonnementet
//        klår ikke på raden (resend via Stripe CLI)
//
// Lager egne testbrukere + Stripe-fixtures og RYDDER OPP alt til slutt.
// Kjør: npx tsx scripts/setemodell-webhook-e2e.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { hasActiveAccess, type ActiveSubscription } from '../lib/subscriptions'

for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const KEY = process.env.STRIPE_SECRET_KEY ?? ''
if (!KEY.startsWith('sk_test_')) {
  console.error('AVBRUTT: kun sk_test-nøkkel er lov her.')
  process.exit(1)
}
const stripe = new Stripe(KEY, { apiVersion: '2026-04-22.dahlia' })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)
const PRICE_TRENER_PRO = process.env.STRIPE_PRICE_TRENER_PRO!
const PRICE_SEAT = process.env.STRIPE_PRICE_UTOVERPLASS!

let feil = 0
function ok(navn: string, betingelse: boolean, faktisk?: string) {
  const suffix = faktisk ? `  [faktisk: ${faktisk}]` : ''
  if (betingelse) console.log(`  ok   ${navn}${suffix}`)
  else { feil++; console.error(`  FEIL ${navn}${suffix}`) }
}

// Poll til betingelsen er sann (webhooken er asynkron via CLI-forwarding).
async function poll<T>(hent: () => Promise<T>, sjekk: (v: T) => boolean, timeoutMs = 20000): Promise<T> {
  const start = Date.now()
  for (;;) {
    const v = await hent()
    if (sjekk(v)) return v
    if (Date.now() - start > timeoutMs) return v
    await new Promise(r => setTimeout(r, 700))
  }
}

type SubRow = {
  id: string; user_id: string; tier: string; status: string
  stripe_subscription_id: string | null; seat_quantity: number
  granted_by_subscription_id: string | null; current_period_end: string | null
  expired_at: string | null; data_deletion_scheduled_at: string | null
}

async function hentRad(userId: string): Promise<SubRow | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('id, user_id, tier, status, stripe_subscription_id, seat_quantity, granted_by_subscription_id, current_period_end, expired_at, data_deletion_scheduled_at')
    .eq('user_id', userId)
    .maybeSingle()
  return data as SubRow | null
}

async function main() {
  console.log('Oppretter testbrukere…')
  const stamp = Date.now()
  const { data: trenerRes, error: e1 } = await supabase.auth.admin.createUser({
    email: `setemodell-e2e-trener-${stamp}@test.x-pulse.no`,
    password: `E2e-test-${stamp}!`,
    email_confirm: true,
  })
  const { data: utoverRes, error: e2 } = await supabase.auth.admin.createUser({
    email: `setemodell-e2e-utover-${stamp}@test.x-pulse.no`,
    password: `E2e-test-${stamp}!`,
    email_confirm: true,
  })
  if (e1 || e2 || !trenerRes?.user || !utoverRes?.user) {
    console.error('Kunne ikke opprette testbrukere:', e1?.message, e2?.message)
    process.exit(1)
  }
  const trenerId = trenerRes.user.id
  const utoverId = utoverRes.user.id
  console.log(`  trener ${trenerId}\n  utøver ${utoverId}`)

  let customerId = ''
  let sub1 = ''
  let sub2 = ''
  try {
    console.log('\nGRUNNLAG — Trener Pro-abonnement via Stripe → webhook → DB')
    const customer = await stripe.customers.create({
      email: `setemodell-e2e-trener-${stamp}@test.x-pulse.no`,
      metadata: { supabase_user_id: trenerId, xp_test: 'setemodell-e2e' },
    })
    customerId = customer.id
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId })
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } })
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: PRICE_TRENER_PRO }],
      metadata: { tier: 'trener_pro', supabase_user_id: trenerId },
    })
    sub1 = sub.id

    let trenerRad = await poll(() => hentRad(trenerId), r => r?.status === 'active')
    ok('webhook skrev trener-raden', !!trenerRad, trenerRad ? `${trenerRad.tier}/${trenerRad.status}` : 'ingen rad')
    ok('tier trener_pro + seat_quantity 0', trenerRad?.tier === 'trener_pro' && trenerRad?.seat_quantity === 0,
      `${trenerRad?.tier}, seats=${trenerRad?.seat_quantity}`)
    ok('current_period_end satt', !!trenerRad?.current_period_end, trenerRad?.current_period_end ?? 'null')
    if (!trenerRad) throw new Error('ingen trener-rad — stopper')

    console.log('\nSCENARIO A (DB-delen) — 2 plasser → seat_quantity speiles via webhook')
    await stripe.subscriptions.update(sub1, {
      items: [{ price: PRICE_SEAT, quantity: 2 }],
      proration_behavior: 'create_prorations',
    })
    trenerRad = await poll(() => hentRad(trenerId), r => r?.seat_quantity === 2)
    ok('seat_quantity = 2 i DB', trenerRad?.seat_quantity === 2, String(trenerRad?.seat_quantity))
    ok('tier fortsatt trener_pro (to linjer)', trenerRad?.tier === 'trener_pro', trenerRad?.tier)

    console.log('\nGRANTED-RAD — utøver på plass (som bolk 3 vil skrive den)')
    const { error: gErr } = await supabase.from('subscriptions').insert({
      user_id: utoverId,
      tier: 'athlete_pro',
      status: 'active',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      granted_by_subscription_id: trenerRad!.id,
      current_period_end: trenerRad!.current_period_end,
    })
    ok('granted-rad opprettet (service)', !gErr, gErr?.message)
    const grantedFersk = await hentRad(utoverId)
    ok('granted flyter gjennom hasActiveAccess (urørt funksjon)',
      hasActiveAccess(grantedFersk as unknown as ActiveSubscription) === true)

    console.log('\nSCENARIO G — fail-closed')
    // 1) Synk: sett granted-datoen FEIL (i går), trigg subscription.updated.
    const igar = new Date(Date.now() - 86400_000).toISOString()
    await supabase.from('subscriptions').update({ current_period_end: igar }).eq('user_id', utoverId)
    await stripe.subscriptions.update(sub1, { metadata: { touch: String(stamp) } })
    const grantedSynket = await poll(() => hentRad(utoverId),
      r => r?.current_period_end === trenerRad!.current_period_end)
    ok('granted current_period_end synkes til trenerens periodeslutt',
      grantedSynket?.current_period_end === trenerRad!.current_period_end,
      `${grantedSynket?.current_period_end}`)
    // 2) Webhook død + periode utløpt → tilgangen dør av datoen alene.
    const utlopt = { ...grantedSynket!, current_period_end: igar, trial_end: null, cancel_at_period_end: false }
    ok('utløpt granted-dato = INGEN tilgang uten webhook (fail-closed)',
      hasActiveAccess(utlopt as unknown as ActiveSubscription) === false)

    console.log('\nSCENARIO E — trener sier opp → kaskade')
    await stripe.subscriptions.cancel(sub1)
    const trenerEtter = await poll(() => hentRad(trenerId), r => r?.status === 'canceled')
    ok('trener-raden canceled', trenerEtter?.status === 'canceled', trenerEtter?.status)
    const grantedEtter = await poll(() => hentRad(utoverId), r => r?.status === 'canceled')
    ok('granted-raden canceled av kaskaden', grantedEtter?.status === 'canceled', grantedEtter?.status)
    ok('granted fikk grace-felter (beholder bruker + data)',
      !!grantedEtter?.expired_at && !!grantedEtter?.data_deletion_scheduled_at,
      `expired=${grantedEtter?.expired_at?.slice(0, 10)}, sletting=${grantedEtter?.data_deletion_scheduled_at?.slice(0, 10)}`)

    console.log('\nUPSERT-VERNET — nytt abonnement erstatter raden, sene events preller av')
    const nySub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: PRICE_TRENER_PRO }],
      metadata: { tier: 'trener_pro', supabase_user_id: trenerId },
    })
    sub2 = nySub.id
    const radNy = await poll(() => hentRad(trenerId),
      r => r?.stripe_subscription_id === sub2 && r?.status === 'active')
    ok('raden peker på nytt abonnement, active — ingen unique-krasj',
      radNy?.stripe_subscription_id === sub2 && radNy?.status === 'active',
      `${radNy?.stripe_subscription_id?.slice(0, 14)}…/${radNy?.status}`)

    // Sene events: resend deleted-eventet for GAMLE sub1 via Stripe CLI.
    const events = await stripe.events.list({ type: 'customer.subscription.deleted', limit: 20 })
    const gammeltDeleted = events.data.find(e => (e.data.object as Stripe.Subscription).id === sub1)
    if (gammeltDeleted) {
      execFileSync('stripe', ['events', 'resend', gammeltDeleted.id, '--api-key', KEY], { stdio: 'ignore' })
      await new Promise(r => setTimeout(r, 5000))
      const radEtterResend = await hentRad(trenerId)
      ok('resend av gammelt deleted-event klår ikke på raden',
        radEtterResend?.status === 'active' && radEtterResend?.stripe_subscription_id === sub2,
        `${radEtterResend?.status}, sub=${radEtterResend?.stripe_subscription_id?.slice(0, 14)}…`)
    } else {
      ok('fant deleted-eventet for resend-testen', false)
    }
  } finally {
    console.log('\nRydder opp…')
    try { if (sub2) await stripe.subscriptions.cancel(sub2) } catch { /* ok */ }
    try { if (customerId) await stripe.customers.del(customerId) } catch { /* ok */ }
    await supabase.from('subscriptions').delete().in('user_id', [trenerId, utoverId])
    await supabase.auth.admin.deleteUser(trenerId)
    await supabase.auth.admin.deleteUser(utoverId)
    const t = await hentRad(trenerId); const u = await hentRad(utoverId)
    console.log(`  subscriptions-rader igjen: trener=${t ? 'FINNES' : 'borte'}, utøver=${u ? 'FINNES' : 'borte'}`)
  }

  if (feil > 0) {
    console.error(`\n✗ ${feil} sjekk(er) feilet`)
    process.exit(1)
  }
  console.log('\n✓ alle webhook-E2E-scenarioer grønne (testmodus, mot ekte DB)')
}

main().catch(e => { console.error('UVENTET FEIL:', e); process.exit(1) })
