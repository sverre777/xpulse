-- Fase 36: Generisk utstyr-system (sko, sykkel, ski, klokke, annet).
-- Brukere registrerer utstyr med metadata (merke, modell, kjøpsdato osv.) og
-- kobler dem til økter via workout_equipment for auto-summering av total km/tid.
-- Trener får lese-tilgang via aktive coach_athlete_relations.

create extension if not exists "uuid-ossp";

create table if not exists public.equipment (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  category      text not null check (category in ('sko','sykkel','ski','klokke','annet')),
  brand         text,
  model         text,
  sport         text,
  image_url     text,
  purchase_date date,
  price_kr      numeric(10,2),
  status        text not null default 'active' check (status in ('active','retired','lost')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists equipment_user_idx on public.equipment(user_id, status);
create index if not exists equipment_category_idx on public.equipment(user_id, category);

alter table public.equipment enable row level security;

drop policy if exists "Own equipment" on public.equipment;
create policy "Own equipment"
  on public.equipment for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach reads athlete equipment" on public.equipment;
create policy "Coach reads athlete equipment"
  on public.equipment for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

create table if not exists public.workout_equipment (
  id           uuid primary key default uuid_generate_v4(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (workout_id, equipment_id)
);

create index if not exists workout_equipment_workout_idx on public.workout_equipment(workout_id);
create index if not exists workout_equipment_equipment_idx on public.workout_equipment(equipment_id);

alter table public.workout_equipment enable row level security;

drop policy if exists "Own workout equipment" on public.workout_equipment;
create policy "Own workout equipment"
  on public.workout_equipment for all
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete workout equipment" on public.workout_equipment;
create policy "Coach reads athlete workout equipment"
  on public.workout_equipment for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where w.id = workout_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

notify pgrst, 'reload schema';
