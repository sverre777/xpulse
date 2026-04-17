-- ============================================================
-- X-PULSE — Phase 2 Schema Migration
-- Kjør dette i Supabase SQL Editor ETTER phase1 schema
-- ============================================================

-- Add primary_sport to profiles
alter table public.profiles
  add column if not exists primary_sport text default 'running'
    check (primary_sport in ('running','cross_country_skiing','biathlon','triathlon','cycling','long_distance_skiing','endurance'));

-- Expand workouts table
alter table public.workouts
  add column if not exists time_of_day time,
  add column if not exists workout_type text default 'endurance'
    check (workout_type in ('endurance','strength','technical','competition','recovery')),
  add column if not exists is_planned boolean not null default false,
  add column if not exists is_completed boolean not null default true,
  add column if not exists is_important boolean not null default false,
  add column if not exists planned_workout_id uuid references public.workouts(id),
  add column if not exists day_form_physical integer check (day_form_physical between 1 and 5),
  add column if not exists day_form_mental integer check (day_form_mental between 1 and 5),
  add column if not exists sleep_hours numeric(3,1),
  add column if not exists sleep_quality integer check (sleep_quality between 1 and 5),
  add column if not exists resting_hr integer,
  add column if not exists rpe integer check (rpe between 1 and 10),
  add column if not exists lactate_warmup numeric(4,2),
  add column if not exists lactate_during numeric(4,2),
  add column if not exists lactate_after numeric(4,2),
  add column if not exists coach_comment text,
  add column if not exists elevation_meters integer,
  add column if not exists shooting_data jsonb;

-- ============================================================
-- MOVEMENT TYPES (system defaults + user custom)
-- ============================================================
create table if not exists public.movement_types (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  is_system boolean default false,
  sport_context text[] default '{}',
  created_at timestamptz not null default now()
);

insert into public.movement_types (user_id, name, is_system, sport_context) values
(null, 'Løping',              true, '{running,triathlon,biathlon,endurance}'),
(null, 'Klassisk ski',        true, '{cross_country_skiing,biathlon,long_distance_skiing}'),
(null, 'Skøyting',            true, '{cross_country_skiing,biathlon,long_distance_skiing}'),
(null, 'Rulleski klassisk',   true, '{cross_country_skiing,biathlon,long_distance_skiing}'),
(null, 'Rulleski skøyting',   true, '{cross_country_skiing,biathlon,long_distance_skiing}'),
(null, 'Sykling',             true, '{cycling,triathlon}'),
(null, 'Svømming',            true, '{triathlon}'),
(null, 'Rulleskøyter',        true, '{cycling}'),
(null, 'Gange / Turgåing',    true, '{running,endurance,cross_country_skiing,biathlon}'),
(null, 'Styrke',              true, '{}'),
(null, 'Padling',             true, '{}'),
(null, 'Yoga / Mobilitet',    true, '{}'),
(null, 'Klatring',            true, '{}')
on conflict do nothing;

-- ============================================================
-- WORKOUT MOVEMENTS
-- ============================================================
create table if not exists public.workout_movements (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  movement_name text not null,
  minutes integer,
  distance_km numeric(6,2),
  elevation_meters integer,
  sort_order integer default 0
);

create index if not exists workout_movements_workout_idx on public.workout_movements(workout_id);

-- ============================================================
-- WORKOUT INTENSITY ZONES
-- ============================================================
create table if not exists public.workout_zones (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  zone_name text not null,
  minutes integer not null default 0,
  sort_order integer default 0
);

create index if not exists workout_zones_workout_idx on public.workout_zones(workout_id);

-- ============================================================
-- WORKOUT TAGS
-- ============================================================
create table if not exists public.workout_tags (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  tag text not null
);

-- ============================================================
-- STRENGTH EXERCISES
-- ============================================================
create table if not exists public.workout_exercises (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_name text not null,
  sets integer,
  reps integer,
  weight_kg numeric(5,1),
  notes text,
  sort_order integer default 0
);

-- ============================================================
-- SEASONS, GOALS, PHASES
-- ============================================================
create table if not exists public.seasons (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.training_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  date date not null,
  goal_type text default 'competition' check (goal_type in ('competition','milestone','target')),
  priority text default 'a' check (priority in ('a','b','c')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.training_phases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  name text not null,
  phase_type text check (phase_type in ('base','specific','competition','recovery')),
  start_date date not null,
  end_date date not null,
  target_hours_per_week numeric(4,1),
  color text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.movement_types    enable row level security;
alter table public.workout_movements enable row level security;
alter table public.workout_zones     enable row level security;
alter table public.workout_tags      enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.seasons           enable row level security;
alter table public.training_goals    enable row level security;
alter table public.training_phases   enable row level security;

-- movement_types
create policy "View system and own movement types"
  on public.movement_types for select
  using (user_id is null or user_id = auth.uid());
create policy "Users manage own movement types"
  on public.movement_types for insert with check (user_id = auth.uid());
create policy "Users delete own movement types"
  on public.movement_types for delete using (user_id = auth.uid());

-- workout sub-tables (athlete owns via parent workout)
create policy "Own workout movements" on public.workout_movements for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));
create policy "Own workout zones" on public.workout_zones for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));
create policy "Own workout tags" on public.workout_tags for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));
create policy "Own workout exercises" on public.workout_exercises for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));

-- coach can read athlete's workout details
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

-- seasons, goals, phases
create policy "Seasons own" on public.seasons for all using (user_id = auth.uid());
create policy "Goals own"   on public.training_goals for all using (user_id = auth.uid());
create policy "Phases own"  on public.training_phases for all using (user_id = auth.uid());
