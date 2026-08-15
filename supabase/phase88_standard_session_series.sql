-- Fase 88 (kø #48 STANDARDØKTER-LØFT, bolk 1): standardøkt-SERIE som egen entitet.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Idempotent; ingenting slettes.
--
-- DATAMODELL-VALG (rapporteres):
--  · Serie = egen rad (standard_session_series), IKKE flagg på økta:
--    navn, sport/bev.form (valgfri), sted (valgfri — «Terskeltest Sognsvann»
--    ≠ terskel på mølle), valgfri mal-kobling, valgfri beskrivelse.
--  · Økter kobles mange-til-én via NY nullable FK workouts.standard_session_series_id.
--  · GAMLE feltene (standard_workout_template_id/template_id) RØRES IKKE —
--    alle dagens flater leser dem uendret til bolk 6-oppryddingen er godkjent.
--  · Sletting av serie skal ALDRI slette økter → FK on delete set null.
--  · RLS: eier alt (user_id); trener KUN LESE via aktiv relasjon m/
--    can_view_analysis (speiler phase85/29-mønsteret — appen går uansett via
--    resolveTargetUser, aldri egen tilgangslogikk).
--
-- MIGRERINGSFORSLAG (kjøres i samme fil, verifisert m/ telling):
--  · Én serie per (bruker, standard_workout_template_id) for økter som er
--    EKSPLISITT TAGGET som standardøkt. Navn/sport/mal-kobling hentes fra
--    malen (FK-en er on delete set null, så refererte maler finnes).
--  · Økter som KUN har template_id («laget fra mal», ikke tagget) migreres
--    IKKE — mal-bruk er ikke standardøkt (kjerneprinsipp 2); de fortsetter
--    å telle i dagens mal-flater som før.

-- ── 1. Serietabellen ────────────────────────────────────────
create table if not exists public.standard_session_series (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  sport         text,
  movement_name text,
  location      text,
  template_id   uuid references public.workout_templates(id) on delete set null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists standard_session_series_user_idx
  on public.standard_session_series (user_id);

alter table public.standard_session_series enable row level security;

drop policy if exists "Own standard session series" on public.standard_session_series;
create policy "Own standard session series"
  on public.standard_session_series for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach reads athlete standard session series" on public.standard_session_series;
create policy "Coach reads athlete standard session series"
  on public.standard_session_series for select
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id and r.coach_id = auth.uid()
      and r.status = 'active' and r.can_view_analysis = true
  ));

grant select, insert, update, delete on public.standard_session_series to authenticated;
grant all on public.standard_session_series to service_role;

-- ── 2. Kobling fra økter (nullable — sletting av serie nuller, aldri kaskade) ──
alter table public.workouts
  add column if not exists standard_session_series_id uuid
    references public.standard_session_series(id) on delete set null;

create index if not exists idx_workouts_standard_session_series_id
  on public.workouts (standard_session_series_id)
  where standard_session_series_id is not null;

-- ── 3. FØR-TELLING ──────────────────────────────────────────
do $$
declare
  n_tagged bigint;
  n_series bigint;
  n_linked bigint;
begin
  select count(*) into n_tagged from public.workouts where standard_workout_template_id is not null;
  select count(*) into n_series from public.standard_session_series;
  select count(*) into n_linked from public.workouts where standard_session_series_id is not null;
  raise notice 'FØR: % taggede økter · % serier · % koblede økter', n_tagged, n_series, n_linked;
end $$;

-- ── 4. MIGRERING: serier fra eksplisitt taggede økter ───────
-- Idempotent: hopper over (bruker, mal)-par som allerede har en serie m/
-- samme mal-kobling.
insert into public.standard_session_series (user_id, name, sport, template_id)
select d.user_id,
       coalesce(t.name, 'Standardøkt'),
       t.sport,
       d.standard_workout_template_id
from (
  select distinct user_id, standard_workout_template_id
  from public.workouts
  where standard_workout_template_id is not null
) d
left join public.workout_templates t on t.id = d.standard_workout_template_id
where not exists (
  select 1 from public.standard_session_series s
  where s.user_id = d.user_id and s.template_id = d.standard_workout_template_id
);

-- Koble taggede økter til seriene (kun der kobling mangler — idempotent).
update public.workouts w
set standard_session_series_id = s.id
from public.standard_session_series s
where s.user_id = w.user_id
  and s.template_id = w.standard_workout_template_id
  and w.standard_workout_template_id is not null
  and w.standard_session_series_id is null;

-- ── 5. ETTER-TELLING + VERIFISERING ────────────────────────
-- Krav: alle taggede økter er koblet til en serie; ingen økter mistet noe
-- (gamle kolonner urørt — verifiseres ved at tagget-antallet er uendret).
do $$
declare
  n_tagged bigint;
  n_series bigint;
  n_linked_tagged bigint;
  n_unlinked bigint;
begin
  select count(*) into n_tagged from public.workouts where standard_workout_template_id is not null;
  select count(*) into n_series from public.standard_session_series;
  select count(*) into n_linked_tagged from public.workouts
    where standard_workout_template_id is not null and standard_session_series_id is not null;
  select count(*) into n_unlinked from public.workouts
    where standard_workout_template_id is not null and standard_session_series_id is null;
  raise notice 'ETTER: % taggede økter · % serier · % taggede m/ seriekobling · % uten', n_tagged, n_series, n_linked_tagged, n_unlinked;
  if n_unlinked > 0 then
    raise exception 'Verifisering feilet: % taggede økter fikk ikke seriekobling', n_unlinked;
  end if;
end $$;

notify pgrst, 'reload schema';
