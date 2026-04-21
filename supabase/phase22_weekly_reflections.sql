-- Phase 22: Weekly reflections in Dagbok (subjective metrics per ISO week).

create table if not exists public.weekly_reflections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  year              int not null,
  week_number       int not null check (week_number between 1 and 53),
  perceived_load    int check (perceived_load is null or perceived_load between 1 and 10),
  energy            int check (energy is null or energy between 1 and 10),
  stress            int check (stress is null or stress between 1 and 10),
  comment           text,
  injury_notes      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, year, week_number)
);

create index if not exists weekly_reflections_user_idx
  on public.weekly_reflections(user_id, year, week_number);

alter table public.weekly_reflections enable row level security;

drop policy if exists "Own weekly reflections" on public.weekly_reflections;
create policy "Own weekly reflections"
  on public.weekly_reflections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach reads athlete weekly reflections" on public.weekly_reflections;
create policy "Coach reads athlete weekly reflections"
  on public.weekly_reflections for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

notify pgrst, 'reload schema';
