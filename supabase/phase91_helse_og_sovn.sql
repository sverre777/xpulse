-- Fase 91 (kø #52 HELSEDATA OG SØVN, bolk 1): fellesfelt-lag + merkespesifikt lag.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Idempotent; ingen data endres.
--
-- (Nummeret 90 er hoppet over med vilje: phase90 var utvidelsen av
-- workout_activities.distance_meters, som ble forkastet da prod-sjekken viste
-- at kolonnen allerede var numeric(10,2). Å gjenbruke nummeret ville gitt to
-- ulike ting som het «phase90» i samtalen vår.)
--
-- KJØRING: hele fila i ett. Tre steg, ingen temp-tabeller:
--   STEG 1 — FØR-tilstand   (ren lesing)
--   STEG 2 — endringene     (ÉN do-blokk = ett statement = én transaksjon)
--   STEG 3 — ETTER-tilstand (samme query som STEG 1)
--
-- ══ HVA DENNE MIGRERINGEN GJØR — OG IKKE GJØR ══════════════
--
-- GJØR: oppretter TRE nye, tomme tabeller.
-- GJØR IKKE: rører ikke én eneste eksisterende tabell, kolonne, policy eller rad.
--
-- Spesielt: `daily_health` er URØRT. Den er i dag skrevet av helse-skjemaet
-- (components/health/HealthForm.tsx → app/actions/health.ts) og lest av seks
-- flater (dagbok-kalender, hjem/oversikt, to analyse-funksjoner,
-- helse-mini-dashboard og data-eksporten). Alle fortsetter å lese nøyaktig
-- samme kolonner med nøyaktig samme tall. Assertions nederst verifiserer det.
--
-- ══ DATAMODELL-VALG (rapporteres) ══════════════════════════
--
--  · TO LAG, slik bestillingen beskriver:
--      fellesfelt-lag  = sleep_records + health_metrics. Felter som praktisk
--                        talt alle merker har, som KAN føres manuelt, og som
--                        er sammenlignbare på tvers av kilder.
--      merkespesifikt  = health_brand_metrics. Proprietære skårer med ulik
--                        algoritme og skala (Polar Nightly Recharge, senere
--                        Garmin Body Battery osv). Kun import, aldri manuell
--                        føring, aldri blandet inn i felles trendlinjer.
--
--  · KILDE PER VERDI løses med `sources jsonb` — én nøkkel per felt, verdien
--    er kilde-id: {"total_sleep_minutes":"polar","perceived_quality":"manual"}.
--    Alternativet (én *_source-kolonne per felt) ville gitt 10+ ekstra
--    kolonner per tabell og en ny kolonne hver gang et felt kommer til.
--    Gyldige kilde-verdier: 'manual','polar','garmin','suunto','coros',
--    'whoop','oura','fit_upload'. Mangler nøkkelen, er verdien ikke ført.
--
--  · daily_health BEHOLDES som det manuelle laget. De nye tabellene er ikke
--    en erstatning, og migreringen flytter INGEN data. «Manuell verdi vinner»
--    løses ved LESING i bolk 4 (manuell verdi fra daily_health slår importert
--    verdi fra det nye laget), ikke ved å overskrive noe ved skriving. Da kan
--    en import aldri ødelegge noe brukeren har ført — og dagens analyse ser
--    nøyaktig de samme tallene som før, fordi den leser daily_health.
--
--  · sleep_records.date = datoen du VÅKNET. Leggetiden ligger normalt kvelden
--    før og lagres som fullt tidspunkt (timestamptz), så vi slipper å gjette
--    hvilken dato en «23:40» hører til.
--
--  · RLS: KUN eieren. Ingen trener-policy på noen av de tre tabellene.
--    Dette er helsedata (GDPR art. 9, særlige kategorier) og skal være
--    fail-closed: trener ser ingenting før det granulære delings-flagget
--    kommer i bolk 5. Assertions verifiserer at ingen trener-policy finnes.
--
--  · KALORIER ER BEVISST UTELATT — ingen kolonne for forbrenning,
--    aktivitetskalorier eller BMR, verken her eller i importen. Tallene er
--    estimater med stor spredning mellom merker, de er ikke sammenlignbare,
--    og de hører ikke hjemme i et verktøy for utholdenhetsutøvere.
--    Legg dem ikke til senere uten at det er en bevisst, ny beslutning.
--
--  · KARTDATA HENTES IKKE (gjelder hele bestillingen) — ingen rute-kolonner.


-- ══ STEG 1 — FØR-TILSTAND (ren lesing) ══════════════════════
select
  (select count(*) from public.daily_health)                                  as daily_health_rader,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_health')            as daily_health_kolonner,
  (select count(*) from public.recovery_entries)                              as recovery_rader,
  (select count(*) from public.day_states)                                    as day_states_rader,
  (to_regclass('public.sleep_records') is not null)                           as sleep_records_finnes,
  (to_regclass('public.health_metrics') is not null)                          as health_metrics_finnes,
  (to_regclass('public.health_brand_metrics') is not null)                    as brand_metrics_finnes;


-- ══ STEG 2 — ENDRINGENE (ett statement, én transaksjon) ═════
do $$
declare
  b_health_rader   bigint;
  b_health_kol     bigint;
  b_recovery       bigint;
  b_daystates      bigint;
  a_health_rader   bigint;
  a_health_kol     bigint;
  a_recovery       bigint;
  a_daystates      bigint;
  n_rader          bigint;
  rls_mangler      text;
  trener_policy    text;
  manglende_kol    text;
begin
  -- ── a) FØR-telling ────────────────────────────────────────
  select count(*) into b_health_rader from public.daily_health;
  select count(*) into b_health_kol from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_health';
  select count(*) into b_recovery from public.recovery_entries;
  select count(*) into b_daystates from public.day_states;

  raise notice 'FØR: daily_health % rader / % kolonner · recovery_entries % · day_states %',
    b_health_rader, b_health_kol, b_recovery, b_daystates;

  -- ── b) Fellesfelt-lag: søvn (én rad per natt) ─────────────
  create table if not exists public.sleep_records (
    id                   uuid primary key default uuid_generate_v4(),
    user_id              uuid not null references auth.users(id) on delete cascade,
    -- Datoen du VÅKNET. Leggetid ligger normalt kvelden før.
    date                 date not null,
    sleep_start          timestamptz,
    sleep_end            timestamptz,
    total_sleep_minutes  integer check (total_sleep_minutes is null or total_sleep_minutes between 0 and 1440),
    awake_minutes        integer check (awake_minutes is null or awake_minutes between 0 and 1440),
    interruptions        integer check (interruptions is null or interruptions >= 0),
    deep_minutes         integer check (deep_minutes is null or deep_minutes between 0 and 1440),
    light_minutes        integer check (light_minutes is null or light_minutes between 0 and 1440),
    rem_minutes          integer check (rem_minutes is null or rem_minutes between 0 and 1440),
    -- Samme 1–5-skala som daily_health.sleep_quality, så egen opplevelse er
    -- sammenlignbar med det brukeren allerede har ført.
    perceived_quality    integer check (perceived_quality is null or perceived_quality between 1 and 5),
    -- Kilde per verdi: {"total_sleep_minutes":"polar","perceived_quality":"manual"}
    sources              jsonb not null default '{}'::jsonb,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    unique (user_id, date)
  );

  create index if not exists sleep_records_user_date_idx
    on public.sleep_records (user_id, date desc);

  -- ── c) Fellesfelt-lag: helse/aktivitet (én rad per dag) ───
  -- MERK: ingen kalori-kolonner. Se toppen av fila.
  create table if not exists public.health_metrics (
    id                   uuid primary key default uuid_generate_v4(),
    user_id              uuid not null references auth.users(id) on delete cascade,
    date                 date not null,
    -- puls
    resting_hr           integer check (resting_hr is null or resting_hr between 20 and 150),
    hrv_ms               numeric(6,1) check (hrv_ms is null or hrv_ms >= 0),
    max_hr               integer check (max_hr is null or max_hr between 60 and 250),
    -- kropp
    body_weight_kg       numeric(5,2) check (body_weight_kg is null or body_weight_kg > 0),
    -- daglig aktivitet (IKKE trening — det ligger i workouts)
    steps                integer check (steps is null or steps >= 0),
    active_minutes       integer check (active_minutes is null or active_minutes between 0 and 1440),
    inactive_minutes     integer check (inactive_minutes is null or inactive_minutes between 0 and 1440),
    daily_distance_m     numeric(10,2) check (daily_distance_m is null or daily_distance_m >= 0),
    stairs_climbed       integer check (stairs_climbed is null or stairs_climbed >= 0),
    daily_elevation_m    integer check (daily_elevation_m is null or daily_elevation_m >= 0),
    -- Kilde per verdi, samme format som sleep_records.
    sources              jsonb not null default '{}'::jsonb,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    unique (user_id, date)
  );

  create index if not exists health_metrics_user_date_idx
    on public.health_metrics (user_id, date desc);

  -- ── d) Merkespesifikt lag ─────────────────────────────────
  -- Proprietære skårer med ulik algoritme og skala. Kun import. Holdes utenfor
  -- felles trendlinjer, og vises alltid med merkenavn. Slettes i sin helhet
  -- ved frakobling av merket (delete where brand = …), derfor egen tabell og
  -- ikke kolonner i health_metrics.
  create table if not exists public.health_brand_metrics (
    id            uuid primary key default uuid_generate_v4(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    date          date not null,
    brand         text not null check (brand in ('polar','garmin','suunto','coros','whoop','oura')),
    -- F.eks. {"nightly_recharge_status":"good","ans_charge":0.4,"sleep_score":82}
    metrics       jsonb not null default '{}'::jsonb,
    imported_at   timestamptz not null default now(),
    unique (user_id, date, brand)
  );

  create index if not exists health_brand_metrics_user_date_idx
    on public.health_brand_metrics (user_id, date desc);

  -- ── e) RLS: KUN eieren. Ingen trener-policy (fail-closed) ─
  alter table public.sleep_records enable row level security;
  alter table public.health_metrics enable row level security;
  alter table public.health_brand_metrics enable row level security;

  drop policy if exists "Own sleep records" on public.sleep_records;
  create policy "Own sleep records"
    on public.sleep_records for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  drop policy if exists "Own health metrics" on public.health_metrics;
  create policy "Own health metrics"
    on public.health_metrics for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  drop policy if exists "Own health brand metrics" on public.health_brand_metrics;
  create policy "Own health brand metrics"
    on public.health_brand_metrics for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  grant select, insert, update, delete on public.sleep_records         to authenticated;
  grant select, insert, update, delete on public.sleep_records         to service_role;
  grant select, insert, update, delete on public.health_metrics        to authenticated;
  grant select, insert, update, delete on public.health_metrics        to service_role;
  grant select, insert, update, delete on public.health_brand_metrics  to authenticated;
  grant select, insert, update, delete on public.health_brand_metrics  to service_role;

  -- ── f) ETTER-telling + assertions ─────────────────────────
  select count(*) into a_health_rader from public.daily_health;
  select count(*) into a_health_kol from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_health';
  select count(*) into a_recovery from public.recovery_entries;
  select count(*) into a_daystates from public.day_states;

  raise notice 'ETTER: daily_health % rader / % kolonner · recovery_entries % · day_states %',
    a_health_rader, a_health_kol, a_recovery, a_daystates;

  -- f1. Dagens føring er urørt: verken rader eller kolonner endret.
  if a_health_rader <> b_health_rader or a_health_kol <> b_health_kol then
    raise exception 'Verifisering feilet: daily_health endret (% rader/% kol → % rader/% kol)',
      b_health_rader, b_health_kol, a_health_rader, a_health_kol;
  end if;
  if a_recovery <> b_recovery or a_daystates <> b_daystates then
    raise exception 'Verifisering feilet: recovery_entries (%→%) eller day_states (%→%) endret',
      b_recovery, a_recovery, b_daystates, a_daystates;
  end if;

  -- f2. Kolonnene dagens skjema og lesere bruker finnes fortsatt.
  select string_agg(k, ', ') into manglende_kol
  from unnest(array['resting_hr','hrv_ms','sleep_hours','sleep_quality','body_weight_kg','notes']) as k
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_health' and column_name = k
  );
  if manglende_kol is not null then
    raise exception 'Verifisering feilet: daily_health mangler kolonner: %', manglende_kol;
  end if;

  -- f3. De nye tabellene er tomme — migreringen flytter ingen data.
  select (select count(*) from public.sleep_records)
       + (select count(*) from public.health_metrics)
       + (select count(*) from public.health_brand_metrics) into n_rader;
  if n_rader <> 0 then
    raise exception 'Verifisering feilet: de nye tabellene skal være tomme, fant % rader', n_rader;
  end if;

  -- f4. RLS er på alle tre.
  select string_agg(t, ', ') into rls_mangler
  from unnest(array['sleep_records','health_metrics','health_brand_metrics']) as t
  where not coalesce((select relrowsecurity from pg_class
                       where oid = ('public.' || t)::regclass), false);
  if rls_mangler is not null then
    raise exception 'Verifisering feilet: RLS mangler på: %', rls_mangler;
  end if;

  -- f5. FAIL-CLOSED: ingen policy på de nye tabellene skal gi trener tilgang.
  -- Trener-deling kommer som eget flagg i bolk 5 — til da skal helse og søvn
  -- være utøver-only, uansett can_view_dagbok/can_view_analysis.
  select string_agg(policyname || ' (' || tablename || ')', ', ') into trener_policy
  from pg_policies
  where schemaname = 'public'
    and tablename in ('sleep_records','health_metrics','health_brand_metrics')
    and (coalesce(qual, '') like '%coach_athlete_relations%'
         or coalesce(with_check, '') like '%coach_athlete_relations%');
  if trener_policy is not null then
    raise exception 'Verifisering feilet: trener-tilgang finnes allerede på helse-tabellene: %', trener_policy;
  end if;

  raise notice 'OK: tre nye tomme tabeller, RLS på, ingen trener-tilgang, daily_health urørt.';
  perform pg_notify('pgrst', 'reload schema');
