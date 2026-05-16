import type { SupabaseClient } from '@supabase/supabase-js'

// Felles subscription-helpers brukt av middleware, server actions og UI.
// Tilgang gis ved status='active' eller 'trialing' så lenge perioden ikke
// er utløpt. past_due, canceled, incomplete tilsvarer ingen tilgang.

export type SubscriptionTier = 'athlete_pro' | 'trener_basic' | 'trener_pro'
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid'

export interface ActiveSubscription {
  tier: SubscriptionTier
  status: SubscriptionStatus
  current_period_end: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

const ACTIVE_STATUSES = new Set<SubscriptionStatus>(['active', 'trialing'])

export async function getActiveSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveSubscription | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier, status, current_period_end, trial_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as ActiveSubscription | null) ?? null
}

// True hvis brukeren har en gyldig abonnement-rad (active eller trialing) og
// gjeldende periode (current_period_end) ikke er utløpt. trial_end sjekkes
// for trialing, current_period_end for active.
export function hasActiveAccess(sub: ActiveSubscription | null): boolean {
  if (!sub) return false
  if (!ACTIVE_STATUSES.has(sub.status)) return false
  const now = Date.now()
  if (sub.status === 'trialing') {
    if (!sub.trial_end) return true  // ingen frist registrert — gi tilgang
    return new Date(sub.trial_end).getTime() > now
  }
  // active
  if (!sub.current_period_end) return true
  return new Date(sub.current_period_end).getTime() > now
}

export function getCurrentTier(sub: ActiveSubscription | null): SubscriptionTier | null {
  return sub && hasActiveAccess(sub) ? sub.tier : null
}

export function tierLabel(tier: SubscriptionTier): string {
  switch (tier) {
    case 'athlete_pro':  return 'Athlete Pro'
    case 'trener_basic': return 'Trener Basic'
    case 'trener_pro':   return 'Trener Pro'
  }
}

export function tierPriceMonthly(tier: SubscriptionTier): number {
  switch (tier) {
    case 'athlete_pro':  return 59
    case 'trener_basic': return 199
    case 'trener_pro':   return 279
  }
}
