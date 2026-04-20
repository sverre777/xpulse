-- ============================================================
-- Fase 7 — Aktivitets-basert øktmodell + pulssoner
-- Én kronologisk liste av "aktiviteter" per økt (bevegelse, pause,
-- skyting osv). Erstatter workout_movements + workout_zones +
-- workout_shooting_blocks i UI. Gamle tabeller beholdes urørt.
-- Kjør i Supabase SQL Editor (idempotent).
-- ============================================================

-- ── profiles.birth_year (for sone-fallback) ─────────────────
alter table public.profiles
  add column if not exists birth_year integer
    check (birth_year is null or (birth_year between 1900 and extract(year from now())::int));

-- ============================================================
-- user_heart_zones  —  pulssoner per bruker
-- ============================================================
create table if not exists public.user_heart_zones (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  zone_name   text not null check (zone_name in ('I1','I2','I3','I4','I5')),
  min_bpm     integer not null,
  max_bpm     integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, zone_name),
  check (min_bpm >= 0 and max_bpm > min_bpm)
);

create index if not exists user_heart_zones_user_idx
  on public.user_heart_zones(user_id);

alter table public.user_heart_zones enable row level security;

drop policy if exists "Own heart zones" on public.user_heart_zones;
create policy "Own heart zones"
  on public.user_heart_zones for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach reads athlete heart zones" on public.user_heart_zones;
create policy "Coach reads athlete heart zones"
  on public.user_heart_zones for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
  ));

drop trigger if exists user_heart_zones_updated_at on public.user_heart_zones;
create trigger user_heart_zones_updated_at
  before update on public.user_heart_zones
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- workout_activities  —  kronologisk liste per økt
-- ============================================================
create table if not exists public.workout_activities (
  id                    uuid primary key default uuid_generate_v4(),
  workout_id            uuid not null references public.workouts(id) on delete cascade,
  activity_type         text not null check (activity_type in (
    'oppvarming','aktivitet','pause','aktiv_pause',
    'skyting_liggende','skyting_staaende','skyting_kombinert',
    'nedjogg','annet'
  )),
  movement_name         text,
  sort_order            integer not null default 0,
  start_time            time,
  duration_seconds      integer not null default 0 check (duration_seconds >= 0),
  distance_meters       numeric(7,2),
  avg_heart_rate        integer,
  max_heart_rate        integer,
  avg_watts             integer,
  lactate_mmol          numeric(4,2),
  lactate_measured_at   time,
  prone_shots           integer,
  prone_hits            integer,
  standing_shots        integer,
  standing_hits         integer,
  notes                 text,
  created_at            timestamptz not null default now()
);

create index if not exists workout_activities_workout_idx
  on public.workout_activities(workout_id, sort_order);

alter table public.workout_activities enable row level security;

drop policy if exists "Own workout activities" on public.workout_activities;
create policy "Own workout activities"
  on public.workout_activities for all
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete activities" on public.workout_activities;
create policy "Coach reads athlete activities"
  on public.workout_activities for select
  using (exists (
    select 1 from public.workouts w
    join public.coach_athlete_relations r
      on r.athlete_id = w.user_id
    where w.id = workout_id
      and r.coach_id = auth.uid()
      and r.status   = 'active'
  ));

-- ============================================================
-- Data-migrering:
--   workout_movements        → activity_type='aktivitet'
--   workout_shooting_blocks  → activity_type='skyting_*'
-- Idempotent: kjører kun for økter som ikke allerede har aktiviteter.
-- ============================================================
with targets as (
  select w.id as workout_id
  from public.workouts w
  where not exists (
    select 1 from public.workout_activities a where a.workout_id = w.id
  )
),
movement_count as (
  select m.workout_id, count(*) as n
  from public.workout_movements m
  where m.workout_id in (select workout_id from targets)
  group by m.workout_id
),
movements_source as (
  select
    m.workout_id,
    'aktivitet'::text                                                  as activity_type,
    m.movement_name                                                    as movement_name,
    (row_number() over (partition by m.workout_id
                        order by coalesce(m.sort_order, 0), m.id) - 1)::int as sort_order,
    null::time                                                         as start_time,
    coalesce(m.minutes, 0) * 60                                        as duration_seconds,
    case when m.distance_km is not null
         then (m.distance_km * 1000)::numeric(7,2)
         else null end                                                 as distance_meters,
    m.avg_heart_rate                                                   as avg_heart_rate,
    null::int                                                          as max_heart_rate,
    null::int                                                          as avg_watts,
    null::numeric(4,2)                                                 as lactate_mmol,
    null::time                                                         as lactate_measured_at,
    null::int                                                          as prone_shots,
    null::int                                                          as prone_hits,
    null::int                                                          as standing_shots,
    null::int                                                          as standing_hits,
    null::text                                                         as notes
  from public.workout_movements m
  where m.workout_id in (select workout_id from targets)
),
shooting_source as (
  select
    b.workout_id,
    case
      when b.shooting_type in ('rolig_komb','hurtighet_komb','hard_komb','konkurranse')
        then 'skyting_kombinert'
      when coalesce(b.prone_shots, 0) > 0 and coalesce(b.standing_shots, 0) > 0
        then 'skyting_kombinert'
      when coalesce(b.prone_shots, 0) > 0
        then 'skyting_liggende'
      when coalesce(b.standing_shots, 0) > 0
        then 'skyting_staaende'
      else 'skyting_kombinert'
    end                                                                as activity_type,
    null::text                                                         as movement_name,
    (coalesce(mc.n, 0)
      + row_number() over (partition by b.workout_id
                           order by coalesce(b.movement_order, 0),
                                    coalesce(b.sort_order, 0),
                                    b.id) - 1)::int                    as sort_order,
    b.start_time                                                       as start_time,
    coalesce(b.duration_seconds, 0)                                    as duration_seconds,
    null::numeric(7,2)                                                 as distance_meters,
    b.avg_heart_rate                                                   as avg_heart_rate,
    null::int                                                          as max_heart_rate,
    null::int                                                          as avg_watts,
    null::numeric(4,2)                                                 as lactate_mmol,
    null::time                                                         as lactate_measured_at,
    b.prone_shots,
    b.prone_hits,
    b.standing_shots,
    b.standing_hits,
    null::text                                                         as notes
  from public.workout_shooting_blocks b
  left join movement_count mc on mc.workout_id = b.workout_id
  where b.workout_id in (select workout_id from targets)
)
insert into public.workout_activities (
  workout_id, activity_type, movement_name, sort_order,
  start_time, duration_seconds, distance_meters,
  avg_heart_rate, max_heart_rate, avg_watts,
  lactate_mmol, lactate_measured_at,
  prone_shots, prone_hits, standing_shots, standing_hits, notes
)
select * from movements_source
union all
select * from shooting_source;

-- ── Reload PostgREST schema cache ──────────────────────────
notify pgrst, 'reload schema';

-- ============================================================
-- Verifiserings-spørringer (kjør separat etter migrering):
--
-- select count(*) as workouts_total from public.workouts;
-- select count(distinct workout_id) as workouts_migrated
--   from public.workout_activities;
--
-- select w.id, w.title,
--        (select count(*) from public.workout_movements        where workout_id=w.id) as movements_before,
--        (select count(*) from public.workout_shooting_blocks  where workout_id=w.id) as shooting_before,
--        (select count(*) from public.workout_activities       where workout_id=w.id) as activities_after
--   from public.workouts w
--  order by w.date desc
--  limit 20;
-- ============================================================