end $$;


-- ══ STEG 3 — ETTER-TILSTAND (samme query som STEG 1) ════════
-- Forventet: identiske tall for daily_health/recovery_entries/day_states,
-- og de tre *_finnes-kolonnene har gått fra false til true.
select
  (select count(*) from public.daily_health)                                  as daily_health_rader,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_health')            as daily_health_kolonner,
  (select count(*) from public.recovery_entries)                              as recovery_rader,
  (select count(*) from public.day_states)                                    as day_states_rader,
  (to_regclass('public.sleep_records') is not null)                           as sleep_records_finnes,
  (to_regclass('public.health_metrics') is not null)                          as health_metrics_finnes,
  (to_regclass('public.health_brand_metrics') is not null)                    as brand_metrics_finnes;


-- ── TILBAKERULLING ─────────────────────────────────────────
-- De tre tabellene er nye og tomme fram til bolk 2, så tilbakerulling er
-- risikofri så lenge ingen import har kjørt:
--
--   drop table if exists public.health_brand_metrics;
--   drop table if exists public.health_metrics;
--   drop table if exists public.sleep_records;
--   notify pgrst, 'reload schema';
--
-- Har importen kjørt, sletter dette importerte helsedata. Manuelt førte
-- verdier i daily_health berøres uansett ikke — de ligger i en annen tabell.
