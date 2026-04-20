Vi-- ============================================================
-- Fase 8 — Konkurranse-data per økt
-- Brukes når workout_type = 'competition' eller 'testlop'.
-- Kontekstuelle felt (navn, sted, plassering, kommentar) — ikke
-- duplisert tid/km/km (det ligger i workout_activities).
-- Skyteresultater og triatlon-transisjoner auto-genereres som
-- egne aktiviteter med sort_order = rekkefølge i konkurransen.
-- Idempotent.
-- ============================================================

-- ── workout_competition_data ──────────────────────────────────
create table if not exists public.workout_competition_data (
  id                 uuid primary key default uuid_generate_v4(),
  workout_id         uuid not null unique references public.workouts(id) on delete cascade,
  competition_type   text check (competition_type in ('konkurranse','testlop','stafett','tempo')),
  name               text,
  location           text,
  distance_format    text,
  bib_number         text,
  position_overall   integer,
  position_class     integer,
  position_gender    integer,
  participant_count  integer,
  comment            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists workout_competition_data_workout_idx
  on public.workout_competition_data(workout_id);

alter table public.workout_competition_data enable row level security;

drop policy if exists "Own competition data" on public.workout_competition_data;
create policy "Own competition data"
  on public.workout_competition_data for all
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete competition data" on public.workout_competition_data;
create policy "Coach reads athlete competition data"
  on public.workout_competition_data for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r
      on r.athlete_id = w.user_id
    where w.id = workout_id
      and r.coach_id = auth.uid()
      and r.status   = 'active'
  ));

drop trigger if exists workout_competition_data_updated_at on public.workout_competition_data;
create trigger workout_competition_data_updated_at
  before update on public.workout_competition_data
  for each row execute procedure public.handle_updated_at();

-- ── Reload PostgREST schema cache ──────────────────────────
notify pgrst, 'reload schema';
