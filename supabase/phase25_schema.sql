-- ============================================================
-- X-PULSE — Phase 2.5 Schema
-- Kjør i Supabase SQL Editor
-- ============================================================

-- 1. FIX: Allow new users to insert their own profile
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 2. FIX: Ensure day_form_mental exists
alter table public.workouts
  add column if not exists day_form_mental integer check (day_form_mental between 1 and 5);

-- 3. FIX: Expand workout_type constraint to include biathlon types
alter table public.workouts
  drop constraint if exists workouts_workout_type_check;
alter table public.workouts
  add constraint workouts_workout_type_check
  check (workout_type in (
    'endurance','strength','technical','competition','recovery',
    'hard_combo','easy_combo','basis_shooting','warmup_shooting'
  ));

-- 4. Daily health metrics (separate from workouts)
create table if not exists public.daily_health (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  resting_hr integer,
  hrv_ms numeric(6,1),
  sleep_hours numeric(3,1),
  sleep_quality integer check (sleep_quality between 1 and 5),
  body_weight_kg numeric(5,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

-- 5. Dynamic lactate measurements per workout
create table if not exists public.workout_lactate_measurements (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  measured_at_time time,
  mmol numeric(4,2) not null,
  heart_rate integer,
  feeling integer check (feeling between 1 and 5),
  sort_order integer default 0
);

create index if not exists lactate_workout_idx on public.workout_lactate_measurements(workout_id);

-- 6. Workout templates per user
create table if not exists public.workout_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  template_data jsonb not null,
  last_used_at timestamptz,
  use_count integer default 0,
  created_at timestamptz not null default now()
);

-- 7. Calendar comments (day / week / month)
create table if not exists public.calendar_comments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_type text not null check (comment_type in ('day','week','month')),
  ref_date date not null,
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, comment_type, ref_date)
);

-- 8. User custom movement types
create table if not exists public.user_movement_types (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  parent_category text,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

-- RLS
alter table public.daily_health                  enable row level security;
alter table public.workout_lactate_measurements  enable row level security;
alter table public.workout_templates             enable row level security;
alter table public.calendar_comments             enable row level security;
alter table public.user_movement_types           enable row level security;

create policy "Own daily health"
  on public.daily_health for all using (user_id = auth.uid());

create policy "Own workout lactate"
  on public.workout_lactate_measurements for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));

create policy "Own templates"
  on public.workout_templates for all using (user_id = auth.uid());

create policy "Own calendar comments"
  on public.calendar_comments for all using (user_id = auth.uid());

create policy "Own user movement types"
  on public.user_movement_types for all using (user_id = auth.uid());

-- Coach reads athlete health
create policy "Coach reads athlete health"
  on public.daily_health for select
  using (exists (
    select 1 from public.coach_athlete_relations
    where coach_id = auth.uid() and athlete_id = daily_health.user_id and status = 'active'
  ));

create policy "Coach reads athlete lactate"
  on public.workout_lactate_measurements for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_id and r.coach_id = auth.uid() and r.status = 'active'
  ));
