// SETEMODELLEN — invitasjonsflyt-E2E i TESTMODUS (bolk 3).
// Kjører kjernen i lib/seat-claim.ts (samme kode som server-actionene) mot
// ekte Stripe test-API + ekte Supabase, med webhook-forwarding i bakgrunnen.
// Rapporterer FAKTISK utfall. Fixtures ryddes.
//
//   B — ny utøver via lenka → bruker + kobling + granted-rad i samme operasjon
//   H — full lenke (teller 0) → ærlig avvisning, ingen bruker opprettes
//   F — selvbetalende løser inn plass → eget abo cancel_at_period_end,
//       raden konverteres (ÉN rad), webhook-eventet gjenoppliver den ikke
//   C — frigjøring → teller +1 UMIDDELBART, utøveren beholder ut perioden,
//       «fortsett selv»-tilstanden slår inn når datoen passeres
//   + — regenerering: gammel lenke dør, ny virker
//
// Forutsetter: npm run dev + stripe listen kjører (som webhook-E2E-en).
// Kjør: npx tsx scripts/setemodell-invite-e2e.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { hasActiveAccess, type ActiveSubscription } from '../lib/subscriptions'
import {
  getOrCreateInviteCore,
  regenerateInviteCore,
  resolveInviteCore,
  previewClaimCore,
  claimSeatCore,
  claimAsNewUserCore,
  releaseSeatCore,
  seatContextForCoach,
} from '../lib/seat-claim'

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
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

let feil = 0
function ok(navn: string, betingelse: boolean, faktisk?: string) {
  const suffix = faktisk ? `  [faktisk: ${faktisk}]` : ''
  if (betingelse) console.log(`  ok   ${navn}${suffix}`)
  else { feil++; console.error(`  FEIL ${navn}${suffix}`) }
}

async function poll<T>(hent: () => Promise<T>, sjekk: (v: T) => boolean, timeoutMs = 20000): Promise<T> {
  const start = Date.now()
  for (;;) {
    const v = await hent()
    if (sjekk(v)) return v
    if (Date.now() - start > timeoutMs) return v
    await new Promise(r => setTimeout(r, 700))
  }
}

async function hentRad(userId: string) {
  const { data } = await service
    .from('subscriptions')
    .select('id, tier, status, stripe_subscription_id, granted_by_subscription_id, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

async function lagBruker(navn: string, epost: string) {
  const { data, error } = await service.auth.admin.createUser({
    email: epost, password: 'E2e-test-passord-1!', email_confirm: true,
    user_metadata: { full_name: navn },
  })
  if (error || !data?.user) throw new Error(`bruker: ${error?.message}`)
  await service.from('profiles').update({ full_name: navn }).eq('id', data.user.id)
  return data.user.id
}

async function lagStripeAbo(userId: string, epost: string, price: string) {
  const c = await stripe.customers.create({ email: epost, metadata: { supabase_user_id: userId, xp_test: 'setemodell-e2e' } })
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: c.id })
  await stripe.customers.update(c.id, { invoice_settings: { default_payment_method: pm.id } })
  const s = await stripe.subscriptions.create({
    customer: c.id, items: [{ price }],
    metadata: { supabase_user_id: userId },
  })
  return { customerId: c.id, subId: s.id }
}

