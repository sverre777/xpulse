-- Fase 94 (SF-2, oppfølging): snu default på workouts.is_completed til FALSE.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Ingen temp-tabeller.
--
-- KJØRING: hele fila i ett. STEG 1 lesing · STEG 2 én do-blokk · STEG 3 lesing.
--
-- ══ HVORFOR ════════════════════════════════════════════════
--
-- `is_completed` har i dag default TRUE. Det var årsaken til SF-2: årsplanen
-- opprettet konkurranser uten å sette feltet, og de arvet «gjennomført».
-- Koden er rettet, men defaulten står igjen som en felle for neste kodevei
-- som glemmer feltet. Regelen er at ingenting er fullført før brukeren
-- markerer det — da bør databasen si det samme.
--
-- ENDRINGEN ER KUN METADATA. `alter column ... set default` rører ikke én
-- eneste eksisterende rad; den påvirker bare framtidige innsettinger som
-- utelater kolonnen. Assertions nederst verifiserer at radene er urørt.
--
-- ══ VERIFISERT PÅ NYTT FØR SKRIVING ════════════════════════
--
-- Alle innsettingsveier til `workouts` ble gjennomgått på nytt, denne gangen
-- også de som sender en variabel i stedet for et objekt-literal (som ikke
-- fanges av et enkelt søk etter «is_completed:» rett under «.insert({»):
--
--   app/actions/workouts.ts:775      insert(workoutPayload)   → payloaden setter
--       `is_completed: data.is_completed`, og typen (lib/types.ts) har feltet
--       som PÅKREVD boolean, ikke valgfritt. Aldri undefined.
--   app/actions/plan-templates.ts    insert(workoutRows)      → is_completed: false
--   app/actions/coach-push.ts:174    insert(rows)             → is_completed: false
--   app/actions/coach-push.ts        (3 andre)                → is_completed: false
--   app/actions/seasons.ts           (2 stk)                  → is_completed: false (SF-2-fiksen)
--   app/actions/templates.ts, tests.ts (2), fit-upload.ts,
--   strava-sync.ts, api/cron/strava-sync, lib/polar-import.ts → is_completed satt
--
-- Utenfor applikasjonskoden:
--   · Ingen SQL-fil i supabase/ inserter i workouts (kun DDL og backfills på
--     eksisterende rader).
--   · scripts/ inneholder kun selvtester av rene funksjoner — ingen DB-skriving.
--   · netlify/functions/ er cron-triggere som kaller API-ruter; selve
--     innsettingene skjer i rutene over.
--   · Ingen admin-rute oppretter økter.
--
-- Konklusjon: defaulten er i praksis ubrukt. Å snu den endrer ingen oppførsel
-- i dag — den lukker bare fellen for i morgen.
--
-- ══ HVA HADDE SKJEDD HVIS EN VEI VAR AVHENGIG AV TRUE ══════
--
-- Dette er grunnen til at sveipet måtte gjøres på nytt, ikke gjenbrukes:
-- en importvei som stolte på defaulten ville etter denne endringen laget
-- økter som IKKE er gjennomført. Konsekvensen ville vært stille og bred:
--
--   · Øktene ville fått planlagt-utseende i kalenderen (stiplet ramme,
--     components/workout/WorkoutCard.tsx sjekker `is_planned && !is_completed`).
--   · De ville falt ut av trener-flatene som filtrerer på gjennomført
--     (coach-settings.ts:228/251/373, coach-utovere.ts:127).
--   · «Dagens gjennomførte» på hjem ville blitt tom (oversikt.ts:463-464),
--     mens «ikke gjennomført»-tellingen (oversikt.ts:290) ville vokst.
--   · Brukeren måtte markert hver importert økt manuelt for å få dem tilbake.
--
-- Ingen slik vei finnes — men det er den feilen migreringen ville forårsaket,
-- og derfor den sjekken som måtte være uttømmende.


-- ══ STEG 1 — FØR-TILSTAND (ren lesing) ═════════════════════
select
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'workouts'
      and column_name = 'is_completed')                          as is_completed_default,
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'workouts'
      and column_name = 'is_completed')                          as is_nullable,
  (select count(*) from public.workouts)                         as okter_totalt,
  (select count(*) from public.workouts where is_completed)      as gjennomfort,
  (select count(*) from public.workouts where not is_completed)  as ikke_gjennomfort;


-- ══ STEG 2 — ENDRINGEN (ett statement, én transaksjon) ═════
do $$
declare
  b_default   text;
  b_total     bigint;
  b_completed bigint;
  a_default   text;
  a_nullable  text;
  a_total     bigint;
  a_completed bigint;
begin
  select column_default into b_default from information_schema.columns
   where table_schema = 'public' and table_name = 'workouts' and column_name = 'is_completed';
  select count(*) into b_total from public.workouts;
  select count(*) into b_completed from public.workouts where is_completed;

  raise notice 'FØR: default=% · % økter · % gjennomført', b_default, b_total, b_completed;

  if b_default is null then
    raise exception 'Avbryter: fant ingen default på workouts.is_completed — sjekk kolonnen først';
  end if;
  if b_default like '%false%' then
    raise notice 'Default er allerede false — ingen endring nødvendig.';
    return;
  end if;

  alter table public.workouts alter column is_completed set default false;

  select column_default, is_nullable into a_default, a_nullable
    from information_schema.columns
   where table_schema = 'public' and table_name = 'workouts' and column_name = 'is_completed';
  select count(*) into a_total from public.workouts;
  select count(*) into a_completed from public.workouts where is_completed;

  raise notice 'ETTER: default=% · % økter · % gjennomført', a_default, a_total, a_completed;

  -- 1. Defaulten er faktisk snudd.
  if a_default is null or a_default not like '%false%' then
    raise exception 'Verifisering feilet: default er «%», forventet false', coalesce(a_default, '(ingen)');
  end if;

  -- 2. INGEN RAD ER RØRT. En default-endring skal aldri kunne flytte data —
  --    vi sjekker det likevel, for det er hele forutsetningen for at dette er
  --    en trygg endring.
  if a_total <> b_total then
    raise exception 'Verifisering feilet: antall økter %→%', b_total, a_total;
  end if;
  if a_completed <> b_completed then
    raise exception 'Verifisering feilet: antall gjennomførte %→% — ingen rad skulle endret status',
      b_completed, a_completed;
  end if;

  -- 3. Kolonnen er fortsatt not null (en insert som utelater den får false,
  --    ikke null).
  if a_nullable <> 'NO' then
    raise exception 'Verifisering feilet: kolonnen er ikke lenger NOT NULL (%)', a_nullable;
  end if;

  raise notice 'OK: default snudd til false. % økter og % gjennomførte uendret.', a_total, a_completed;
  perform pg_notify('pgrst', 'reload schema');
end $$;


-- ══ STEG 3 — ETTER-TILSTAND (samme query som STEG 1) ═══════
-- Forventet: is_completed_default = false · is_nullable = NO ·
-- alle tre tallene identiske med STEG 1.
select
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'workouts'
      and column_name = 'is_completed')                          as is_completed_default,
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'workouts'
      and column_name = 'is_completed')                          as is_nullable,
  (select count(*) from public.workouts)                         as okter_totalt,
  (select count(*) from public.workouts where is_completed)      as gjennomfort,
  (select count(*) from public.workouts where not is_completed)  as ikke_gjennomfort;


-- ── TILBAKERULLING ─────────────────────────────────────────
--   alter table public.workouts alter column is_completed set default true;
--   notify pgrst, 'reload schema';
--
-- Like risikofri som endringen selv: kun metadata, ingen rader berøres.
