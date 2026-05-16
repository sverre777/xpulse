-- Phase 70 — Stripe-betalingsmur: subscriptions + feature_waitlist.
--
-- subscriptions: én rad per bruker for aktivt eller historisk abonnement.
--   Stripe customer_id og subscription_id lagres for webhook-oppdateringer.
--   tier dekker kun aktiverte tiers (athlete_pro, trener_basic, trener_pro);
--   AI-tiers lanseres Q4 2026 og legges til via senere ALTER + CHECK-update.
--
-- feature_waitlist: anonym/innlogget e-post-liste for AI-tiers. anon-rolle
-- får INSERT så ikke-innloggede besøkende kan registrere seg fra /pris og
-- /funksjoner/ai-coach.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier text not null check (tier in ('athlete_pro', 'trener_basic', 'trener_pro')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

create table if not exists public.feature_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  feature text not null check (feature in ('athlete_pro_ai', 'athlete_ultimate_ai', 'trener_pro_ai', 'trener_ultimate_ai')),
  created_at timestamptz default now()
);

create index if not exists feature_waitlist_feature_idx on public.feature_waitlist(feature, created_at desc);
create index if not exists feature_waitlist_user_idx on public.feature_waitlist(user_id) where user_id is not null;

-- ── Row-Level Security ──────────────────────────────────────

alter table public.subscriptions   enable row level security;
alter table public.feature_waitlist enable row level security;

drop policy if exists "Read own subscription" on public.subscriptions;
create policy "Read own subscription"
  on public.subscriptions for select
  using (user_id = auth.uid());

-- Insert/update på subscriptions skjer kun fra service_role (webhook).
-- Authenticated får ikke skrive direkte — Stripe webhook holder skrive-stien
-- under kontroll så vi unngår inkonsistens mot Stripe-state.
drop policy if exists "Service writes subscription" on public.subscriptions;
create policy "Service writes subscription"
  on public.subscriptions for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Read own waitlist" on public.feature_waitlist;
create policy "Read own waitlist"
  on public.feature_waitlist for select
  using (user_id = auth.uid() or user_id is null);

-- Anon kan INSERT-e (ikke-innlogget besøkende fra /pris). Innloggede setter
-- user_id eksplisitt; anon lar feltet være null.
drop policy if exists "Anyone joins waitlist" on public.feature_waitlist;
create policy "Anyone joins waitlist"
  on public.feature_waitlist for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Service manages waitlist" on public.feature_waitlist;
create policy "Service manages waitlist"
  on public.feature_waitlist for all
  to service_role
  using (true)
  with check (true);

-- ── Grants (per memory #25-pattern) ────────────────────────

grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;

grant select, insert on public.feature_waitlist to anon, authenticated;
grant select, insert, update, delete on public.feature_waitlist to service_role;

-- ── Updated-at trigger på subscriptions ────────────────────

create or replace function public.set_subscription_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_subscription_updated_at();

notify pgrst, 'reload schema';
