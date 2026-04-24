-- Phase 31: Tester og personlige rekorder (PR).
-- Legger til egen workout_type 'test' for å flagge testøkter i kalender/analyse,
-- samt tre nye tabeller for strukturerte test-resultater, test-maler
-- (trener-bibliotek) og PR-liste per utøver.
--
-- Idempotent: drop/create policy, "create table if not exists",
-- "add column if not exists" m.m.

-- ============================================================
-- 1. Utvid workout_type med 'test'
--    Sjekker om constraint mangler verdien; hvis ja, gjenoppbygger.
-- ============================================================
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'workouts'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) like '%workout_type%'
  loop
    execute 'alter table public.workouts drop constraint if exists ' || quote_ident(r.conname);
  end loop;
end $$;

alter table public.workouts
  add constraint workouts_workout_type_check
  check (workout_type in (
    'long_run','interval','threshold','easy','competition','recovery','technical','other',
    'hard_combo','easy_combo','basis_shooting','warmup_shooting',
    'endurance','strength','test'
  ));

-- ============================================================
-- 2. workout_test_data — én rad per test-økt (1-1 med workouts)
--    Lagrer standardisert primærresultat (f.eks. tid for 5km)
--    pluss sekundære resultater som fleksibel jsonb.
-- ============================================================
create table if not exists public.workout_test_data (
  id                 uuid primary key default uuid_generate_v4(),
  workout_id         uuid not null unique references public.workouts(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  sport              text not null,
  test_type          text not null,
  primary_result     numeric,
  primary_unit       text,
  secondary_results  jsonb not null default '{}'::jsonb,
  protocol_notes     text,
  equipment          text,
  conditions         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists workout_test_data_user_sport_idx
  on public.workout_test_data(user_id, sport, test_type);
create index if not exists workout_test_data_workout_idx
  on public.workout_test_data(workout_id);

alter table public.workout_test_data enable row level security;

drop policy if exists "Own workout test data"  on public.workout_test_data;
drop policy if exists "Coach reads athlete workout test data" on public.workout_test_data;
drop policy if exists "Coach writes athlete workout test data" on public.workout_test_data;

create policy "Own workout test data"
  on public.workout_test_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Coach reads athlete workout test data"
  on public.workout_test_data for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = workout_test_data.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
  ));

create policy "Coach writes athlete workout test data"
  on public.workout_test_data for all
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = workout_test_data.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = workout_test_data.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ));

-- ============================================================
-- 3. test_templates — bibliotek for test-protokoller
--    Eid av bruker (trener bygger sitt bibliotek; utøver kan lage egne).
--    is_shared_with_athletes: når true kan trenerens utøvere lese malen.
-- ============================================================
create table if not exists public.test_templates (
  id                        uuid primary key default uuid_generate_v4(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  sport                     text not null,
  test_type                 text not null,
  name                      text not null,
  protocol                  text,
  default_distance_km       numeric,
  default_duration_minutes  integer,
  default_intervals         jsonb not null default '[]'::jsonb,
  is_shared_with_athletes   boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists test_templates_user_sport_idx
  on public.test_templates(user_id, sport, test_type);

alter table public.test_templates enable row level security;

drop policy if exists "Own test templates"   on public.test_templates;
drop policy if exists "Athlete reads shared coach test templates" on public.test_templates;

create policy "Own test templates"
  on public.test_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Utøver kan lese maler fra treneren sin dersom is_shared_with_athletes=true.
create policy "Athlete reads shared coach test templates"
  on public.test_templates for select
  using (
    is_shared_with_athletes = true
    and exists (
      select 1 from public.coach_athlete_relations r
      where r.coach_id   = test_templates.user_id
        and r.athlete_id = auth.uid()
        and r.status     = 'active'
    )
  );

-- ============================================================
-- 4. personal_records — PR-liste per utøver
--    workout_id valgfri (manuelle PR uten knyttet økt).
--    is_manual flagger at verdien ikke stammer fra workout_test_data.
-- ============================================================
create table if not exists public.personal_records (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  sport         text not null,
  record_type   text not null,
  value         numeric not null,
  unit          text not null,
  achieved_at   date not null,
  workout_id    uuid references public.workouts(id) on delete set null,
  notes         text,
  is_manual     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists personal_records_user_sport_idx
  on public.personal_records(user_id, sport, record_type);
create index if not exists personal_records_user_type_date_idx
  on public.personal_records(user_id, record_type, achieved_at desc);

alter table public.personal_records enable row level security;

drop policy if exists "Own personal records"               on public.personal_records;
drop policy if exists "Coach reads athlete personal records"  on public.personal_records;
drop policy if exists "Coach writes athlete personal records" on public.personal_records;

create policy "Own personal records"
  on public.personal_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Coach reads athlete personal records"
  on public.personal_records for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = personal_records.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
  ));

create policy "Coach writes athlete personal records"
  on public.personal_records for all
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = personal_records.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = personal_records.user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan = true
  ));

-- ============================================================
-- Updated-at triggers (gjenbruker public.handle_updated_at())
-- ============================================================
drop trigger if exists workout_test_data_updated_at on public.workout_test_data;
create trigger workout_test_data_updated_at
  before update on public.workout_test_data
  for each row execute procedure public.handle_updated_at();

drop trigger if exists test_templates_updated_at on public.test_templates;
create trigger test_templates_updated_at
  before update on public.test_templates
  for each row execute procedure public.handle_updated_at();

drop trigger if exists personal_records_updated_at on public.personal_records;
create trigger personal_records_updated_at
  before update on public.personal_records
  for each row execute procedure public.handle_updated_at();

notify pgrst, 'reload schema';
