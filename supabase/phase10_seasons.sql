-- Fase 10: Periodisering — sesonger, perioder og viktige datoer.
-- Hovedstruktur for langsiktig planlegging som overlayes på Plan-kalenderen.

-- ── Sesonger ────────────────────────────────────────────────
create table if not exists public.seasons (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  start_date      date not null,
  end_date        date not null,
  goal_main       text,
  goal_details    text,
  kpi_notes       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date > start_date)
);

create index if not exists seasons_user_idx on public.seasons(user_id, start_date);

alter table public.seasons enable row level security;

drop policy if exists "Own seasons" on public.seasons;
create policy "Own seasons"
  on public.seasons for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach reads athlete seasons" on public.seasons;
create policy "Coach reads athlete seasons"
  on public.seasons for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

drop trigger if exists seasons_updated_at on public.seasons;
create trigger seasons_updated_at
  before update on public.seasons
  for each row execute procedure public.handle_updated_at();

-- ── Perioder i en sesong ───────────────────────────────────
create table if not exists public.season_periods (
  id              uuid primary key default uuid_generate_v4(),
  season_id       uuid not null references public.seasons(id) on delete cascade,
  name            text not null,
  focus           text,
  start_date      date not null,
  end_date        date not null,
  intensity       text not null check (intensity in ('rolig','medium','hard')),
  notes           text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists season_periods_season_idx on public.season_periods(season_id, start_date);

alter table public.season_periods enable row level security;

drop policy if exists "Own season periods" on public.season_periods;
create policy "Own season periods"
  on public.season_periods for all
  using (exists (
    select 1 from public.seasons s
    where s.id = season_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.seasons s
    where s.id = season_id and s.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete periods" on public.season_periods;
create policy "Coach reads athlete periods"
  on public.season_periods for select
  using (exists (
    select 1 from public.seasons s
    join public.coach_athlete_relations r on r.athlete_id = s.user_id
    where s.id = season_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

-- ── Nøkkeldatoer (konkurranser, samlinger, testløp, …) ─────
create table if not exists public.season_key_dates (
  id              uuid primary key default uuid_generate_v4(),
  season_id       uuid not null references public.seasons(id) on delete cascade,
  event_type      text not null check (event_type in (
    'competition_a','competition_b','competition_c','test','camp','other'
  )),
  event_date      date not null,
  name            text not null,
  sport           text,
  location        text,
  distance_format text,
  notes           text,
  linked_workout_id uuid references public.workouts(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists season_key_dates_season_idx on public.season_key_dates(season_id, event_date);

alter table public.season_key_dates enable row level security;

drop policy if exists "Own key dates" on public.season_key_dates;
create policy "Own key dates"
  on public.season_key_dates for all
  using (exists (
    select 1 from public.seasons s
    where s.id = season_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.seasons s
    where s.id = season_id and s.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete key dates" on public.season_key_dates;
create policy "Coach reads athlete key dates"
  on public.season_key_dates for select
  using (exists (
    select 1 from public.seasons s
    join public.coach_athlete_relations r on r.athlete_id = s.user_id
    where s.id = season_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

notify pgrst, 'reload schema';
