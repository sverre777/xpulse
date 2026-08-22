// SETEMODELLEN — Stripe-side testscenarioer i TESTMODUS (bolk 2).
// Kjører mot ekte Stripe test-API med nøkkelen i .env.local og rapporterer
// FAKTISK utfall. Lager egne fixtures (kunde + abonnement) og rydder opp.
//
// Dekker Stripe-halvdelen av scenarioene:
//   A  — trener kjøper 2 ekstra plasser → quantity 2 + prorert faktura
//   A2 — endrer antall → proratering begge veier, fjerner linjen ved 0
//   E  — oppsigelse: cancel_at_period_end holder status active (beholder ut
//        perioden), full kansellering gir deleted-event
//   +  — tier-deteksjon med to linjer (items-rekkefølgen er IKKE garantert)
//
// DB-kaskadene (granted canceled, fail-closed-synk) testes E2E via webhook
// når SUPABASE_SERVICE_ROLE_KEY er på plass lokalt — se bolk 2-rapporten.
//
// Kjør: npx tsx scripts/setemodell-stripe-test.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Stripe from 'stripe'

// Last .env.local manuelt (ingen dotenv-avhengighet).
for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const KEY = process.env.STRIPE_SECRET_KEY ?? ''
if (!KEY.startsWith('sk_test_')) {
  console.error('AVBRUTT: STRIPE_SECRET_KEY er ikke en sk_test-nøkkel — dette skriptet kjører KUN i testmodus.')
  process.exit(1)
}
const PRICE_TRENER_PRO = process.env.STRIPE_PRICE_TRENER_PRO!
const PRICE_SEAT = process.env.STRIPE_PRICE_UTOVERPLASS!

const stripe = new Stripe(KEY, { apiVersion: '2026-04-22.dahlia' })

// Samme parser som webhooken bruker (delt i lib/stripe.ts).
import { tierAndSeatsFromItems } from '../lib/stripe'

let feil = 0
function ok(navn: string, betingelse: boolean, faktisk?: string) {
  const suffix = faktisk ? `  [faktisk: ${faktisk}]` : ''
  if (betingelse) console.log(`  ok   ${navn}${suffix}`)
  else { feil++; console.error(`  FEIL ${navn}${suffix}`) }
}

