import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

// Stripe webhook-endpoint. Konfigurer i Stripe Dashboard:
//   URL: https://x-pulse.no/api/stripe/webhook
//   Events: checkout.session.completed, customer.subscription.updated,
//           customer.subscription.deleted, invoice.paid,
//           invoice.payment_failed, customer.subscription.trial_will_end
//
// Signing secret kopieres til STRIPE_WEBHOOK_SECRET i Netlify env.
//
// Idempotent via processed_stripe_events-tabellen (phase71). Stripe gjenoppretter
// ved nettverksfeil og kan sende samme event flere ganger — vi sjekker event.id
// før vi prosesserer.

export const runtime = 'nodejs' // raw-body krever Node-runtime, ikke edge

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function tierFromPriceId(priceId: string | null | undefined): 'athlete_pro' | 'trener_basic' | 'trener_pro' | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_ATHLETE_PRO) return 'athlete_pro'
  if (priceId === process.env.STRIPE_PRICE_TRENER_BASIC) return 'trener_basic'
  if (priceId === process.env.STRIPE_PRICE_TRENER_PRO) return 'trener_pro'
  return null
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Mangler signatur' }, { status: 400 })

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET mangler i env')
    return NextResponse.json({ error: 'Webhook ikke konfigurert' }, { status: 500 })
  }

  // Raw body for signaturvalidering. NextRequest har .text() som returnerer
  // exact request body — riktig for Stripe HMAC-sammenligning.
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[stripe-webhook] signaturvalidering feilet:', msg)
    return NextResponse.json({ error: `Ugyldig signatur: ${msg}` }, { status: 400 })
  }

  const supabase = getServiceSupabase()

  // Idempotens — hopp over hvis event allerede behandlet.
  const { data: seen } = await supabase
    .from('processed_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle()
  if (seen) {
    return NextResponse.json({ ok: true, deduped: true, event_id: event.id })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription)
        break
      case 'invoice.paid':
        // Forlenging av current_period_end er dekket av subscription.updated
        // som Stripe sender umiddelbart etter. Logger kun her.
        console.log(`[stripe-webhook] invoice.paid: ${(event.data.object as Stripe.Invoice).id}`)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.trial_will_end':
        // 3 dager før trial slutt. Resend-integrasjon kan kobles på her senere.
        console.log(`[stripe-webhook] trial_will_end for subscription: ${(event.data.object as Stripe.Subscription).id}`)
        break
      default:
        console.log(`[stripe-webhook] uhåndtert event-type: ${event.type}`)
    }

    // Marker som behandlet (etter suksess, så feilede prosesseringer kan retries
    // ved at Stripe sender event på nytt).
    await supabase.from('processed_stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
    })

    return NextResponse.json({ ok: true, event_id: event.id, type: event.type })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[stripe-webhook] ${event.type} feilet:`, msg)
    // 500 → Stripe prøver igjen automatisk (eksponentiell backoff over 3 dager).
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── Event-handlers ─────────────────────────────────────────

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof getServiceSupabase>,
  session: Stripe.Checkout.Session,
) {
  if (session.mode !== 'subscription' || !session.subscription) return

  const supabaseUserId = (session.metadata?.supabase_user_id as string | undefined) ?? null
  if (!supabaseUserId) {
    console.warn(`[stripe-webhook] checkout.completed mangler supabase_user_id i metadata: ${session.id}`)
    return
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription : session.subscription.id
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  await upsertSubscription(supabase, sub, supabaseUserId)
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof getServiceSupabase>,
  sub: Stripe.Subscription,
) {
  const supabaseUserId = (sub.metadata?.supabase_user_id as string | undefined) ?? null
  if (!supabaseUserId) {
    // Fallback: prøv å finne via stripe_customer_id på subscriptions-tabellen.
    const { data: row } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', typeof sub.customer === 'string' ? sub.customer : sub.customer.id)
      .maybeSingle()
    if (!row?.user_id) {
      console.warn(`[stripe-webhook] subscription.updated kan ikke knyttes til user: ${sub.id}`)
      return
    }
    await upsertSubscription(supabase, sub, row.user_id)
    return
  }
  await upsertSubscription(supabase, sub, supabaseUserId)
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof getServiceSupabase>,
  sub: Stripe.Subscription,
) {
  await supabase
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', sub.id)
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof getServiceSupabase>,
  invoice: Stripe.Invoice,
) {
  // Hent subscription-id fra invoice. invoice.subscription er payment_intent ID
  // i nyere API-versjoner — fallback til parent.subscription_details.
  const subId = typeof (invoice as unknown as { subscription?: string | { id: string } }).subscription === 'string'
    ? (invoice as unknown as { subscription: string }).subscription
    : (invoice as unknown as { subscription?: { id: string } }).subscription?.id
  if (!subId) return
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subId)
}

// Upsert subscription med data fra Stripe. Brukes av både checkout.completed
// og subscription.updated/created. Bruker stripe_subscription_id som unique-key.
async function upsertSubscription(
  supabase: ReturnType<typeof getServiceSupabase>,
  sub: Stripe.Subscription,
  userId: string,
) {
  const priceId = sub.items.data[0]?.price.id ?? null
  const tier = tierFromPriceId(priceId)
  if (!tier) {
    console.warn(`[stripe-webhook] ukjent priceId "${priceId}" for sub ${sub.id} — hopper over`)
    return
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  // Stripe.Subscription har current_period_end + trial_end som unix-timestamp.
  // Cast via unknown for å unngå type-mismatch på tvers av API-versjoner.
  const subRaw = sub as unknown as {
    current_period_end?: number
    trial_end?: number | null
    cancel_at_period_end?: boolean
  }
  const periodEnd = subRaw.current_period_end
    ? new Date(subRaw.current_period_end * 1000).toISOString() : null
  const trialEnd = subRaw.trial_end
    ? new Date(subRaw.trial_end * 1000).toISOString() : null

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      tier,
      status: sub.status,
      current_period_end: periodEnd,
      trial_end: trialEnd,
      cancel_at_period_end: subRaw.cancel_at_period_end ?? false,
    }, { onConflict: 'stripe_subscription_id' })

  if (error) throw new Error(`subscriptions-upsert: ${error.message}`)
}
