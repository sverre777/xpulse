-- Fase 89 (kø #51 POLAR ACCESSLINK, bolk 1): datamodell for Polar-klokkesync.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Idempotent; ingenting slettes.
--
-- KJØRING: kjør hele filen (eller ett STEG om gangen for å se tallene).
-- Filen er delt i tre statements:
--   STEG 1 — FØR-telling  (ren lesing, ingen endring)
--   STEG 2 — migreringen  (ÉN do-blokk = ett statement = én transaksjon;
--                          enhver `raise exception` ruller HELE steget tilbake)
--   STEG 3 — ETTER-telling (samme query som STEG 1 — radene skal være like,
--                          bortsett fra source_constraint som nå har 'polar')
--
-- MERK: ingen temp-tabeller. Supabase SQL-editoren kjører statements over en
-- pooled connection, så en temp-tabell fra ett statement finnes ikke i det
-- neste ("relation _polar_migration_before does not exist"). Derfor gjør
-- STEG 2 sin egen før/etter-telling INTERNT i do-blokken og asserter der —
-- STEG 1 og 3 er kun for at du skal SE tallene.
--
-- Filen er idempotent og trygg å kjøre om igjen etter et avbrutt forsøk:
-- `create table if not exists`, `drop policy if exists`, og constrainten
-- slås opp på definisjon (ikke navn) før den byttes.
--
-- TO ENDRINGER, BEGGE ADDITIVE:
--   1. NY tabell public.polar_connections (speiler strava_connections).
--   2. UTVIDET check-constraint på imported_activities.source:
--        ('strava','fit_upload','garmin')  →  (+ 'polar')
--      Ingen rader røres — kun constraint-definisjonen byttes ut.
--
-- INGENTING annet endres: workouts, workout_samples, workout_activities,
-- strava_connections og .fit-opplastingen er urørt.
--
-- DATAMODELL-VALG (rapporteres):
--  · polar_user_id (bigint, unique, not null) = Polars `x_user_id` fra
--    token-responsen. Webhooken identifiserer brukeren KUN med denne, derfor
--    unique + not null. Konsekvens: samme Polar-konto kan ikke kobles til to
--    X-PULSE-brukere — callback må gi forklarende feil (bolk 2).
--  · member_id (text, not null) = det vi sender til POST /v3/users (vår
--    Supabase-user_id). Polar krever unik member-id per klient; vi lagrer den
--    slik den ble sendt, så re-registrering og avregistrering kan matche.
--  · refresh_token + token_expires_at er NULLABLE (avvik fra Strava, bevisst):
--    Polar-dokumentasjonen spriker om token-levetid (evig-til-revokert vs 12t
--    med refresh). null = "ingen kjent utløpstid / ingen refresh tilgjengelig".
--    lib/polar.ts leser faktisk `expires_in` og fyller feltene når de finnes
--    (bolk 2), og logger tydelig når refresh ikke er mulig.
--  · registered_at NULLABLE: OAuth kan lykkes mens POST /v3/users feiler
--    (typisk manglende obligatoriske samtykker hos Polar). Da beholder vi
--    tokenet og lar UI tilby ny registrering, i stedet for at koblingen mistes.
--    registered_at is null  ⇒  "tilkoblet, men ikke ferdig registrert".
--  · last_webhook_at: TATT MED NÅ selv om den først brukes i bolk 4 — Polar
--    deaktiverer webhooken etter 7 døgn med feilende leveranser, så
--    overvåkningen trenger et tidsstempel å måle mot. Slipper en ny migrering.
--  · disconnected_at (finnes på strava_connections) er BEVISST UTELATT:
--    frakobling sletter hele raden (bolk 3), så feltet ville alltid vært null.
--  · Ingen trener-policy — som Strava: tilkoblingen er kun eierens.
--
-- SIKKERHET: Polar-tokens finnes kun i denne tabellen, bak RLS (egen rad).
-- Kun `authenticated` (egen rad) og `service_role` (cron/webhook, ingen
-- bruker-session) har tilgang. Ingen Polar-hemmeligheter i klientkode.


-- ══ STEG 1 — FØR-TELLING (ren lesing) ═══════════════════════
-- Identisk query som STEG 3. Noter radene, eller kjør begge og sammenlign.
select
  (select count(*) from public.imported_activities)                             as imported_total,
  (select count(*) from public.imported_activities where source = 'strava')     as imported_strava,
  (select count(*) from public.imported_activities where source = 'fit_upload') as imported_fit,
  (select count(*) from public.imported_activities where source = 'garmin')     as imported_garmin,
  (select count(*) from public.imported_activities where source = 'polar')      as imported_polar,
  (select count(*) from public.workouts)                                        as workouts_total,
  (select count(*) from public.workouts where imported_from is not null)        as workouts_importert,
  (select count(*) from public.workout_samples)                                 as samples_total,
  (select count(*) from public.strava_connections)                              as strava_conns,
  (to_regclass('public.polar_connections') is not null)                         as polar_tabell_finnes,
  (select relrowsecurity from pg_class
     where oid = to_regclass('public.polar_connections'))                       as polar_rls_på,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'polar_connections')           as polar_policies,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'polar_connections')        as polar_kolonner,
  (select coalesce(string_agg(pg_get_constraintdef(oid), ' | '), '(ingen)')
     from pg_constraint
    where conrelid = 'public.imported_activities'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source%')                           as source_constraint;


-- ══ STEG 2 — MIGRERINGEN (ett statement, én transaksjon) ════
-- Rekkefølge inne i blokken:
--   a) FØR-telling i lokale variabler
--   b) ny tabell + RLS + policy + grants
--   c) forhåndssjekk av ukjente source-verdier (FØR gammel constraint droppes)
--   d) bytt check-constraint
--   e) ETTER-telling + assertions (exception ⇒ alt over rulles tilbake)
--   f) pgrst schema-reload
do $$
declare
  -- FØR
  b_total     bigint; b_strava bigint; b_fit bigint; b_garmin bigint; b_polar bigint;
  b_workouts  bigint; b_wimportert bigint; b_samples bigint; b_strconn bigint;
  b_polconn   bigint := 0;
  b_def       text;
  -- ETTER
  a_total     bigint; a_strava bigint; a_fit bigint; a_garmin bigint; a_polar bigint;
  a_workouts  bigint; a_wimportert bigint; a_samples bigint; a_strconn bigint;
  a_polconn   bigint;
  a_def       text;
  -- diverse
  ukjente     text;
  c           record;
  rls_on      boolean;
  n_policies  int;
