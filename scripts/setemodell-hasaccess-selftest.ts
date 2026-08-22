// Selvtest for DEN ENE tillatte hasActiveAccess-endringen (setemodellen):
// granted-rad + NULL current_period_end = INGEN tilgang (fail-closed),
// Stripe-eide rader beholder dagens milde NULL-default. Alt annet urørt.
// Kjør: npx tsx scripts/setemodell-hasaccess-selftest.ts

import { hasActiveAccess, type ActiveSubscription } from '../lib/subscriptions'

let feil = 0
function ok(navn: string, betingelse: boolean) {
  if (betingelse) console.log(`  ok   ${navn}`)
  else { feil++; console.error(`  FEIL ${navn}`) }
}

const base: ActiveSubscription = {
  tier: 'athlete_pro', status: 'active',
  current_period_end: null, trial_end: null, cancel_at_period_end: false,
  stripe_customer_id: 'cus_x', stripe_subscription_id: 'sub_x',
  granted_by_subscription_id: null,
}
const omEnMnd = new Date(Date.now() + 30 * 86400_000).toISOString()
const igar = new Date(Date.now() - 86400_000).toISOString()

console.log('FAIL-CLOSED FOR GRANTED')
ok('granted + NULL dato → INGEN tilgang (fail-closed)',
  hasActiveAccess({ ...base, stripe_subscription_id: null, granted_by_subscription_id: 'rad-id' }) === false)
ok('granted + fremtidig dato → tilgang',
  hasActiveAccess({ ...base, stripe_subscription_id: null, granted_by_subscription_id: 'rad-id', current_period_end: omEnMnd }) === true)
ok('granted + passert dato → ingen tilgang (som før)',
  hasActiveAccess({ ...base, stripe_subscription_id: null, granted_by_subscription_id: 'rad-id', current_period_end: igar }) === false)

console.log('\nSTRIPE-RADER — dagens oppførsel UENDRET')
ok('Stripe-rad + NULL dato → tilgang (mild default beholdt)',
  hasActiveAccess(base) === true)
ok('Stripe-rad + fremtidig dato → tilgang',
  hasActiveAccess({ ...base, current_period_end: omEnMnd }) === true)
ok('Stripe-rad + passert dato → ingen tilgang',
  hasActiveAccess({ ...base, current_period_end: igar }) === false)
ok('canceled → ingen tilgang uansett dato',
  hasActiveAccess({ ...base, status: 'canceled', current_period_end: omEnMnd }) === false)
ok('trialing + fremtidig trial_end → tilgang',
  hasActiveAccess({ ...base, status: 'trialing', trial_end: omEnMnd }) === true)
ok('trialing + NULL trial_end → tilgang (mild default beholdt)',
  hasActiveAccess({ ...base, status: 'trialing' }) === true)
ok('objekt uten feltet (eldre call-sites) → som Stripe-rad',
  hasActiveAccess({ ...base, granted_by_subscription_id: undefined }) === true)
ok('null → false', hasActiveAccess(null) === false)

if (feil > 0) { console.error(`\n✗ ${feil} feilet`); process.exit(1) }
console.log('\n✓ alle tester grønne')
