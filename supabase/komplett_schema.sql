-- ============================================================
-- X-PULSE — Komplett schema (alle faser)
-- Trygt å kjøre selv om noe allerede eksisterer (idempotent)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  email         text not null,
  full_name     text,
  role          text not null default 'athlete' check (role in ('athlete','coach')),
  primary_sport text default 'running'
    check (primary_sport in ('running','cross_country_skiing','biathlon','triathlon','cycling','long_distance_skiing','endurance')),
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'athlete')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- COACH–ATHLETE RELATIONS
-- ============================================================
create table if not exists public.coach_athlete_relations (
  id         uuid primary key default uuid_generate_v4(),
  coach_id   uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','active','inactive')),
  created_at timestamptz not null default now(),
  unique(coach_id, athlete_id)
);

create index if not exists coach_athlete_coach_idx   on public.coach_athlete_relations(coach_id);
create index if not exists coach_athlete_athlete_idx on public.coach_athlete_relations(athlete_id);

-- ============================================================
-- WORKOUTS
-- ============================================================
create table if not exists public.workouts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  description         text,
  sport               text not null default 'running'
    check (sport in ('running','cross_country_skiing','biathlon','triathlon','cycling','long_distance_skiing','endurance')),
  workout_type        text not null default 'long_run',
  date                date not null default current_date,
  time_of_day         time,
  duration_minutes    integer,
  distance_km         numeric(6,2),
  avg_heart_rate      integer,
  max_heart_rate      integer,
  elevation_meters    integer,
  notes               text,
  is_planned          boolean not null default false,
  is_completed        boolean not null default true,
  is_important        boolean not null default false,
  planned_workout_id  uuid references public.workouts(id),
  day_form_physical   integer check (day_form_physical between 1 and 5),
  day_form_mental     integer check (day_form_mental between 1 and 5),
  rpe                 integer check (rpe between 1 and 10),
  coach_comment       text,
  shooting_data       jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Fjern alle eksisterende workout_type constraints og sett ny
do $$
declare r record;
begin
  for r in
    select con.conname from pg_constraint con
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
    'endurance','strength'
  ));

drop trigger if exists workouts_updated_at on public.workouts;
create trigger workouts_updated_at
  before update on public.workouts
  for each row execute procedure public.handle_updated_at();

create index if not exists workouts_user_id_date_idx on public.workouts(user_id, date desc);

-- ============================================================
-- WORKOUT MOVEMENTS
-- ============================================================
create table if not exists public.workout_movements (
  id                uuid primary key default uuid_generate_v4(),
  workout_id        uuid not null references public.workouts(id) on delete cascade,
  movement_name     text not null,
  minutes           integer,
  distance_km       numeric(6,2),
  elevation_meters  integer,
  avg_heart_rate    integer,
  inline_zones      jsonb default '[]'::jsonb,
  inline_exercises  jsonb default '[]'::jsonb,
  sort_order        integer default 0
);

alter table public.workout_movements
  add column if not exists avg_heart_rate   integer,
  add column if not exists inline_zones     jsonb default '[]'::jsonb,
  add column if not exists inline_exercises jsonb default '[]'::jsonb;

create index if not exists workout_movements_workout_idx on public.workout_movements(workout_id);

-- ============================================================
-- WORKOUT INTENSITY ZONES
-- ============================================================
create table if not exists public.workout_zones (
  id         uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  zone_name  text not null,
  minutes    integer not null default 0,
  sort_order integer default 0
);

create index if not exists workout_zones_workout_idx on public.workout_zones(workout_id);

-- ============================================================
-- WORKOUT TAGS
-- ============================================================
create table if not exists public.workout_tags (
  id         uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  tag        text not null
);

