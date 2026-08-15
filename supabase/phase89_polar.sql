-- Fase 89 (kø #51 POLAR ACCESSLINK, bolk 1): datamodell for Polar-klokkesync.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Idempotent; ingenting slettes.
--
-- KJØR HELE FILEN I ETT. Supabase SQL-editor kjører et flerstegs-script som
-- én implisitt transaksjon, så enhver `raise exception` i verifiseringen
-- ruller HELE migreringen tilbake. Ikke kjør statement-for-statement — da
-- mister vi den garantien.
--
-- TO ENDRINGER, BEGGE ADDITIVE:
--   1. NY tabell public.polar_connections (speiler strava_connections).
--   2. UTVIDET check-constraint på imported_activities.source:
--        ('strava','fit_upload','garmin')  →  (+ 'polar')
--      Ingen rader røres — kun constraint-definisjonen byttes ut.
--
-- INGENTING annet endres: workouts, workout_samples, workout_activities,
-- strava_connections og .fit-opplastingen er urørt. Verifiseres med
-- før/etter-telling og assertions nederst.
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
--    tokenet og lar UI tilby ny registrering, i stedet for å miste koblingen.
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

-- ── 1. Ny tabell: polar_connections ─────────────────────────
-- Additiv DDL: oppretter en tom tabell, rører ingen eksisterende data.
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
  last_webhook_at  timestamptz,                 -- brukes av overvåkning i bolk 4
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

-- ── 2. FØR-TELLING ──────────────────────────────────────────
-- Tas etter tabell-opprettelsen (som ikke rører data) slik at den kan telle
-- polar_connections direkte. Lagres i temp-tabell for assertions til slutt.
drop table if exists _polar_migration_before;
create temp table _polar_migration_before as
select
  (select count(*) from public.imported_activities)                             as imported_total,
  (select count(*) from public.imported_activities where source = 'strava')     as imported_strava,
  (select count(*) from public.imported_activities where source = 'fit_upload') as imported_fit,
  (select count(*) from public.imported_activities where source = 'garmin')     as imported_garmin,
  (select count(*) from public.imported_activities where source = 'polar')      as imported_polar,
  (select count(*) from public.workouts)                                        as workouts_total,
  (select count(*) from public.workouts where imported_from is not null)        as workouts_imported,
  (select count(*) from public.workout_samples)                                 as samples_total,
  (select count(*) from public.strava_connections)                              as strava_conns,
  (select count(*) from public.polar_connections)                               as polar_conns,
  (select coalesce(string_agg(pg_get_constraintdef(oid), ' | '), '(ingen)')
     from pg_constraint
    where conrelid = 'public.imported_activities'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source%')                           as source_check_def;

do $$
declare b record;
begin
  select * into b from _polar_migration_before;
  raise notice 'FØR: imported_activities=% (strava=%, fit_upload=%, garmin=%, polar=%) · workouts=% (importert=%) · samples=% · strava_conns=% · polar_conns=%',
    b.imported_total, b.imported_strava, b.imported_fit, b.imported_garmin, b.imported_polar,
    b.workouts_total, b.workouts_imported, b.samples_total, b.strava_conns, b.polar_conns;
  raise notice 'FØR: source-constraint = %', b.source_check_def;
end $$;

-- ── 3. FORHÅNDSSJEKK før constraint byttes ──────────────────
-- Hvis det finnes source-verdier utenfor den nye lista ville den nye
-- constrainten avvist dem. Da stopper vi FØR vi dropper den gamle, slik at
-- vi aldri står igjen med en tabell uten constraint.
do $$
declare ukjente text;
begin
  select string_agg(distinct source, ', ') into ukjente
  from public.imported_activities
  where source not in ('strava','fit_upload','garmin','polar');
  if ukjente is not null then
    raise exception 'Avbryter: imported_activities.source har ukjente verdier (%). Legg dem inn i constrainten eller rydd dataene først.', ukjente;
  end if;
end $$;

-- ── 4. Bytt check-constraint på imported_activities.source ──
-- Constrainten fra fase 50 ble laget inline og har derfor et autogenerert
-- navn. Vi slår den opp på definisjonen i stedet for å gjette navnet, og
-- dropper alle check-constraints som omtaler source (normalt nøyaktig én).
do $$
declare c record;
begin
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
end $$;

-- Ny constraint med eksplisitt navn. Validerer alle eksisterende rader
-- (forhåndssjekket over), så migreringen feiler heller enn å slippe gjennom
-- data som bryter regelen.
alter table public.imported_activities
  add constraint imported_activities_source_check
  check (source in ('strava','fit_upload','garmin','polar'));

-- ── 5. ETTER-TELLING + ASSERTIONS ───────────────────────────
-- Krav: ingen rad forsvant, ingen økt mistet kilde-merking, constrainten
-- godtar alle fire kilder, og polar_connections er RLS-beskyttet.
do $$
declare
  b            record;
  a_total      bigint;
  a_strava     bigint;
  a_fit        bigint;
  a_garmin     bigint;
  a_polar      bigint;
  a_workouts   bigint;
  a_wimported  bigint;
  a_samples    bigint;
  a_strconn    bigint;
  a_polconn    bigint;
  def          text;
  rls_on       boolean;
  n_policies   int;
begin
  select * into b from _polar_migration_before;

  select count(*) into a_total     from public.imported_activities;
  select count(*) into a_strava    from public.imported_activities where source = 'strava';
  select count(*) into a_fit       from public.imported_activities where source = 'fit_upload';
  select count(*) into a_garmin    from public.imported_activities where source = 'garmin';
  select count(*) into a_polar     from public.imported_activities where source = 'polar';
  select count(*) into a_workouts  from public.workouts;
  select count(*) into a_wimported from public.workouts where imported_from is not null;
  select count(*) into a_samples   from public.workout_samples;
  select count(*) into a_strconn   from public.strava_connections;
  select count(*) into a_polconn   from public.polar_connections;

  raise notice 'ETTER: imported_activities=% (strava=%, fit_upload=%, garmin=%, polar=%) · workouts=% (importert=%) · samples=% · strava_conns=% · polar_conns=%',
    a_total, a_strava, a_fit, a_garmin, a_polar,
    a_workouts, a_wimported, a_samples, a_strconn, a_polconn;

  -- 5a. Ingen rader tapt eller flyttet mellom kilder.
  if a_total <> b.imported_total then
    raise exception 'Verifisering feilet: imported_activities % → % rader', b.imported_total, a_total;
  end if;
  if a_strava <> b.imported_strava or a_fit <> b.imported_fit
     or a_garmin <> b.imported_garmin or a_polar <> b.imported_polar then
    raise exception 'Verifisering feilet: kilde-fordeling endret (strava %→%, fit_upload %→%, garmin %→%, polar %→%)',
      b.imported_strava, a_strava, b.imported_fit, a_fit,
      b.imported_garmin, a_garmin, b.imported_polar, a_polar;
  end if;

  -- 5b. Ingen økt mistet kilde-merking, ingen samples/tilkoblinger rørt.
  if a_workouts <> b.workouts_total or a_wimported <> b.workouts_imported then
    raise exception 'Verifisering feilet: workouts %→% (importert %→%)',
      b.workouts_total, a_workouts, b.workouts_imported, a_wimported;
  end if;
  if a_samples <> b.samples_total then
    raise exception 'Verifisering feilet: workout_samples %→%', b.samples_total, a_samples;
  end if;
  if a_strconn <> b.strava_conns then
    raise exception 'Verifisering feilet: strava_connections %→%', b.strava_conns, a_strconn;
  end if;
  if a_polconn <> b.polar_conns then
    raise exception 'Verifisering feilet: polar_connections %→% (migreringen skal ikke opprette rader)', b.polar_conns, a_polconn;
  end if;

  -- 5c. Constrainten finnes og godtar alle fire kilder.
  select string_agg(pg_get_constraintdef(oid), ' | ') into def
  from pg_constraint
  where conrelid = 'public.imported_activities'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%source%';
  if def is null then
    raise exception 'Verifisering feilet: source-constraint mangler helt etter migrering';
  end if;
  if def not ilike '%polar%' or def not ilike '%strava%'
     or def not ilike '%fit_upload%' or def not ilike '%garmin%' then
    raise exception 'Verifisering feilet: source-constraint mangler en kilde: %', def;
  end if;
  raise notice 'ETTER: source-constraint = %', def;

  -- 5d. polar_connections er RLS-beskyttet med policy (tokens ligger her).
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
end $$;

drop table if exists _polar_migration_before;

notify pgrst, 'reload schema';

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
