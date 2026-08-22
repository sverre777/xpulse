// BACKFILL: subscriptions.current_period_end fra Stripe (ren datajobb).
//
// Bakgrunn: 2026-API-et flyttet current_period_end til item-nivået, så
// webhooken har skrevet NULL for alle rader. hasActiveAccess gir tilgang ved
// NULL (mild default) — ingen brukere er rammet — men fail-closed-premisset
// i setemodellen krever at datoen faktisk står der.
//
// Gjør: for hver rad MED stripe_subscription_id hentes abonnementet fra
// Stripe (LIVE, READ-ONLY — scriptet kaller kun subscriptions.retrieve) og
// current_period_end skrives via SAMME helper som webhooken bruker
// (periodEndFromStripeSub — item-nivå m/ toppnivå-fallback, aldri en kopi).
//
// Rører IKKE: rader uten stripe_subscription_id (granted/manuelle), status,
// eller noe annet felt. Idempotent — rader der datoen allerede stemmer
// hoppes over.
//
// Krever i .env.local: STRIPE_LIVE_SECRET_KEY (sk_live_… — eller enda bedre:
// en restricted key rk_live_… med kun Subscriptions:Read).
// Kjør: npx tsx scripts/backfill-period-end.ts        (skriver)
//       npx tsx scripts/backfill-period-end.ts --dry  (kun rapport)

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { periodEndFromStripeSub } from '../lib/stripe'

for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const DRY = process.argv.includes('--dry')

const LIVE_KEY = process.env.STRIPE_LIVE_SECRET_KEY ?? ''
if (!LIVE_KEY.startsWith('sk_live_') && !LIVE_KEY.startsWith('rk_live_')) {
  console.error('AVBRUTT: STRIPE_LIVE_SECRET_KEY mangler i .env.local (sk_live_… eller restricted rk_live_… med Subscriptions:Read).')
  console.error('Backfillen leser LIVE-abonnementer — testnøkkelen kan ikke brukes.')
  process.exit(1)
}
const stripe = new Stripe(LIVE_KEY, { apiVersion: '2026-04-22.dahlia' })
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function main() {
  const { data: alle, error } = await service
    .from('subscriptions')
    .select('id, user_id, tier, status, stripe_subscription_id, current_period_end, granted_by_subscription_id')
  if (error || !alle) {
    console.error('Kunne ikke lese subscriptions:', error?.message)
    process.exit(1)
  }

  const medStripe = alle.filter(r => r.stripe_subscription_id)
  const utenStripe = alle.filter(r => !r.stripe_subscription_id)
  const nullFor = alle.filter(r => r.current_period_end === null).length

  console.log(`FØR: ${alle.length} rader totalt · ${nullFor} med current_period_end = NULL`)
  console.log(`     ${medStripe.length} med stripe_subscription_id (behandles) · ${utenStripe.length} uten (granted/manuelle — røres ikke)`)
  if (DRY) console.log('     [--dry: ingenting skrives]')

  let fylt = 0
  let alleredeRiktig = 0
  const ikkeFylt: Array<{ id: string; grunn: string }> = []

  for (const rad of medStripe) {
    let nyDato: string | null = null
    try {
      // READ-ONLY mot Stripe: kun retrieve — scriptet har ingen andre Stripe-kall.
      const sub = await stripe.subscriptions.retrieve(rad.stripe_subscription_id!)
      nyDato = periodEndFromStripeSub(sub as unknown as Parameters<typeof periodEndFromStripeSub>[0])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      ikkeFylt.push({ id: rad.id, grunn: `Stripe: ${msg}` })
      continue
    }
    if (!nyDato) {
      ikkeFylt.push({ id: rad.id, grunn: 'Stripe-abonnementet har ingen periodeslutt (verken toppnivå eller items)' })
      continue
    }
    if (rad.current_period_end && new Date(rad.current_period_end).getTime() === new Date(nyDato).getTime()) {
      alleredeRiktig++
      continue
    }
    if (!DRY) {
      // KUN datoen — ingen status- eller andre feltendringer.
      const { error: updErr } = await service
        .from('subscriptions')
        .update({ current_period_end: nyDato })
        .eq('id', rad.id)
      if (updErr) {
        ikkeFylt.push({ id: rad.id, grunn: `DB: ${updErr.message}` })
        continue
      }
    }
    fylt++
    console.log(`  ${DRY ? '(dry) ' : ''}${rad.tier}/${rad.status} ${rad.id.slice(0, 8)}… → ${nyDato}`)
  }

  const { data: etter } = await service
    .from('subscriptions')
    .select('id, current_period_end')
  const nullEtter = (etter ?? []).filter(r => r.current_period_end === null).length

  console.log(`\nETTER: ${fylt} fylt${alleredeRiktig ? ` · ${alleredeRiktig} sto allerede riktig` : ''} · ${ikkeFylt.length} kunne ikke fylles · ${utenStripe.length} urørt (uten stripe-id)`)
  console.log(`       current_period_end = NULL: ${nullFor} → ${nullEtter}`)
  for (const x of ikkeFylt) console.log(`  IKKE FYLT ${x.id.slice(0, 8)}…: ${x.grunn}`)
}

main().catch(e => { console.error('UVENTET FEIL:', e); process.exit(1) })
