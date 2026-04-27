-- Phase 41 — Trener-spesifikk innstillinger-modul
--
-- Tilføyer kolonner og tabeller for å støtte de nye trener-kategoriene under
-- /app/innstillinger:
--   1. Trener-profil-felter på profiles (bio, sertifiseringer, spesialiteter,
--      erfaringsår, synlig i katalog).
--   2. coach_default_permissions: standardrettighetene som tilbys nye
--      utøver-koblinger.
--   3. coach_inactivity_reminders: e-postvarsler hvis utøver ikke har logget
--      på X dager.
--
-- Idempotent: bruker IF NOT EXISTS / IF EXISTS slik at scriptet kan kjøres
-- flere ganger uten feil.

-- ── Profiles: trener-profil-felter ───────────────────────────

alter table public.profiles
  add column if not exists coach_bio text,
  add column if not exists coach_certifications text,
  add column if not exists coach_specialties text[],
  add column if not exists coach_experience_years int,
  add column if not exists coach_visible_in_directory boolean not null default false;

-- ── coach_default_permissions ────────────────────────────────

create table if not exists public.coach_default_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  can_edit_plan boolean not null default true,
  can_view_dagbok boolean not null default true,
  can_view_analysis boolean not null default true,
  can_edit_periodization boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.coach_default_permissions enable row level security;

drop policy if exists "Own default permissions" on public.coach_default_permissions;
create policy "Own default permissions" on public.coach_default_permissions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── coach_inactivity_reminders ───────────────────────────────

create table if not exists public.coach_inactivity_reminders (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  threshold_days int not null check (threshold_days > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (coach_id, threshold_days)
);

alter table public.coach_inactivity_reminders enable row level security;

drop policy if exists "Own inactivity reminders" on public.coach_inactivity_reminders;
create policy "Own inactivity reminders" on public.coach_inactivity_reminders
  for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

notify pgrst, 'reload schema';
