-- ============================================================
-- Fase 7.1 — Utvidelser av workout_activities
--   • movement_subcategory text
--   • zones jsonb (I1..I5 minutter per aktivitet)
--   • skyting_innskyting som ny activity_type
--   • workout_activity_exercises + workout_activity_exercise_sets
-- Kjør i Supabase SQL Editor (idempotent).
-- ============================================================

-- ── Nye kolonner på workout_activities ─────────────────────
alter table public.workout_activities
  add column if not exists movement_subcategory text;

alter table public.workout_activities
  add column if not exists zones jsonb;

-- ── Utvid activity_type-constraint med skyting_innskyting ──
alter table public.workout_activities
  drop constraint if exists workout_activities_activity_type_check;

alter table public.workout_activities
  add constraint workout_activities_activity_type_check
  check (activity_type in (
    'oppvarming','aktivitet','pause','aktiv_pause',
    'skyting_liggende','skyting_staaende','skyting_kombinert','skyting_innskyting',
    'nedjogg','annet'
  ));

-- ============================================================
-- workout_activity_exercises  —  øvelser i styrke-aktiviteter
-- ============================================================
create table if not exists public.workout_activity_exercises (
  id             uuid primary key default uuid_generate_v4(),
  activity_id    uuid not null references public.workout_activities(id) on delete cascade,
  exercise_name  text not null,
  sort_order     integer not null default 0,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists workout_activity_exercises_activity_idx
  on public.workout_activity_exercises(activity_id, sort_order);

alter table public.workout_activity_exercises enable row level security;

drop policy if exists "Own activity exercises" on public.workout_activity_exercises;
create policy "Own activity exercises"
  on public.workout_activity_exercises for all
  using (exists (
    select 1
      from public.workout_activities a
      join public.workouts w on w.id = a.workout_id
     where a.id = activity_id
       and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1
      from public.workout_activities a
      join public.workouts w on w.id = a.workout_id
     where a.id = activity_id
       and w.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete activity exercises" on public.workout_activity_exercises;
create policy "Coach reads athlete activity exercises"
  on public.workout_activity_exercises for select
  using (exists (
    select 1
      from public.workout_activities a
      join public.workouts w on w.id = a.workout_id
      join public.coach_athlete_relations r on r.athlete_id = w.user_id
     where a.id = activity_id
       and r.coach_id = auth.uid()
       and r.status   = 'active'
  ));

-- ============================================================
-- workout_activity_exercise_sets  —  sett per øvelse
-- ============================================================
create table if not exists public.workout_activity_exercise_sets (
  id           uuid primary key default uuid_generate_v4(),
  exercise_id  uuid not null references public.workout_activity_exercises(id) on delete cascade,
  set_number   integer not null,
  reps         integer,
  weight_kg    numeric(6,2),
  rpe          integer check (rpe is null or (rpe between 1 and 10)),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists workout_activity_exercise_sets_exercise_idx
  on public.workout_activity_exercise_sets(exercise_id, set_number);

alter table public.workout_activity_exercise_sets enable row level security;

drop policy if exists "Own exercise sets" on public.workout_activity_exercise_sets;
create policy "Own exercise sets"
  on public.workout_activity_exercise_sets for all
  using (exists (
    select 1
      from public.workout_activity_exercises e
      join public.workout_activities a on a.id = e.activity_id
      join public.workouts w on w.id = a.workout_id
     where e.id = exercise_id
       and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1
      from public.workout_activity_exercises e
      join public.workout_activities a on a.id = e.activity_id
      join public.workouts w on w.id = a.workout_id
     where e.id = exercise_id
       and w.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete exercise sets" on public.workout_activity_exercise_sets;
create policy "Coach reads athlete exercise sets"
  on public.workout_activity_exercise_sets for select
  using (exists (
    select 1
      from public.workout_activity_exercises e
      join public.workout_activities a on a.id = e.activity_id
      join public.workouts w on w.id = a.workout_id
      join public.coach_athlete_relations r on r.athlete_id = w.user_id
     where e.id = exercise_id
       and r.coach_id = auth.uid()
       and r.status   = 'active'
  ));

-- ── Reload PostgREST schema cache ──────────────────────────
notify pgrst, 'reload schema';