async function main() {
  console.log('Oppretter fixtures i Stripe testmodus…')
  const customer = await stripe.customers.create({
    email: 'setemodell-test@x-pulse.no',
    name: 'Setemodell testtrener',
    metadata: { xp_test: 'setemodell' },
  })
  // Test-betalingsmetode så abonnementet faktisk faktureres (ingen trial —
  // proratering på en trial er alltid 0 og beviser ingenting).
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: pm.id },
  })

  let subId = ''
  try {
    console.log('\nSCENARIO-GRUNNLAG — Trener Pro-abonnement (279 kr/mnd, betalt)')
    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: PRICE_TRENER_PRO, quantity: 1 }],
      metadata: { tier: 'trener_pro', supabase_user_id: 'test-ikke-reell' },
      expand: ['latest_invoice'],
    })
    subId = sub.id
    const inv0 = sub.latest_invoice as Stripe.Invoice
    ok('abonnement aktivt', sub.status === 'active', sub.status)
    ok('første faktura betalt 279 kr', inv0.status === 'paid' && inv0.amount_paid === 27900,
      `${inv0.status}, ${inv0.amount_paid / 100} kr`)

    console.log('\nSCENARIO A — kjøper 2 ekstra utøverplasser')
    const seatAdd = await stripe.subscriptions.update(subId, {
      items: [{ price: PRICE_SEAT, quantity: 2 }],
      proration_behavior: 'create_prorations',
    })
    const seatItem = seatAdd.items.data.find(i => i.price?.id === PRICE_SEAT)
    ok('Utøverplass-linje finnes m/ quantity 2', seatItem?.quantity === 2, String(seatItem?.quantity))
    ok('abonnementet har to linjer', seatAdd.items.data.length === 2, String(seatAdd.items.data.length))

    // Proratering: forhåndsvis neste faktura — proration-linjer for plassene.
    // I 2026-API-et flagges proration i line.parent.subscription_item_details,
    // ikke i det gamle toppnivå-feltet (verifisert mot faktisk respons).
    const erProration = (l: Stripe.InvoiceLineItem) =>
      (l as unknown as { parent?: { subscription_item_details?: { proration?: boolean } } })
        .parent?.subscription_item_details?.proration === true
    const preview = await stripe.invoices.createPreview({ subscription: subId })
    const prorations = preview.lines.data.filter(erProration)
    const prorationSum = prorations.reduce((s, l) => s + l.amount, 0)
    ok('prorerte linjer på neste faktura', prorations.length > 0,
      `${prorations.length} linjer, sum ${prorationSum / 100} kr`)
    ok('proratering er positiv (resten av perioden for 2 plasser)', prorationSum > 0 && prorationSum <= 5800,
      `${prorationSum / 100} kr (full mnd = 58)`)

    console.log('\nTIER-DETEKSJON — to linjer, rekkefølgen er ikke garantert')
    const hentet = await stripe.subscriptions.retrieve(subId)
    const forsteLinje = hentet.items.data[0]?.price?.id
    console.log(`  info items.data[0] er: ${forsteLinje === PRICE_SEAT ? 'UTØVERPLASS (gammel kode ville feilet!)' : 'tier-prisen'}`)
    const parsed = tierAndSeatsFromItems(hentet.items.data)
    ok('tierAndSeatsFromItems finner trener_pro', parsed.tier === 'trener_pro', String(parsed.tier))
    ok('…og 2 plasser', parsed.seatQuantity === 2, String(parsed.seatQuantity))

    console.log('\nSCENARIO A2 — endrer antall 2 → 1 (proratering ned) og → 0 (linjen fjernes)')
    const ned = await stripe.subscriptions.update(subId, {
      items: [{ id: seatItem!.id, quantity: 1 }],
      proration_behavior: 'create_prorations',
    })
    ok('quantity er 1', ned.items.data.find(i => i.price?.id === PRICE_SEAT)?.quantity === 1)
    const preview2 = await stripe.invoices.createPreview({ subscription: subId })
    const kredit = preview2.lines.data.filter(l => erProration(l) && l.amount < 0)
    ok('nedjustering ga kredit-proratering', kredit.length > 0,
      `${kredit.length} kreditlinjer, ${kredit.reduce((s, l) => s + l.amount, 0) / 100} kr`)

    const fjernet = await stripe.subscriptions.update(subId, {
      items: [{ id: seatItem!.id, deleted: true }],
      proration_behavior: 'create_prorations',
    })
    ok('quantity 0 = linjen er borte, tier-linjen står', fjernet.items.data.length === 1
      && fjernet.items.data[0].price?.id === PRICE_TRENER_PRO)
    const parsed0 = tierAndSeatsFromItems(fjernet.items.data)
    ok('parseren gir 0 plasser uten linje', parsed0.seatQuantity === 0 && parsed0.tier === 'trener_pro')

    console.log('\nSCENARIO E (Stripe-delen) — oppsigelse')
    const oppsagt = await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
    ok('cancel_at_period_end=true holder status ACTIVE (beholder ut perioden)',
      oppsagt.status === 'active' && oppsagt.cancel_at_period_end === true,
      `status=${oppsagt.status}, cap=${oppsagt.cancel_at_period_end}`)

    const kansellert = await stripe.subscriptions.cancel(subId)
    ok('full kansellering → status canceled umiddelbart', kansellert.status === 'canceled', kansellert.status)

    // Verifiser at deleted-eventet faktisk ble generert i Stripe.
    await new Promise(r => setTimeout(r, 2000))
    const events = await stripe.events.list({ type: 'customer.subscription.deleted', limit: 10 })
    const vartEvent = events.data.find(e => (e.data.object as Stripe.Subscription).id === subId)
    ok('customer.subscription.deleted-event generert', !!vartEvent, vartEvent?.id)
  } finally {
    console.log('\nRydder opp fixtures…')
    try { if (subId) await stripe.subscriptions.cancel(subId) } catch { /* allerede kansellert */ }
    try { await stripe.customers.del(customer.id) } catch (e) { console.warn('  kunne ikke slette kunde:', e) }
  }

  if (feil > 0) {
    console.error(`\n✗ ${feil} sjekk(er) feilet`)
    process.exit(1)
  }
  console.log('\n✓ alle Stripe-side scenarioer grønne (testmodus)')
}

main().catch(e => { console.error('UVENTET FEIL:', e); process.exit(1) })
