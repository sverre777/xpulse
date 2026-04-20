-- ============================================================
-- Fase 4 — Fiks manglende shooting_blocks + plan-snapshot
-- Kjør i Supabase SQL Editor (trygt å kjøre på nytt — alt er idempotent)
-- ============================================================

-- ── Bug 1: manglende workout_shooting_blocks-tabell ─────────
create table if not exists public.workout_shooting_blocks (
  id              uuid primary key default uuid_generate_v4(),
  workout_id      uuid not null references public.workouts(id) on delete cascade,
  movement_order  integer not null default 0,
  shooting_type   text not null
    check (shooting_type in ('prone','standing','combo','warmup')),
  prone_shots     integer,
  prone_hits      integer,
  standing_shots  integer,
  standing_hits   integer,
  sort_order      integer default 0
);

create index if not exists wsb_workout_idx on public.workout_shooting_blocks(workout_id);

alter table public.workout_shooting_blocks enable row level security;

drop policy if exists "Own workout shooting blocks" on public.workout_shooting_blocks;
create policy "Own workout shooting blocks"
  on public.workout_shooting_blocks for all
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete shooting blocks" on public.workout_shooting_blocks;
create policy "Coach reads athlete shooting blocks"
  on public.workout_shooting_blocks for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_id and r.coach_id = auth.uid() and r.status = 'active'
  ));

-- ── Bug 2-fundament: planned_snapshot ──────────────────────
-- Lagrer full plan (movements, zones, skyting, tagger, notater, varighet, distanse)
-- slik at Plan-kalenderen viser opprinnelig plan uendret etter at økten er
-- markert gjennomført (med actual-verdier i hovedkolonnene).
alter table public.workouts
  add column if not exists planned_snapshot jsonb;

comment on column public.workouts.planned_snapshot is
  'Snapshot av plan tatt ved save som planlagt. Brukes for å vise original plan i Plan-kalenderen selv etter at økten er markert gjennomført.';

-- ── Reload PostgREST skjema-cache ──────────────────────────
notify pgrst, 'reload schema';
