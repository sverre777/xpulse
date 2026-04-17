-- ============================================================
-- X-PULSE — Database Schema (Fase 1)
-- Kjør dette i Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- Extends Supabase auth.users with role and display info
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null check (role in ('athlete', 'coach')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'athlete')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- WORKOUTS
-- Treningsøkter koblet til utøver
-- ============================================================
create table public.workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  sport text not null default 'running'
    check (sport in ('running', 'cross_country_skiing', 'biathlon', 'triathlon', 'other')),
  date date not null default current_date,
  duration_minutes integer,
  distance_km numeric(6, 2),
  avg_heart_rate integer,
  max_heart_rate integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workouts_updated_at
  before update on public.workouts
  for each row execute procedure public.handle_updated_at();

create index workouts_user_id_date_idx on public.workouts(user_id, date desc);

-- ============================================================
-- COACH_ATHLETE_RELATIONS
-- Kobling mellom trener og utøver
-- ============================================================
create table public.coach_athlete_relations (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'inactive')),
  created_at timestamptz not null default now(),
  unique(coach_id, athlete_id)
);

create index coach_athlete_coach_idx on public.coach_athlete_relations(coach_id);
create index coach_athlete_athlete_idx on public.coach_athlete_relations(athlete_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.coach_athlete_relations enable row level security;

-- PROFILES policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Coaches can view their athletes profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.coach_athlete_relations
      where coach_id = auth.uid()
        and athlete_id = profiles.id
        and status = 'active'
    )
  );

-- WORKOUTS policies
create policy "Athletes can manage own workouts"
  on public.workouts for all
  using (auth.uid() = user_id);

create policy "Coaches can view athlete workouts"
  on public.workouts for select
  using (
    exists (
      select 1 from public.coach_athlete_relations
      where coach_id = auth.uid()
        and athlete_id = workouts.user_id
        and status = 'active'
    )
  );

-- COACH_ATHLETE_RELATIONS policies
create policy "Coach can manage own relations"
  on public.coach_athlete_relations for all
  using (auth.uid() = coach_id);

create policy "Athlete can view own relations"
  on public.coach_athlete_relations for select
  using (auth.uid() = athlete_id);

create policy "Athlete can update own relation status"
  on public.coach_athlete_relations for update
  using (auth.uid() = athlete_id);