async function main() {
  const stamp = Date.now()
  const opprettedeBrukere: string[] = []
  const stripeKunder: string[] = []
  const stripeSubs: string[] = []

  try {
    console.log('OPPSETT — Pro-trener m/ betalt abonnement (via webhook)')
    const trenerId = await lagBruker('E2E Pro-trener', `sete-inv-trener-${stamp}@test.x-pulse.no`)
    opprettedeBrukere.push(trenerId)
    const t = await lagStripeAbo(trenerId, `sete-inv-trener-${stamp}@test.x-pulse.no`, process.env.STRIPE_PRICE_TRENER_PRO!)
    stripeKunder.push(t.customerId); stripeSubs.push(t.subId)
    const trenerRad = await poll(() => hentRad(trenerId), r => r?.status === 'active')
    ok('trener-rad på plass (webhook)', trenerRad?.tier === 'trener_pro', `${trenerRad?.tier}/${trenerRad?.status}`)

    console.log('\nLENKA — én aktiv, regenerering dreper den gamle')
    const l1 = await getOrCreateInviteCore(service, trenerId)
    if ('error' in l1) throw new Error(l1.error)
    const l1igjen = await getOrCreateInviteCore(service, trenerId)
    ok('samme lenke ved gjentatt henting', !('error' in l1igjen) && l1igjen.token === l1.token)
    const l2 = await regenerateInviteCore(service, trenerId)
    if ('error' in l2) throw new Error(l2.error)
    const gammelDod = await resolveInviteCore(service, l1.token)
    ok('gammel lenke virker ikke etter regenerering', 'error' in gammelDod)
    const nyVirker = await resolveInviteCore(service, l2.token)
    ok('ny lenke virker, 5 ledige (Pro, 0 kjøpt)', !('error' in nyVirker) && nyVirker.available === 5,
      'error' in nyVirker ? nyVirker.error : String(nyVirker.available))
    const token = l2.token

    console.log('\nSCENARIO B — ny utøver via lenka (én operasjon)')
    const bEpost = `sete-inv-ny-${stamp}@test.x-pulse.no`
    const b = await claimAsNewUserCore(service, stripe, {
      token, name: 'E2E Ny Utøver', email: bEpost, password: 'Minst8Tegn!',
    })
    ok('claim ok', !('error' in b), 'error' in b ? b.error : 'ok')
    if ('error' in b) throw new Error('B feilet — stopper')
    opprettedeBrukere.push(b.userId)
    const { data: rel } = await service.from('coach_athlete_relations')
      .select('status').eq('coach_id', trenerId).eq('athlete_id', b.userId).maybeSingle()
    ok('kobling aktiv', rel?.status === 'active', rel?.status)
    const bRad = await hentRad(b.userId)
    ok('granted-rad: athlete_pro/active, stripe null, granted_by satt',
      bRad?.tier === 'athlete_pro' && bRad?.status === 'active'
      && bRad?.stripe_subscription_id === null && bRad?.granted_by_subscription_id === trenerRad!.id)
    ok('fail-closed-dato = trenerens periodeslutt', bRad?.current_period_end === trenerRad!.current_period_end)
    const ctxEtterB = await seatContextForCoach(service, trenerId)
    ok('teller: 1 i bruk, 4 ledige', !('error' in ctxEtterB) && ctxEtterB.teller.inUse === 1 && ctxEtterB.teller.available === 4,
      'error' in ctxEtterB ? ctxEtterB.error : `${ctxEtterB.teller.inUse} i bruk / ${ctxEtterB.teller.available} ledig`)

    console.log('\nSCENARIO H — full lenke (Basic-trener, 0 plasser)')
    const basicId = await lagBruker('E2E Basic-trener', `sete-inv-basic-${stamp}@test.x-pulse.no`)
    opprettedeBrukere.push(basicId)
    const bs = await lagStripeAbo(basicId, `sete-inv-basic-${stamp}@test.x-pulse.no`, process.env.STRIPE_PRICE_TRENER_BASIC!)
    stripeKunder.push(bs.customerId); stripeSubs.push(bs.subId)
    await poll(() => hentRad(basicId), r => r?.status === 'active')
    const basicLenke = await getOrCreateInviteCore(service, basicId)
    if ('error' in basicLenke) throw new Error(basicLenke.error)
    const hEpost = `sete-inv-avvist-${stamp}@test.x-pulse.no`
    const h = await claimAsNewUserCore(service, stripe, {
      token: basicLenke.token, name: 'Skal Avvises', email: hEpost, password: 'Minst8Tegn!',
    })
    ok('ærlig avvisning («alle plassene er i bruk»)',
      'error' in h && h.full === true, 'error' in h ? h.error : 'GIKK GJENNOM?!')
    const { data: hBrukere } = await service.auth.admin.listUsers({ page: 1, perPage: 200 })
    const hFinnes = hBrukere?.users.some(u => u.email === hEpost)
    ok('ingen bruker opprettet ved full lenke', !hFinnes)

    console.log('\nSCENARIO F — selvbetalende løser inn plass (kollisjonen)')
    const fEpost = `sete-inv-selvbet-${stamp}@test.x-pulse.no`
    const fId = await lagBruker('E2E Selvbetalende', fEpost)
    opprettedeBrukere.push(fId)
    const f = await lagStripeAbo(fId, fEpost, process.env.STRIPE_PRICE_ATHLETE_PRO!)
    stripeKunder.push(f.customerId); stripeSubs.push(f.subId)
    const fRadFor = await poll(() => hentRad(fId), r => r?.status === 'active')
    ok('selvbetalende rad på plass først', fRadFor?.stripe_subscription_id === f.subId)

    const preview = await previewClaimCore(service, token, fId)
    ok('forhåndsvisningen varsler selvbetalende', !('error' in preview) && preview.selvbetalende === true)

    const fClaim = await claimSeatCore(service, stripe, token, fId)
    ok('claim ok m/ kollisjon-flagg', !('error' in fClaim) && fClaim.kollisjon === true,
      'error' in fClaim ? fClaim.error : `kollisjon=${fClaim.kollisjon}`)
    const fRad = await hentRad(fId)
    ok('raden KONVERTERT: granted, stripe null, aktiv',
      fRad?.granted_by_subscription_id === trenerRad!.id && fRad?.stripe_subscription_id === null && fRad?.status === 'active')
    const { count: fAntall } = await service.from('subscriptions')
      .select('id', { count: 'exact', head: true }).eq('user_id', fId)
    ok('fortsatt ÉN rad (maybeSingle-invarianten)', fAntall === 1, String(fAntall))
    const fStripe = await stripe.subscriptions.retrieve(f.subId)
    ok('gammelt abo: cancel_at_period_end=true, status active (ingen refusjonsknot, ingen dobbelttrekk)',
      fStripe.cancel_at_period_end === true && fStripe.status === 'active',
      `cap=${fStripe.cancel_at_period_end}, ${fStripe.status}`)
    // Webhook-eventet (updated m/ cap=true) skal IKKE gjenopplive raden.
    await new Promise(r => setTimeout(r, 6000))
    const fRadEtterEvent = await hentRad(fId)
    ok('webhook-eventet gjenoppliver ikke raden (granted-vernet)',
      fRadEtterEvent?.granted_by_subscription_id === trenerRad!.id && fRadEtterEvent?.stripe_subscription_id === null,
      `granted_by=${fRadEtterEvent?.granted_by_subscription_id ? 'satt' : 'NULL'}, stripe=${fRadEtterEvent?.stripe_subscription_id ?? 'null'}`)

    console.log('\nSCENARIO C — frigjøring')
    const ctxFor = await seatContextForCoach(service, trenerId)
    const c = await releaseSeatCore(service, trenerId, b.userId)
    ok('frigjøring ok', !('error' in c))
    const ctxEtter = await seatContextForCoach(service, trenerId)
    ok('teller +1 UMIDDELBART', !('error' in ctxFor) && !('error' in ctxEtter)
      && ctxEtter.teller.available === ctxFor.teller.available + 1,
      `${'error' in ctxFor ? '?' : ctxFor.teller.available} → ${'error' in ctxEtter ? '?' : ctxEtter.teller.available}`)
    const cRad = await hentRad(b.userId)
    ok('utøveren beholder ut perioden (active + løper ut, dato står)',
      cRad?.status === 'active' && cRad?.cancel_at_period_end === true && !!cRad?.current_period_end)
    ok('tilgangen lever NÅ (hasActiveAccess)', hasActiveAccess(cRad as unknown as ActiveSubscription) === true)
    // «Fortsett selv»-tilstanden når datoen passeres:
    const utlopt = { ...cRad!, current_period_end: new Date(Date.now() - 60_000).toISOString() }
    ok('…og dør ved periodeslutt → «fortsett selv for 59 kr»-tilbudet slår inn',
      hasActiveAccess(utlopt as unknown as ActiveSubscription) === false)
    const cIdem = await releaseSeatCore(service, trenerId, b.userId)
    ok('frigjøring er idempotent', !('error' in cIdem))
  } finally {
    console.log('\nRydder opp…')
    for (const s of stripeSubs) { try { await stripe.subscriptions.cancel(s) } catch { /* ok */ } }
    for (const c of stripeKunder) { try { await stripe.customers.del(c) } catch { /* ok */ } }
    if (opprettedeBrukere.length > 0) {
      await service.from('subscriptions').delete().in('user_id', opprettedeBrukere)
      await service.from('coach_athlete_relations').delete().in('coach_id', opprettedeBrukere)
      await service.from('coach_seat_invites').delete().in('coach_id', opprettedeBrukere)
      for (const id of opprettedeBrukere) { try { await service.auth.admin.deleteUser(id) } catch { /* ok */ } }
    }
    console.log(`  ryddet: ${opprettedeBrukere.length} brukere, ${stripeSubs.length} abonnementer`)
  }

  if (feil > 0) {
    console.error(`\n✗ ${feil} sjekk(er) feilet`)
    process.exit(1)
  }
  console.log('\n✓ alle invitasjons-scenarioer grønne (B, H, F, C + lenke-regenerering)')
}

main().catch(e => { console.error('UVENTET FEIL:', e); process.exit(1) })
