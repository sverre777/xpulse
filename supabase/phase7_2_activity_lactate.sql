-- ============================================================
-- Fase 7.2 — Laktatmålinger per aktivitet (liste, ikke enkel verdi)
-- Utøvere tar ofte 3–5 målinger per intervalløkt.
-- Kjør i Supabase SQL Editor (idempotent).
-- ============================================================

create table if not exists public.workout_activity_lactate_measurements (
  id           uuid primary key default uuid_generate_v4(),
  activity_id  uuid not null references public.workout_activities(id) on delete cascade,
  value_mmol   numeric(4,2) not null,
  measured_at  time,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists workout_activity_lactate_activity_idx
  on public.workout_activity_lactate_measurements(activity_id, sort_order);

alter table public.workout_activity_lactate_measurements enable row level security;

drop policy if exists "Own lactate measurements" on public.workout_activity_lactate_measurements;
create policy "Own lactate measurements"
  on public.workout_activity_lactate_measurements for all
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

drop policy if exists "Coach reads athlete lactate" on public.workout_activity_lactate_measurements;
create policy "Coach reads athlete lactate"
  on public.workout_activity_lactate_measurements for select
  using (exists (
    select 1
      from public.workout_activities a
      join public.workouts w on w.id = a.workout_id
      join public.coach_athlete_relations r on r.athlete_id = w.user_id
     where a.id = activity_id
       and r.coach_id = auth.uid()
       and r.status   = 'active'
  ));

-- ── Idempotent data-migrering fra workout_activities.lactate_mmol ───
-- Kjører kun for aktiviteter som har en enkelt-laktat, men enda ikke har
-- noen rad i den nye tabellen. Gamle kolonner beholdes (ikke slett).
insert into public.workout_activity_lactate_measurements (activity_id, value_mmol, measured_at, sort_order)
select a.id, a.lactate_mmol, a.lactate_measured_at, 0
  from public.workout_activities a
 where a.lactate_mmol is not null
   and not exists (
     select 1 from public.workout_activity_lactate_measurements m
      where m.activity_id = a.id
   );

notify pgrst, 'reload schema';