-- ============================================================
-- WORKOUT EXERCISES (global, legacy)
-- ============================================================
create table if not exists public.workout_exercises (
  id            uuid primary key default uuid_generate_v4(),
  workout_id    uuid not null references public.workouts(id) on delete cascade,
  exercise_name text not null,
  sets          integer,
  reps          integer,
  weight_kg     numeric(5,1),
  notes         text,
  sort_order    integer default 0
);

-- ============================================================
-- WORKOUT LACTATE MEASUREMENTS
-- ============================================================
create table if not exists public.workout_lactate_measurements (
  id               uuid primary key default uuid_generate_v4(),
  workout_id       uuid not null references public.workouts(id) on delete cascade,
  measured_at_time time,
  mmol             numeric(4,2) not null,
  heart_rate       integer,
  feeling          integer check (feeling between 1 and 5),
  sort_order       integer default 0
);

create index if not exists lactate_workout_idx on public.workout_lactate_measurements(workout_id);

-- ============================================================
-- DAILY HEALTH
-- ============================================================
create table if not exists public.daily_health (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  date           date not null,
  resting_hr     integer,
  hrv_ms         numeric(6,1),
  sleep_hours    numeric(3,1),
  sleep_quality  integer check (sleep_quality between 1 and 5),
  body_weight_kg numeric(5,2),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(user_id, date)
);

drop trigger if exists daily_health_updated_at on public.daily_health;
create trigger daily_health_updated_at
  before update on public.daily_health
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- WORKOUT TEMPLATES
-- ============================================================
create table if not exists public.workout_templates (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  template_data jsonb not null,
  last_used_at  timestamptz,
  use_count     integer default 0,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- CALENDAR COMMENTS
-- ============================================================
create table if not exists public.calendar_comments (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  comment_type text not null check (comment_type in ('day','week','month')),
  ref_date     date not null,
  comment      text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(user_id, comment_type, ref_date)
);

-- ============================================================
-- USER MOVEMENT TYPES (custom)
-- ============================================================
create table if not exists public.user_movement_types (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  parent_category text,
  created_at      timestamptz not null default now(),
  unique(user_id, name)
);

-- ============================================================
-- SEASONS / GOALS / PHASES
-- ============================================================
create table if not exists public.seasons (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.training_goals (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  date       date not null,
  goal_type  text default 'competition' check (goal_type in ('competition','milestone','target')),
  priority   text default 'a' check (priority in ('a','b','c')),
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.training_phases (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  season_id             uuid references public.seasons(id) on delete cascade,
  name                  text not null,
  phase_type            text check (phase_type in ('base','specific','competition','recovery')),
  start_date            date not null,
  end_date              date not null,
  target_hours_per_week numeric(4,1),
  color                 text,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles                    enable row level security;
alter table public.coach_athlete_relations     enable row level security;
alter table public.workouts                    enable row level security;
alter table public.workout_movements           enable row level security;
alter table public.workout_zones               enable row level security;
alter table public.workout_tags                enable row level security;
alter table public.workout_exercises           enable row level security;
alter table public.workout_lactate_measurements enable row level security;
alter table public.daily_health                enable row level security;
alter table public.workout_templates           enable row level security;
alter table public.calendar_comments           enable row level security;
alter table public.user_movement_types         enable row level security;
alter table public.seasons                     enable row level security;
alter table public.training_goals              enable row level security;
alter table public.training_phases             enable row level security;

-- PROFILES
drop policy if exists "Users can view own profile"              on public.profiles;
drop policy if exists "Users can update own profile"            on public.profiles;
drop policy if exists "Users can insert own profile"            on public.profiles;
drop policy if exists "Coaches can view their athletes profiles" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Coaches can view their athletes profiles"
  on public.profiles for select using (
    exists (
      select 1 from public.coach_athlete_relations
      where coach_id = auth.uid() and athlete_id = profiles.id and status = 'active'
    )
  );

-- COACH_ATHLETE_RELATIONS
drop policy if exists "Coach can manage own relations"     on public.coach_athlete_relations;
drop policy if exists "Athlete can view own relations"     on public.coach_athlete_relations;
drop policy if exists "Athlete can update own relation status" on public.coach_athlete_relations;

create policy "Coach can manage own relations"
  on public.coach_athlete_relations for all using (auth.uid() = coach_id);
create policy "Athlete can view own relations"
  on public.coach_athlete_relations for select using (auth.uid() = athlete_id);
create policy "Athlete can update own relation status"
  on public.coach_athlete_relations for update using (auth.uid() = athlete_id);

-- WORKOUTS
drop policy if exists "Athletes can manage own workouts" on public.workouts;
drop policy if exists "Coaches can view athlete workouts" on public.workouts;

create policy "Athletes can manage own workouts"
  on public.workouts for all using (auth.uid() = user_id);
create policy "Coaches can view athlete workouts"
  on public.workouts for select using (
    exists (
      select 1 from public.coach_athlete_relations
      where coach_id = auth.uid() and athlete_id = workouts.user_id and status = 'active'
    )
  );

-- WORKOUT SUB-TABLES
drop policy if exists "Own workout movements"        on public.workout_movements;
drop policy if exists "Own workout zones"            on public.workout_zones;
drop policy if exists "Own workout tags"             on public.workout_tags;
drop policy if exists "Own workout exercises"        on public.workout_exercises;
drop policy if exists "Own workout lactate"          on public.workout_lactate_measurements;
drop policy if exists "Coach reads athlete movements" on public.workout_movements;
drop policy if exists "Coach reads athlete zones"     on public.workout_zones;
drop policy if exists "Coach reads athlete lactate"   on public.workout_lactate_measurements;

create policy "Own workout movements" on public.workout_movements for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));
create policy "Own workout zones" on public.workout_zones for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));
create policy "Own workout tags" on public.workout_tags for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));
create policy "Own workout exercises" on public.workout_exercises for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));
create policy "Own workout lactate" on public.workout_lactate_measurements for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));

