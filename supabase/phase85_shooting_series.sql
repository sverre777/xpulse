-- Fase 85 (kø #48 SKYTING-LØFT, bolk 1): SERIEMODELL for skyting.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Idempotent.
--
-- DATAMODELL-VALG (rapporteres):
--  · Skyting-blokk = workout_activities-rad (uendret tidslinje-premiss).
--    Blokk-TYPE er NY dimensjon (shooting_type); activity_type består
--    urørt for tidslinje/bakoverkomp — posisjon UTLEDES nå av seriene.
--  · Serier = NY barnetabell workout_shooting_series (samme reinsert-
--    mønster som øvelser: aktiviteter delete+insert per lagring, barn
--    settes inn med returnerte id-er; cascade rydder).
--  · Blokk-total skytetid GJENBRUKER workout_activities.duration_seconds
--    (holdes allerede utenfor treningstid — ingen ny kolonne, full paritet).
--  · Auto-markeringene 🏁/⏱ LAGRES IKKE — utledes av workouts.workout_type
--    ('competition'/'testlop') ved lesing → følger økta begge veier gratis.
--    Manuelle markeringer (innskyting, 🧪 skytetest) er kolonner.
--  · NSSF-standardmalene (bolk 4) ligger STATISK I KODE (låst bibliotek,
--    som standard-øvelsene); kun EGNE maler får DB-tabell. Referansen er
--    text (kodenøkkel 'nssf1'.. eller uuid) — shooting_test_ref.
--  · Årsskuddmål på sesongen + månedsplanlagte skudd på monthly_volume_plans
--    (brukerpresisering 2026-08-15: tørrtrening planlegges/telles i TID,
--    skudd kan planlegges per måned, valgfritt per type).

-- ── 1. Serietabell ──────────────────────────────────────────
create table if not exists public.workout_shooting_series (
  id               uuid primary key default uuid_generate_v4(),
  activity_id      uuid not null references public.workout_activities(id) on delete cascade,
  series_no        int not null,
  position         text not null default 'L' check (position in ('L', 'S')),
  shots            int not null default 5 check (shots > 0),
  hits             int check (hits >= 0),
  time_seconds     numeric check (time_seconds >= 0),
  avg_heart_rate   int,
  max_heart_rate   int,
  note             text,
  -- Skuddplott: [{"x":0..1,"y":0..1}, ...] i skudd-rekkefølge (bolk 3).
  shot_plot        jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists workout_shooting_series_activity_idx
  on public.workout_shooting_series(activity_id, series_no);

alter table public.workout_shooting_series enable row level security;

-- RLS speiler workout-tabellene (phase29-mønsteret): eier alt; coach les
-- via aktiv relasjon, coach skriv via can_edit_plan (eneste edit-flagg for
-- økt-skriving — det finnes ikke noe can_edit_dagbok-flagg).
drop policy if exists "Own shooting series" on public.workout_shooting_series;
create policy "Own shooting series"
  on public.workout_shooting_series for all
  using (exists (
    select 1 from public.workout_activities a
    join public.workouts w on w.id = a.workout_id
    where a.id = activity_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_activities a
    join public.workouts w on w.id = a.workout_id
    where a.id = activity_id and w.user_id = auth.uid()
  ));

drop policy if exists "Coach reads athlete shooting series" on public.workout_shooting_series;
create policy "Coach reads athlete shooting series"
  on public.workout_shooting_series for select
  using (exists (
    select 1 from public.workout_activities a
    join public.workouts w on w.id = a.workout_id
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where a.id = activity_id and r.coach_id = auth.uid() and r.status = 'active'
  ));

drop policy if exists "Coach writes athlete shooting series" on public.workout_shooting_series;
create policy "Coach writes athlete shooting series"
  on public.workout_shooting_series for all
  using (exists (
    select 1 from public.workout_activities a
    join public.workouts w on w.id = a.workout_id
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where a.id = activity_id and r.coach_id = auth.uid() and r.status = 'active'
      and r.can_edit_plan = true
  ))
  with check (exists (
    select 1 from public.workout_activities a
    join public.workouts w on w.id = a.workout_id
    join public.coach_athlete_relations r on r.athlete_id = w.user_id
    where a.id = activity_id and r.coach_id = auth.uid() and r.status = 'active'
      and r.can_edit_plan = true
  ));

grant select, insert, update, delete on public.workout_shooting_series to authenticated;
grant all on public.workout_shooting_series to service_role;

-- ── 2. Blokk-felter på workout_activities ───────────────────
alter table public.workout_activities
  add column if not exists shooting_type text
    check (shooting_type is null or shooting_type in
      ('basisskyting', 'rolig_komb', 'hard_komb', 'hurtighet_komb', 'torrtrening')),
  add column if not exists shooting_is_innskyting boolean not null default false,
  add column if not exists shooting_is_test boolean not null default false,
  add column if not exists shooting_surface text
    check (shooting_surface is null or shooting_surface in ('papp', 'metall', 'issf')),
  add column if not exists shooting_test_ref text;

-- ── 3. Egne skytetest-maler (standardbiblioteket bor i kode) ─
create table if not exists public.shooting_test_templates (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  -- Oppsett: {series: [{position:'L'|'S', shots:int}...], surface, use_pulse,
  --           use_time, scoring: 'treff'|'ring'|'poeng', krav?: {...}}
  config      jsonb not null,
  created_at  timestamptz not null default now()
);
alter table public.shooting_test_templates enable row level security;
drop policy if exists "Own shooting test templates" on public.shooting_test_templates;
create policy "Own shooting test templates"
  on public.shooting_test_templates for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.shooting_test_templates to authenticated;
grant all on public.shooting_test_templates to service_role;

-- ── 4. Årsskuddmål + månedsplanlagte skudd ──────────────────
alter table public.seasons
  add column if not exists annual_shot_goal int
    check (annual_shot_goal is null or annual_shot_goal > 0);

-- Brukerpresisering: skudd planlegges per måned (som timer/km); tørrtrening
-- planlegges i TID (minutter); valgfri per-type-nedbryting ({type: skudd}).
alter table public.monthly_volume_plans
  add column if not exists planned_shots int
    check (planned_shots is null or planned_shots >= 0),
  add column if not exists planned_dry_minutes int
    check (planned_dry_minutes is null or planned_dry_minutes >= 0),
  add column if not exists planned_shots_by_type jsonb;

-- ── 5. MIGRERING (idempotent — kun aktiviteter uten serier) ──
-- Semantikk bevares eksakt: aggregatene blir ÉN L-serie og/eller ÉN S-serie
-- med samme skudd/treff-tall (ingen kunstig 5-deling → statistikk-paritet
-- garantert). Posisjon fra gammel activity_type; puls/tid består på blokken.
--  · skyting_basis  → shooting_type='basisskyting'
--  · is_dry_training → shooting_type='torrtrening' (flagget består urørt
--    som kolonne for rollback; kode leser typen)
--  · skyting_innskyting → shooting_is_innskyting=true
--  · rolig/hard/hurtighet kan ikke utledes historisk → shooting_type NULL
--    på øvrige migrerte (UI viser «sett type»-hint) — RAPPORTERT AVVIK.

update public.workout_activities
  set shooting_type = case
    when is_dry_training = true then 'torrtrening'
    when activity_type = 'skyting_basis' then 'basisskyting'
    else shooting_type
  end
  where activity_type in ('skyting_liggende','skyting_staaende','skyting_kombinert','skyting_innskyting','skyting_basis')
    and shooting_type is null;

update public.workout_activities
  set shooting_is_innskyting = true
  where activity_type = 'skyting_innskyting'
    and shooting_is_innskyting = false;

-- L-serier fra prone-aggregatene (kun der serier ikke finnes fra før):
insert into public.workout_shooting_series (activity_id, series_no, position, shots, hits)
select a.id, 1, 'L', a.prone_shots, a.prone_hits
from public.workout_activities a
where a.activity_type in ('skyting_liggende','skyting_staaende','skyting_kombinert','skyting_innskyting','skyting_basis')
  and coalesce(a.prone_shots, 0) > 0
  and not exists (select 1 from public.workout_shooting_series s where s.activity_id = a.id);

-- S-serier (series_no 2 hvis L finnes, ellers 1):
insert into public.workout_shooting_series (activity_id, series_no, position, shots, hits)
select a.id,
  case when coalesce(a.prone_shots, 0) > 0 then 2 else 1 end,
  'S', a.standing_shots, a.standing_hits
from public.workout_activities a
where a.activity_type in ('skyting_liggende','skyting_staaende','skyting_kombinert','skyting_innskyting','skyting_basis')
  and coalesce(a.standing_shots, 0) > 0
  and not exists (
    select 1 from public.workout_shooting_series s
    where s.activity_id = a.id and s.position = 'S'
  );

notify pgrst, 'reload schema';

-- ── VERIFISERING (kjør manuelt, sammenlign FØR og ETTER) ────
-- A) Skudd/treff-paritet (skal være identisk):
--   select sum(coalesce(prone_shots,0)) L_skudd, sum(coalesce(prone_hits,0)) L_treff,
--          sum(coalesce(standing_shots,0)) S_skudd, sum(coalesce(standing_hits,0)) S_treff
--   from public.workout_activities
--   where activity_type like 'skyting%';
--   select position, sum(shots) skudd, sum(coalesce(hits,0)) treff, count(*) serier
--   from public.workout_shooting_series group by position;
-- B) Gamle workout_shooting_blocks (UI-løs legacy — migreres IKKE her;
--    rapporter antall, tas stilling i bolk 2 hvis > 0):
--   select count(*) from public.workout_shooting_blocks;
-- C) Høydemeter på skyting-blokker (skjules i UI, slettes ikke — rapporter):
--   select count(*) from public.workout_activities
--   where activity_type like 'skyting%'
--     and (coalesce(elevation_gain_m,0) > 0 or coalesce(elevation_loss_m,0) > 0);
-- D) Type-fordeling etter migrering:
--   select shooting_type, count(*) from public.workout_activities
--   where activity_type like 'skyting%' group by shooting_type;
