-- Fase 82 (kø #39 del B): MARKERINGSPERIODER — samlinger/høyde som eget
-- dag-presist lag, uavhengig av belastningsperiodene (season_periods).
-- Lagene rører aldri hverandre: en samling kan fritt overlappe flere
-- belastningsperioder og krysse ukegrenser.
--
-- MIGRERING: eksisterende samling/høyde-FLAGG på season_periods kopieres
-- inn som markeringsperioder med periodens datoer og navn. Flaggene på
-- season_periods RØRES IKKE (beholdes for rollback; kode-lesing legges
-- over på det nye laget i bolk B2). Kjør verifiserings-SELECTene nederst
-- FØR og ETTER — antallet skal stemme.
--
-- Idempotent: trygg å kjøre flere ganger (migreringen hopper over rader
-- som allerede er kopiert, via source_period_id).

-- ── Tabell ──────────────────────────────────────────────────
create table if not exists public.season_markings (
  id                uuid primary key default uuid_generate_v4(),
  season_id         uuid not null references public.seasons(id) on delete cascade,
  -- En markering kan være samling, høyde eller begge (som dagens flagg).
  is_training_camp  boolean not null default false,
  is_altitude       boolean not null default false,
  name              text not null,
  location          text,
  altitude_meters   int,
  notes             text,
  start_date        date not null,
  end_date          date not null,
  -- Sporer migrerings-opphav (null for markeringer laget direkte i nytt UI).
  -- Gjør migreringen idempotent og muliggjør før/etter-verifisering.
  source_period_id  uuid references public.season_periods(id) on delete set null,
  created_at        timestamptz not null default now(),
  check (end_date >= start_date),
  check (is_training_camp or is_altitude)
);

create index if not exists season_markings_season_idx
  on public.season_markings(season_id, start_date);

-- ── RLS (speiler season_periods: egen + coach les/skriv m/ flagg) ──
alter table public.season_markings enable row level security;

drop policy if exists "Own season markings" on public.season_markings;
create policy "Own season markings"
  on public.season_markings for all
  using (exists (
    select 1 from public.seasons s
    where s.id = season_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.seasons s
    where s.id = season_id and s.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete markings" on public.season_markings;
create policy "Coach reads athlete markings"
  on public.season_markings for select
  using (exists (
    select 1 from public.seasons s
    join public.coach_athlete_relations r on r.athlete_id = s.user_id
    where s.id = season_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

drop policy if exists "Coach writes athlete markings" on public.season_markings;
create policy "Coach writes athlete markings"
  on public.season_markings for all
  using (exists (
    select 1 from public.seasons s
    join public.coach_athlete_relations r on r.athlete_id = s.user_id
    where s.id = season_markings.season_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_periodization = true
  ))
  with check (exists (
    select 1 from public.seasons s
    join public.coach_athlete_relations r on r.athlete_id = s.user_id
    where s.id = season_markings.season_id
      and r.coach_id = auth.uid() and r.status = 'active' and r.can_edit_periodization = true
  ));

grant select, insert, update, delete on public.season_markings to authenticated;
grant all on public.season_markings to service_role;

-- ── Migrering: kopier eksisterende samling/høyde-flagg ──────
-- Én markering per periode som har minst ett av flaggene. Navn arves fra
-- perioden; datoene er periodens (dag-presise allerede). Idempotent via
-- source_period_id-sjekken.
insert into public.season_markings
  (season_id, is_training_camp, is_altitude, name, location, altitude_meters, start_date, end_date, source_period_id)
select
  p.season_id,
  coalesce(p.is_training_camp, false),
  coalesce(p.is_altitude_period, false),
  p.name,
  p.location,
  p.altitude_meters,
  p.start_date,
  p.end_date,
  p.id
from public.season_periods p
where (coalesce(p.is_training_camp, false) or coalesce(p.is_altitude_period, false))
  and not exists (
    select 1 from public.season_markings m where m.source_period_id = p.id
  );

notify pgrst, 'reload schema';

-- ── VERIFISERING (kjør manuelt, sammenlign) ────────────────
-- FØR/ETTER: antall perioder med flagg — skal være likt antall migrerte:
--   select count(*) from public.season_periods
--     where coalesce(is_training_camp,false) or coalesce(is_altitude_period,false);
--   select count(*) from public.season_markings where source_period_id is not null;
-- Stikkprøve (datoer/navn/moh skal matche kilden):
--   select m.name, m.start_date, m.end_date, m.is_training_camp, m.is_altitude,
--          m.location, m.altitude_meters, p.name as kilde
--   from public.season_markings m
--   join public.season_periods p on p.id = m.source_period_id
--   limit 20;