create policy "Coach reads athlete movements" on public.workout_movements for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_id and r.coach_id = auth.uid() and r.status = 'active'
  ));
create policy "Coach reads athlete zones" on public.workout_zones for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_id and r.coach_id = auth.uid() and r.status = 'active'
  ));
create policy "Coach reads athlete lactate" on public.workout_lactate_measurements for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_id and r.coach_id = auth.uid() and r.status = 'active'
  ));

-- DAILY HEALTH
drop policy if exists "Own daily health"           on public.daily_health;
drop policy if exists "Coach reads athlete health" on public.daily_health;

create policy "Own daily health"
  on public.daily_health for all using (user_id = auth.uid());
create policy "Coach reads athlete health"
  on public.daily_health for select using (
    exists (
      select 1 from public.coach_athlete_relations
      where coach_id = auth.uid() and athlete_id = daily_health.user_id and status = 'active'
    )
  );

-- TEMPLATES, COMMENTS, CUSTOM MOVEMENTS
drop policy if exists "Own templates"            on public.workout_templates;
drop policy if exists "Own calendar comments"    on public.calendar_comments;
drop policy if exists "Own user movement types"  on public.user_movement_types;

create policy "Own templates"
  on public.workout_templates for all using (user_id = auth.uid());
create policy "Own calendar comments"
  on public.calendar_comments for all using (user_id = auth.uid());
create policy "Own user movement types"
  on public.user_movement_types for all using (user_id = auth.uid());

-- SEASONS / GOALS / PHASES
drop policy if exists "Seasons own" on public.seasons;
drop policy if exists "Goals own"   on public.training_goals;
drop policy if exists "Phases own"  on public.training_phases;

create policy "Seasons own" on public.seasons       for all using (user_id = auth.uid());
create policy "Goals own"   on public.training_goals for all using (user_id = auth.uid());
create policy "Phases own"  on public.training_phases for all using (user_id = auth.uid());