begin
  -- ── a) FØR-telling ────────────────────────────────────────
  select count(*) into b_total      from public.imported_activities;
  select count(*) into b_strava     from public.imported_activities where source = 'strava';
  select count(*) into b_fit        from public.imported_activities where source = 'fit_upload';
  select count(*) into b_garmin     from public.imported_activities where source = 'garmin';
  select count(*) into b_polar      from public.imported_activities where source = 'polar';
  select count(*) into b_workouts   from public.workouts;
  select count(*) into b_wimportert from public.workouts where imported_from is not null;
  select count(*) into b_samples    from public.workout_samples;
  select count(*) into b_strconn    from public.strava_connections;
  -- Tabellen finnes ikke ved første kjøring — dynamisk telling for å unngå
  -- parse-feil, og for at en re-kjøring skal telle riktig.
  if to_regclass('public.polar_connections') is not null then
    execute 'select count(*) from public.polar_connections' into b_polconn;
  end if;

  select coalesce(string_agg(pg_get_constraintdef(oid), ' | '), '(ingen)') into b_def
  from pg_constraint
  where conrelid = 'public.imported_activities'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%source%';

  raise notice 'FØR: imported_activities=% (strava=%, fit_upload=%, garmin=%, polar=%) · workouts=% (importert=%) · samples=% · strava_conns=% · polar_conns=%',
    b_total, b_strava, b_fit, b_garmin, b_polar,
    b_workouts, b_wimportert, b_samples, b_strconn, b_polconn;
  raise notice 'FØR: source-constraint = %', b_def;

  -- ── b) Ny tabell: polar_connections ───────────────────────
  create table if not exists public.polar_connections (
    user_id          uuid primary key references auth.users(id) on delete cascade,
    polar_user_id    bigint unique not null,      -- Polars x_user_id
    member_id        text not null,               -- sendt til POST /v3/users
    access_token     text not null,
    refresh_token    text,                        -- null: Polar ga ingen
    token_expires_at timestamptz,                 -- null: ingen kjent utløpstid
    auto_sync        boolean not null default true,
    registered_at    timestamptz,                 -- null: /v3/users ikke fullført
    last_sync_at     timestamptz,
    last_webhook_at  timestamptz,                 -- overvåkning i bolk 4
    created_at       timestamptz not null default now()
  );

  alter table public.polar_connections enable row level security;

  drop policy if exists "Own polar connection" on public.polar_connections;
  create policy "Own polar connection"
    on public.polar_connections for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  grant select, insert, update, delete on public.polar_connections to authenticated;
  grant select, insert, update, delete on public.polar_connections to service_role;

  -- ── c) Forhåndssjekk FØR constrainten byttes ──────────────
  -- Finnes det source-verdier utenfor den nye lista, ville den nye
  -- constrainten avvist dem. Da stopper vi før den gamle droppes, slik at
  -- tabellen aldri står igjen uten constraint.
  select string_agg(distinct source, ', ') into ukjente
  from public.imported_activities
  where source not in ('strava','fit_upload','garmin','polar');
  if ukjente is not null then
    raise exception 'Avbryter: imported_activities.source har ukjente verdier (%). Legg dem inn i constrainten eller rydd dataene først.', ukjente;
  end if;

  -- ── d) Bytt check-constraint på source ────────────────────
  -- Constrainten fra fase 50 ble laget inline og har autogenerert navn. Vi
  -- slår den opp på definisjonen i stedet for å gjette navnet, og dropper
  -- alle check-constraints som omtaler source (normalt nøyaktig én).
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.conrelid = 'public.imported_activities'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%source%'
  loop
    execute format('alter table public.imported_activities drop constraint %I', c.conname);
    raise notice 'Droppet check-constraint % — %', c.conname, c.def;
  end loop;

  -- Ny constraint med eksplisitt navn. Validerer alle eksisterende rader
  -- (forhåndssjekket over), så migreringen feiler heller enn å slippe gjennom
  -- data som bryter regelen.
  alter table public.imported_activities
    add constraint imported_activities_source_check
    check (source in ('strava','fit_upload','garmin','polar'));

  -- ── e) ETTER-telling + assertions ─────────────────────────
  select count(*) into a_total      from public.imported_activities;
  select count(*) into a_strava     from public.imported_activities where source = 'strava';
  select count(*) into a_fit        from public.imported_activities where source = 'fit_upload';
  select count(*) into a_garmin     from public.imported_activities where source = 'garmin';
  select count(*) into a_polar      from public.imported_activities where source = 'polar';
  select count(*) into a_workouts   from public.workouts;
  select count(*) into a_wimportert from public.workouts where imported_from is not null;
  select count(*) into a_samples    from public.workout_samples;
  select count(*) into a_strconn    from public.strava_connections;
  select count(*) into a_polconn    from public.polar_connections;

  raise notice 'ETTER: imported_activities=% (strava=%, fit_upload=%, garmin=%, polar=%) · workouts=% (importert=%) · samples=% · strava_conns=% · polar_conns=%',
    a_total, a_strava, a_fit, a_garmin, a_polar,
    a_workouts, a_wimportert, a_samples, a_strconn, a_polconn;

  -- e1. Ingen rader tapt eller flyttet mellom kilder.
  if a_total <> b_total then
    raise exception 'Verifisering feilet: imported_activities % → % rader', b_total, a_total;
  end if;
  if a_strava <> b_strava or a_fit <> b_fit or a_garmin <> b_garmin or a_polar <> b_polar then
    raise exception 'Verifisering feilet: kilde-fordeling endret (strava %→%, fit_upload %→%, garmin %→%, polar %→%)',
      b_strava, a_strava, b_fit, a_fit, b_garmin, a_garmin, b_polar, a_polar;
  end if;

  -- e2. Ingen økt mistet kilde-merking, ingen samples/tilkoblinger rørt.
  if a_workouts <> b_workouts or a_wimportert <> b_wimportert then
    raise exception 'Verifisering feilet: workouts %→% (importert %→%)',
      b_workouts, a_workouts, b_wimportert, a_wimportert;
  end if;
  if a_samples <> b_samples then
    raise exception 'Verifisering feilet: workout_samples %→%', b_samples, a_samples;
  end if;
  if a_strconn <> b_strconn then
    raise exception 'Verifisering feilet: strava_connections %→%', b_strconn, a_strconn;
  end if;
  if a_polconn <> b_polconn then
    raise exception 'Verifisering feilet: polar_connections %→% (migreringen skal ikke opprette rader)', b_polconn, a_polconn;
  end if;

  -- e3. Constrainten finnes og godtar alle fire kilder.
  select string_agg(pg_get_constraintdef(oid), ' | ') into a_def
  from pg_constraint
  where conrelid = 'public.imported_activities'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%source%';
  if a_def is null then
    raise exception 'Verifisering feilet: source-constraint mangler helt etter migrering';
  end if;
  if a_def not ilike '%polar%' or a_def not ilike '%strava%'
     or a_def not ilike '%fit_upload%' or a_def not ilike '%garmin%' then
    raise exception 'Verifisering feilet: source-constraint mangler en kilde: %', a_def;
  end if;
  raise notice 'ETTER: source-constraint = %', a_def;

  -- e4. polar_connections er RLS-beskyttet med policy (tokens ligger her).
  select relrowsecurity into rls_on from pg_class where oid = 'public.polar_connections'::regclass;
  if not coalesce(rls_on, false) then
    raise exception 'Verifisering feilet: RLS er ikke aktivert på polar_connections';
  end if;
  select count(*) into n_policies from pg_policies
   where schemaname = 'public' and tablename = 'polar_connections';
  if n_policies < 1 then
    raise exception 'Verifisering feilet: polar_connections har ingen RLS-policy';
  end if;

  raise notice 'OK: alle assertions passerte — ingen data endret, kun ny tabell + utvidet constraint.';

  -- ── f) PostgREST schema-reload (kun ved vellykket commit) ─
  perform pg_notify('pgrst', 'reload schema');
