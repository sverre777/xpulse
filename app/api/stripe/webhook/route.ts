import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { stripe, tierAndSeatsFromItems } from '@/lib/stripe'

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

// tier + antall utøverplasser leses fra ALLE abonnementslinjene —
// delt funksjon i lib/stripe.ts (enhetstestet i setemodell-selvtesten).

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
  // Phase 72 grace-period: marker expired_at + planlegg datasletting om 90d.
  const now = new Date()
  const deletionDate = new Date(now.getTime() + 90 * 86400_000).toISOString()

  // Hent rad-id FØR oppdatering — trengs for setemodell-kaskaden under.
  const { data: row } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      expired_at: now.toISOString(),
      data_deletion_scheduled_at: deletionDate,
    })
    .eq('stripe_subscription_id', sub.id)

  // Setemodell-kaskaden: alle plasser tildelt fra dette abonnementet dør.
  // subscription.deleted kommer ved PERIODESLUTT ved vanlig oppsigelse
  // (cancel_at_period_end) — «beholder ut perioden» er dermed allerede
  // levert via active-status + fail-closed current_period_end frem til nå.
  // Utøverne beholder bruker + data (samme grace-felter som egen oppsigelse).
  if (row?.id) {
    await cascadeCancelGranted(supabase, row.id, now.toISOString(), deletionDate)
  }
}

// Setter alle granted-rader (plasser tildelt fra coachSubRowId) til canceled
// m/ phase72-grace. Brukes av deleted-kaskaden og tier-nedgradering. Rører
// ALDRI utvalget av hvem — webhooken velger aldri offer (bolk 4-sperren eier
// nedgradering av antall).
async function cascadeCancelGranted(
  supabase: ReturnType<typeof getServiceSupabase>,
  coachSubRowId: string,
  expiredAtIso: string,
  deletionIso: string,
) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      expired_at: expiredAtIso,
      data_deletion_scheduled_at: deletionIso,
    })
    .eq('granted_by_subscription_id', coachSubRowId)
    .in('status', ['active', 'trialing'])
  if (error) throw new Error(`granted-kaskade: ${error.message}`)
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
// og subscription.updated/created.
//
// Setemodell-omskrivning (bolk 2):
// - Tier + antall kjøpte utøverplasser leses fra ALLE items (to linjer mulig).
// - Konflikt-nøkkel er user_id (unik indeks — én rad per bruker er hard
//   invariant): et NYTT Stripe-abonnement for en bruker med eksisterende rad
//   (f.eks. «fortsett selv for 59 kr» etter granted-utløp, eller re-tegning
//   etter oppsigelse) skal ERSTATTE raden, ikke krasje mot unique(user_id).
// - Sene/out-of-order events for et ANNET abonnement enn radens: en døende
//   hendelse (canceled/incomplete/expired) får aldri klå på en rad som
//   allerede eies av et nyere abonnement.
// - En Stripe-eid rad er aldri granted: granted_by settes eksplisitt null
//   (tar over etter plass — plassen ryddes når brukeren betaler selv).
async function upsertSubscription(
  supabase: ReturnType<typeof getServiceSupabase>,
  sub: Stripe.Subscription,
  userId: string,
) {
  const { tier, seatQuantity } = tierAndSeatsFromItems(sub.items.data)
  if (!tier) {
    console.warn(`[stripe-webhook] ingen kjent tier-price blant items for sub ${sub.id} — hopper over`)
    return
  }

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id, tier, status, stripe_subscription_id, granted_by_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()

  const LEVENDE = new Set(['active', 'trialing', 'past_due'])
  if (
    existing?.stripe_subscription_id &&
    existing.stripe_subscription_id !== sub.id &&
    !LEVENDE.has(sub.status)
  ) {
    console.warn(`[stripe-webhook] ignorerer ${sub.status}-event for gammelt abonnement ${sub.id} (raden eies av ${existing.stripe_subscription_id})`)
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

  // Reactivation: hvis status går fra canceled/past_due tilbake til active/trialing,
  // nullstill grace-period-felter så brukeren får full tilgang igjen.
  const clearGrace = sub.status === 'active' || sub.status === 'trialing'

  const { data: upserted, error } = await supabase
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
      seat_quantity: seatQuantity,
      granted_by_subscription_id: null,
      ...(clearGrace ? { expired_at: null, data_deletion_scheduled_at: null } : {}),
    }, { onConflict: 'user_id' })
    .select('id')
    .maybeSingle()

  if (error) throw new Error(`subscriptions-upsert: ${error.message}`)

  // ── Setemodell-vedlikehold for trener-rader ────────────────
  const rowId = upserted?.id ?? existing?.id ?? null
  if (!rowId) return

  // a) FAIL-CLOSED: plassene lever aldri lenger enn trenerens betalte periode.
  //    Synkes ved hver fornyelse (invoice.paid → subscription.updated) — dør
  //    webhooken senere, dør plassene av seg selv ved periodeslutt.
  if ((tier === 'trener_basic' || tier === 'trener_pro') && periodEnd && LEVENDE.has(sub.status)) {
    const { error: syncErr } = await supabase
      .from('subscriptions')
      .update({ current_period_end: periodEnd })
      .eq('granted_by_subscription_id', rowId)
      .in('status', ['active', 'trialing'])
    if (syncErr) throw new Error(`fail-closed-synk: ${syncErr.message}`)
  }

  // b) TIER-NEDGRADERING → kaskade: plasser tildelt fra abonnementet dør.
  //    (Nedgradering av ANTALL plasser går ALDRI her — den er sperret
  //    server-side i setSeatQuantity, og webhooken velger aldri offer.)
  const varTrener = existing?.tier === 'trener_basic' || existing?.tier === 'trener_pro'
  const nedgradert = varTrener && existing!.tier !== tier &&
    (tier === 'athlete_pro' || (existing!.tier === 'trener_pro' && tier === 'trener_basic'))
  if (nedgradert) {
    const now = new Date()
    await cascadeCancelGranted(
      supabase, rowId, now.toISOString(),
      new Date(now.getTime() + 90 * 86400_000).toISOString(),
    )
  }
}
