-- Fase 92 (kø #52 bolk 5): trener-tilgang til helse og søvn i RLS.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Idempotent; ingen rader endres.
--
-- KJØRING: hele fila i ett. STEG 1 lesing · STEG 2 én do-blokk · STEG 3 lesing.
-- Ingen temp-tabeller.
--
-- ══ VIKTIG FUNN — INGEN NYE FLAGG ══════════════════════════
--
-- Bestillingen ba om «nytt granulært flagg (can_view_helse eller tilsvarende)».
-- Kartleggingen viste at flagget ALLEREDE FINNES:
--
--   coach_data_permissions.can_see_health_data  (fase 59)
--     · én rad per trener-utøver-relasjon, default FALSE
--     · utøveren styrer den selv i /app/innstillinger/trener
--     · brukes allerede til å skjule helse-fanen og helse-KPIene i analysen
--
-- Å legge til `can_view_helse` ved siden av ville gitt to sannheter om hvem som
-- får se helse — nøyaktig samme klasse feil som `imported_from` ga oss i #51.
-- Denne migreringen bygger derfor på det eksisterende flagget.
--
-- ══ HULLET DEN LUKKER ══════════════════════════════════════
--
-- Flagget håndheves i dag KUN i UI-laget: analysen skjuler helse-fanen når det
-- er av. RLS-policyen på daily_health krever bare en aktiv relasjon. En trener
-- med API-tilgang kunne altså lese utøverens hvilepuls, HRV, søvn og vekt selv
-- med delingen avslått. Etter denne migreringen håndheves flagget i databasen.
--
-- KONSEKVENS: trenere som i dag ser helsedata i analysen, mister dem til
-- utøveren slår på deling — men det er nettopp det bryteren allerede lover at
-- den gjør. Ingen utøver mister noe: egen føring og egen visning er urørt.
--
-- Trener får KUN lesetilgang. Ingen with_check noe sted — helse og søvn kan
-- bare skrives av utøveren selv. Assertions verifiserer begge deler.


-- ══ STEG 1 — FØR-TILSTAND (ren lesing) ══════════════════════
select
  (select count(*) from public.coach_athlete_relations where status = 'active')  as aktive_relasjoner,
  (select count(*) from public.coach_data_permissions)                           as delings_rader,
  (select count(*) from public.coach_data_permissions where can_see_health_data) as med_helsedeling,
  (select count(*) from public.daily_health)                                     as daily_health_rader,
  (select count(*) from public.sleep_records)                                    as sleep_rader,
  (select count(*) from public.health_metrics)                                   as metrics_rader,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('daily_health','sleep_records','health_metrics','health_brand_metrics')
      and coalesce(qual, '') like '%coach_athlete_relations%')                    as trenerpolicyer,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('daily_health','sleep_records','health_metrics','health_brand_metrics')
      and coalesce(qual, '') like '%can_see_health_data%')                        as policyer_med_helseflagg;


-- ══ STEG 2 — ENDRINGENE (ett statement, én transaksjon) ═════
do $$
declare
  b_health     bigint;
  b_sleep      bigint;
  b_metrics    bigint;
  b_brand      bigint;
  b_perm       bigint;
  a_health     bigint;
  a_sleep      bigint;
  a_metrics    bigint;
  a_brand      bigint;
  a_perm       bigint;
  udekket      text;
