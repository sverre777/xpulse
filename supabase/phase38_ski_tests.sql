-- Fase 38: Ski-tester. Brukeren tester flere skipar samtidig under samme forhold,
-- registrerer rangering/tid/score per par + smøring/slip brukt.
-- Tre tabeller: ski_tests (test-info), ski_test_entries (par-resultat per test),
-- user_ski_conditions_templates (egne snøtype/føre-maler i tillegg til standard).

create table if not exists public.ski_tests (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  workout_id    uuid references public.workouts(id) on delete set null,
  test_date     date not null,
  location      text,
  air_temp      numeric(4,1),
  snow_temp     numeric(4,1),
  snow_type     text,
  conditions    text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ski_tests_user_idx on public.ski_tests(user_id, test_date desc);

alter table public.ski_tests enable row level security;

drop policy if exists "Own ski tests" on public.ski_tests;
create policy "Own ski tests"
  on public.ski_tests for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach reads ski tests" on public.ski_tests;
create policy "Coach reads ski tests"
  on public.ski_tests for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

create table if not exists public.ski_test_entries (
  id           uuid primary key default uuid_generate_v4(),
  test_id      uuid not null references public.ski_tests(id) on delete cascade,
  ski_id       uuid not null references public.equipment(id) on delete cascade,
  rank_in_test int,
  time_seconds int,
  rating       int check (rating between 1 and 10),
  wax_used     text,
  slip_used    text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists ski_test_entries_test_idx on public.ski_test_entries(test_id);
create index if not exists ski_test_entries_ski_idx on public.ski_test_entries(ski_id);

alter table public.ski_test_entries enable row level security;

drop policy if exists "Own ski test entries" on public.ski_test_entries;
create policy "Own ski test entries"
  on public.ski_test_entries for all
  using (exists (
    select 1 from public.ski_tests t
    where t.id = test_id and t.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.ski_tests t
    where t.id = test_id and t.user_id = auth.uid()
  ));

drop policy if exists "Coach reads ski test entries" on public.ski_test_entries;
create policy "Coach reads ski test entries"
  on public.ski_test_entries for select
  using (exists (
    select 1 from public.ski_tests t
    join public.coach_athlete_relations r on r.athlete_id = t.user_id
    where t.id = test_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

create table if not exists public.user_ski_conditions_templates (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('snow','conditions')),
  label       text not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (user_id, type, label)
);

alter table public.user_ski_conditions_templates enable row level security;

drop policy if exists "Own conditions templates" on public.user_ski_conditions_templates;
create policy "Own conditions templates"
  on public.user_ski_conditions_templates for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
