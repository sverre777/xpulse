-- Fase 50 — Klokkesync: Strava OAuth + .fit-opplasting + samples-storage.
--
-- Tre tabeller:
-- 1. strava_connections — bruker-til-Strava-kobling med OAuth-tokens
-- 2. imported_activities — anti-duplikat-tracking per kilde
-- 3. workout_samples — sekund-for-sekund-data lagret som jsonb-arrays
--    for å unngå millioner av rader
--
-- Pluss to nye kolonner på workout_activities for Strava-lap-sporing.
--
-- RLS: alt er per-bruker. Trener kan lese samples via aktiv relasjon.
-- Idempotent.

-- ── Strava-tilkoblinger ──────────────────────────────────────
create table if not exists public.strava_connections (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  strava_athlete_id bigint unique not null,
  access_token      text not null,
  refresh_token     text not null,
  token_expires_at  timestamptz not null,
  scope             text,
  auto_sync         boolean not null default true,
  last_sync_at      timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.strava_connections enable row level security;

drop policy if exists "Own strava connection" on public.strava_connections;
create policy "Own strava connection"
  on public.strava_connections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Importerte aktiviteter (anti-duplikat) ──────────────────
create table if not exists public.imported_activities (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  source       text not null check (source in ('strava','fit_upload','garmin')),
  external_id  text,
  workout_id   uuid references public.workouts(id) on delete set null,
  imported_at  timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create index if not exists imported_activities_workout_idx
  on public.imported_activities(workout_id);

alter table public.imported_activities enable row level security;

drop policy if exists "Own imported activities" on public.imported_activities;
create policy "Own imported activities"
  on public.imported_activities for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Sekund-for-sekund samples ────────────────────────────────
create table if not exists public.workout_samples (
  id                uuid primary key default uuid_generate_v4(),
  workout_id        uuid not null references public.workouts(id) on delete cascade,
  activity_id       uuid references public.workout_activities(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  -- Hvert array er liste av { t: sek-fra-start, val: number }-objekter.
  hr_samples        jsonb,
  watt_samples      jsonb,
  pace_samples      jsonb,        -- meters per second
  speed_samples     jsonb,
  altitude_samples  jsonb,
  cadence_samples   jsonb,
  source            text,
  created_at        timestamptz not null default now()
);

create index if not exists workout_samples_workout_idx
  on public.workout_samples(workout_id);

alter table public.workout_samples enable row level security;

drop policy if exists "Own samples select" on public.workout_samples;
create policy "Own samples select"
  on public.workout_samples for select
  using (
    user_id = auth.uid() or exists (
      select 1 from public.coach_athlete_relations
      where coach_id = auth.uid()
        and athlete_id = workout_samples.user_id
        and status = 'active'
    )
  );

drop policy if exists "Own samples insert" on public.workout_samples;
create policy "Own samples insert"
  on public.workout_samples for insert
  with check (user_id = auth.uid());

drop policy if exists "Own samples update" on public.workout_samples;
create policy "Own samples update"
  on public.workout_samples for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Own samples delete" on public.workout_samples;
create policy "Own samples delete"
  on public.workout_samples for delete
  using (user_id = auth.uid());

-- ── Lap-sporing for Strava-import ───────────────────────────
alter table public.workout_activities
  add column if not exists strava_lap_index integer,
  add column if not exists external_id text;

-- Indeks for å finne aktiviteter etter ekstern-id ved deltadinkring.
create index if not exists workout_activities_external_idx
  on public.workout_activities(external_id) where external_id is not null;

notify pgrst, 'reload schema';