begin
  select count(*) into b_health from public.daily_health;
  select count(*) into b_sleep from public.sleep_records;
  select count(*) into b_metrics from public.health_metrics;
  select count(*) into b_brand from public.health_brand_metrics;
  select count(*) into b_perm from public.coach_data_permissions;
  raise notice 'FØR: daily_health % · sleep % · metrics % · brand % · delings-rader %',
    b_health, b_sleep, b_metrics, b_brand, b_perm;

  -- Fase 59-tabellen må finnes — hele migreringen bygger på den.
  if to_regclass('public.coach_data_permissions') is null then
    raise exception 'Avbryter: coach_data_permissions (fase 59) finnes ikke. Kjør den først.';
  end if;

  -- ── Trener-LESING av helse og søvn, betinget av delings-flagget ──
  -- Kun `for select`. Ingen with_check: trener skal aldri kunne skrive.
  drop policy if exists "Coach reads athlete sleep" on public.sleep_records;
  create policy "Coach reads athlete sleep"
    on public.sleep_records for select
    using (exists (
      select 1
      from public.coach_athlete_relations r
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id
      where r.athlete_id = sleep_records.user_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
        and p.can_see_health_data = true
    ));

  drop policy if exists "Coach reads athlete health metrics" on public.health_metrics;
  create policy "Coach reads athlete health metrics"
    on public.health_metrics for select
    using (exists (
      select 1
      from public.coach_athlete_relations r
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id
      where r.athlete_id = health_metrics.user_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
        and p.can_see_health_data = true
    ));

  drop policy if exists "Coach reads athlete brand health" on public.health_brand_metrics;
  create policy "Coach reads athlete brand health"
    on public.health_brand_metrics for select
    using (exists (
      select 1
      from public.coach_athlete_relations r
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id
      where r.athlete_id = health_brand_metrics.user_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
        and p.can_see_health_data = true
    ));

  -- ── Lukker hullet på daily_health ─────────────────────────
  -- Dagens policy krever kun aktiv relasjon; delings-bryteren var UI-only.
  drop policy if exists "Coach reads athlete health" on public.daily_health;
  create policy "Coach reads athlete health"
    on public.daily_health for select
    using (exists (
      select 1
      from public.coach_athlete_relations r
      join public.coach_data_permissions p on p.coach_athlete_relation_id = r.id
      where r.athlete_id = daily_health.user_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
        and p.can_see_health_data = true
    ));

  -- ── ETTER-telling + assertions ────────────────────────────
  select count(*) into a_health from public.daily_health;
  select count(*) into a_sleep from public.sleep_records;
  select count(*) into a_metrics from public.health_metrics;
  select count(*) into a_brand from public.health_brand_metrics;
  select count(*) into a_perm from public.coach_data_permissions;
  raise notice 'ETTER: daily_health % · sleep % · metrics % · brand % · delings-rader %',
    a_health, a_sleep, a_metrics, a_brand, a_perm;

  -- 1. Ingen data rørt. Migreringen endrer kun policyer.
  if a_health <> b_health or a_sleep <> b_sleep or a_metrics <> b_metrics
     or a_brand <> b_brand or a_perm <> b_perm then
    raise exception 'Verifisering feilet: rad-antall endret (health %→%, sleep %→%, metrics %→%, brand %→%, perm %→%)',
      b_health, a_health, b_sleep, a_sleep, b_metrics, a_metrics, b_brand, a_brand, b_perm, a_perm;
  end if;

  -- 2. Alle fire helse-tabellene har trener-policy som krever delings-flagget.
  select string_agg(t, ', ') into udekket
  from unnest(array['daily_health','sleep_records','health_metrics','health_brand_metrics']) as t
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = t
      and coalesce(p.qual, '') like '%can_see_health_data%'
  );
  if udekket is not null then
    raise exception 'Verifisering feilet: mangler delings-flagg i trener-policy på: %', udekket;
  end if;

  -- 3. Ingen trener-policy uten flagget står igjen (det var hullet).
  select string_agg(policyname || ' (' || tablename || ')', ', ') into udekket
  from pg_policies
  where schemaname = 'public'
    and tablename in ('daily_health','sleep_records','health_metrics','health_brand_metrics')
    and coalesce(qual, '') like '%coach_athlete_relations%'
    and coalesce(qual, '') not like '%can_see_health_data%';
  if udekket is not null then
    raise exception 'Verifisering feilet: trener-policy uten delings-flagg finnes fortsatt: %', udekket;
  end if;

  -- 4. Trener kan ikke SKRIVE helse eller søvn noe sted.
  select string_agg(policyname || ' (' || tablename || ')', ', ') into udekket
  from pg_policies
  where schemaname = 'public'
    and tablename in ('daily_health','sleep_records','health_metrics','health_brand_metrics')
    and coalesce(with_check, '') like '%coach_athlete_relations%';
  if udekket is not null then
    raise exception 'Verifisering feilet: trener kan skrive helsedata via: %', udekket;
  end if;

  -- 5. Utøverens egen tilgang er urørt: hver tabell har fortsatt en eier-policy.
  select string_agg(t, ', ') into udekket
  from unnest(array['daily_health','sleep_records','health_metrics','health_brand_metrics']) as t
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = t
      and coalesce(p.qual, '') like '%auth.uid()%'
      and coalesce(p.qual, '') not like '%coach_athlete_relations%'
  );
  if udekket is not null then
    raise exception 'Verifisering feilet: eier-policy mangler på: %', udekket;
  end if;

  raise notice 'OK: delings-flagget håndheves nå i databasen på alle fire helse-tabellene. Ingen data endret.';
  perform pg_notify('pgrst', 'reload schema');
end $$;


-- ══ STEG 3 — ETTER-TILSTAND (samme query som STEG 1) ════════
-- Forventet: alle rad-tall uendret · trenerpolicyer = 4 ·
-- policyer_med_helseflagg 0 → 4.
select
  (select count(*) from public.coach_athlete_relations where status = 'active')  as aktive_relasjoner,
  (select count(*) from public.coach_data_permissions)                           as delings_rader,
  (select count(*) from public.coach_data_permissions where can_see_health_data) as med_helsedeling,
  (select count(*) from public.daily_health)                                     as daily_health_rader,
  (select count(*) from public.sleep_records)                                    as sleep_rader,
  (select count(*) from public.health_metrics)                                   as metrics_rader,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('daily_health','sleep_records','health_metrics','health_brand_metrics')
      and coalesce(qual, '') like '%coach_athlete_relations%')                    as trenerpolicyer,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('daily_health','sleep_records','health_metrics','health_brand_metrics')
      and coalesce(qual, '') like '%can_see_health_data%')                        as policyer_med_helseflagg;


-- ── TILBAKERULLING ─────────────────────────────────────────
-- Gjenoppretter dagens (svakere) oppførsel på daily_health og fjerner
-- trener-lesing av de nye tabellene:
--
--   drop policy if exists "Coach reads athlete health" on public.daily_health;
--   create policy "Coach reads athlete health"
--     on public.daily_health for select
--     using (exists (
--       select 1 from public.coach_athlete_relations
--       where coach_id = auth.uid() and athlete_id = daily_health.user_id
--         and status = 'active'));
--   drop policy if exists "Coach reads athlete sleep" on public.sleep_records;
--   drop policy if exists "Coach reads athlete health metrics" on public.health_metrics;
--   drop policy if exists "Coach reads athlete brand health" on public.health_brand_metrics;
--   notify pgrst, 'reload schema';