end $$;


-- ══ STEG 3 — ETTER-TELLING (samme query som STEG 1) ═════════
-- Forventet: alle tellinger identiske med STEG 1 · polar_tabell_finnes=true ·
-- polar_rls_på=true · polar_policies=1 · polar_kolonner=11 ·
-- source_constraint inneholder nå 'polar'.
select
  (select count(*) from public.imported_activities)                             as imported_total,
  (select count(*) from public.imported_activities where source = 'strava')     as imported_strava,
  (select count(*) from public.imported_activities where source = 'fit_upload') as imported_fit,
  (select count(*) from public.imported_activities where source = 'garmin')     as imported_garmin,
  (select count(*) from public.imported_activities where source = 'polar')      as imported_polar,
  (select count(*) from public.workouts)                                        as workouts_total,
  (select count(*) from public.workouts where imported_from is not null)        as workouts_importert,
  (select count(*) from public.workout_samples)                                 as samples_total,
  (select count(*) from public.strava_connections)                              as strava_conns,
  (to_regclass('public.polar_connections') is not null)                         as polar_tabell_finnes,
  (select relrowsecurity from pg_class
     where oid = to_regclass('public.polar_connections'))                       as polar_rls_på,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'polar_connections')           as polar_policies,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'polar_connections')        as polar_kolonner,
  (select coalesce(string_agg(pg_get_constraintdef(oid), ' | '), '(ingen)')
     from pg_constraint
    where conrelid = 'public.imported_activities'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source%')                           as source_constraint;


-- ── TILBAKERULLING (kun hvis noe må reverseres manuelt) ─────
-- Kjøres i denne rekkefølgen. Merk at drop table sletter alle Polar-
-- tilkoblinger (tokens) — brukerne må da koble til på nytt.
--
--   alter table public.imported_activities
--     drop constraint if exists imported_activities_source_check;
--   alter table public.imported_activities
--     add constraint imported_activities_source_check
--     check (source in ('strava','fit_upload','garmin'));
--   drop table if exists public.polar_connections;
--   notify pgrst, 'reload schema';
--
-- Tilbakerulling av constrainten forutsetter at ingen rader har
-- source='polar' ennå (ellers må de slettes først).
