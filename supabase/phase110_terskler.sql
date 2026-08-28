-- ============================================================
-- Fase 110 — Prestasjonsmodellen bolk 1: terskler som data
-- Fasit: design/xpulse-terskler-design.html (visning I) + planprompt.
--
-- Målt i prod 28. aug (32 profiler):
--   · profiles.lactate_threshold_hr: satt hos 1 bruker (global terskel)
--   · profiles.max_heart_rate: 5 · resting_heart_rate: 2 (blir stående
--     i helse-gruppa — flyttes ikke av denne fasen)
--   · user_heart_zones: 15 rader hos 3 brukere (globale egne soner)
--   · bevegelsesnøkler = tekstnavn (movement_name/-subcategory), 33
--     distinkte par i bruk
--
-- To grep:
--   1) user_thresholds — ÉN fasit-tabell bruker × bevegelsesform ×
--      underkategori, VERSJONERT med valid_from. Aldri UPDATE av
--      verdier: ny verdi = ny rad. En økt bruker raden med størst
--      valid_from ≤ øktas dato; underkategori arver fra
--      bevegelsesform ('' = hele formen), og '' + '' er globalt
--      fallback-nivå (kun migreringen skriver dit).
--   2) user_heart_zones får movement-nøkkel ('' = global = dagens
--      rader). Egne soner per bevegelsesform = rader med navn;
--      toggle AV = slett radene for nøkkelen (OT-standard gjelder).
-- Idempotent. KJØRES IKKE før Sverre har godkjent.
-- ============================================================

create table if not exists public.user_thresholds (
  id                     uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references public.profiles(id)
                           on delete cascade,
  movement_name          text not null default '',
  movement_subcategory   text not null default '',
  threshold_hr           integer not null
                           check (threshold_hr between 60 and 250),
  -- Terskelfart i sek/km (3:12/km = 192). Valgfri — tom er lov der
  -- fart ikke gir mening (kupert langrenn).
  threshold_pace_sec_km  numeric(6,1)
                           check (threshold_pace_sec_km is null
                                  or threshold_pace_sec_km > 0),
  ftp_watts              integer
                           check (ftp_watts is null
                                  or ftp_watts between 30 and 1000),
  valid_from             date not null default current_date,
  created_at             timestamptz not null default now(),
  -- Sporbarhet når trener skriver (delt innstilling, aldri kopi).
  created_by             uuid references public.profiles(id)
                           on delete set null,
  unique (user_id, movement_name, movement_subcategory, valid_from)
);

create index if not exists user_thresholds_oppslag_idx
  on public.user_thresholds
  (user_id, movement_name, movement_subcategory, valid_from desc);

alter table public.user_thresholds enable row level security;

drop policy if exists "Egne terskler" on public.user_thresholds;
create policy "Egne terskler"
  on public.user_thresholds for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trener med plan-rett leser OG skriver — SAMME innstilling som
-- utøveren, aldri en trener-kopi (delt innstilling-prinsippet).
drop policy if exists "Trener med plan-rett" on public.user_thresholds;
create policy "Trener med plan-rett"
  on public.user_thresholds for all
  using (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan
  ))
  with check (exists (
    select 1 from public.coach_athlete_relations r
    where r.athlete_id = user_id
      and r.coach_id   = auth.uid()
      and r.status     = 'active'
      and r.can_edit_plan
  ));

-- ── user_heart_zones: movement-nøkkel ('' = global, dagens rader) ──
alter table public.user_heart_zones
  add column if not exists movement_name text not null default '';
alter table public.user_heart_zones
  add column if not exists movement_subcategory text not null default '';

-- Gammel unique (user_id, zone_name) må vike for nøkkelen med
-- bevegelsesform. Navnet er fra opprinnelig create table.
do $uz$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'user_heart_zones_user_id_zone_name_key'
  ) then
    alter table public.user_heart_zones
      drop constraint user_heart_zones_user_id_zone_name_key;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_heart_zones_nokkel_key'
  ) then
    alter table public.user_heart_zones
      add constraint user_heart_zones_nokkel_key
      unique (user_id, movement_name, movement_subcategory, zone_name);
  end if;
end $uz$;

-- ── Migrering: global terskel → første versjon i tabellen ──
-- FØR (kjør separat):
--   select id, lactate_threshold_hr from public.profiles
--    where lactate_threshold_hr is not null;
-- Forventet: 1 rad (målt 28. aug).
do $mig$
declare
  v_n int;
begin
  insert into public.user_thresholds
    (user_id, movement_name, movement_subcategory, threshold_hr,
     valid_from)
  select p.id, '', '', p.lactate_threshold_hr, current_date
    from public.profiles p
   where p.lactate_threshold_hr is not null
     and not exists (
       select 1 from public.user_thresholds t
       where t.user_id = p.id
         and t.movement_name = ''
         and t.movement_subcategory = ''
     );
  get diagnostics v_n = row_count;
  raise notice 'Migrert % global(e) terskel(er) som første versjon', v_n;

  -- Assertion: hver profil med gammel terskel har nå en tabellrad.
  select count(*) into v_n from public.profiles p
   where p.lactate_threshold_hr is not null
     and not exists (
       select 1 from public.user_thresholds t where t.user_id = p.id
     );
  if v_n <> 0 then
    raise exception '% profiler med terskel mangler tabellrad', v_n;
  end if;
end $mig$;

-- profiles.lactate_threshold_hr BEHOLDES inntil videre (leses av
-- eksisterende soneberegning til bolkene bytter kilde) — men skrives
-- ikke lenger fra ny UI. Kolonnen pensjoneres i senere bolk.

-- ETTER (kjør separat):
--   select user_id, movement_name, movement_subcategory,
--          threshold_hr, valid_from
--     from public.user_thresholds order by user_id;
--   select count(*) as globale_sonerader
--     from public.user_heart_zones where movement_name = '';
-- Forventet: 1 terskelrad ('' × '' — globalnivå) · 15 globale
-- sonerader (uendret hos de 3 brukerne).

notify pgrst, 'reload schema';
