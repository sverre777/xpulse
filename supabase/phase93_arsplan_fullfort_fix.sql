-- Fase 93 (SF-2): rydder opp konkurranser fra årsplanen som ble auto-markert
-- som gjennomført.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Ingen temp-tabeller.
--
-- KJØRING: hele fila i ett. STEG 1 lesing · STEG 2 én do-blokk · STEG 3 lesing.
--
-- ══ ÅRSAKEN (kartlagt, ikke gjettet) ═══════════════════════
--
-- `workouts.is_completed` har **default TRUE** i skjemaet. Årsplanen oppretter
-- en koblet økt for hver nøkkeldato som gir en økt (A/B/C-konkurranse og test)
-- i app/actions/seasons.ts, og de to insert-ene satte `is_planned: true` men
-- ALDRI `is_completed`. Dermed arvet raden default-verdien og ble lagret som
-- gjennomført i samme øyeblikk den ble opprettet — uansett dato.
--
-- Alle andre opprettelsesveier (trener-push, maler, tester, .fit, Strava,
-- Polar, øktskjemaet) setter feltet eksplisitt. Kun årsplanen manglet det.
-- Koden er rettet; denne migreringen rydder radene som allerede er lagret feil.
--
-- ══ HVA DEN RETTER — OG HVA DEN IKKE RØRER ═════════════════
--
-- RETTER: økter som er koblet fra en nøkkeldato (season_key_dates.
-- linked_workout_id), står som gjennomført, og har dato FREM I TID. En
-- konkurranse som ikke har funnet sted kan umulig være gjennomført, så disse
-- er beviselig feil.
--
-- RØRER IKKE: økter med dato i fortiden. Der kan vi ikke skille «utøveren
-- gjennomførte den og lot den stå» fra «auto-markert og aldri rørt» — begge
-- har completed_at satt (fase 67b backfilte feltet for alle gamle rader).
-- STEG 1 lister dem med signaler (varighet, aktiviteter, konkurransedata) så
-- du kan avgjøre selv. Si fra hvilke som skal nullstilles, så lager jeg en
-- egen, målrettet migrering for nettopp dem.
--
-- RØRER ALDRI: økter som ikke er koblet til en nøkkeldato. Assertion nederst
-- verifiserer at antallet gjennomførte økter UTENFOR årsplanen er uendret.


-- ══ STEG 1a — ÅRSAK + FØR-TELLING (ren lesing) ═════════════
select
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'workouts'
      and column_name = 'is_completed')                                    as is_completed_default,
  (select count(*) from public.workouts where is_completed)                as gjennomfort_totalt,
  (select count(*) from public.workouts w
     join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed)                                                  as fra_arsplan_gjennomfort,
  (select count(*) from public.workouts w
     join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed and w.date > current_date)                        as fremtidige_rettes,
  (select count(*) from public.workouts w
     join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed and w.date <= current_date)                       as fortid_rores_ikke,
  (select count(*) from public.workouts w
    where w.is_completed
      and not exists (select 1 from public.season_key_dates k
                       where k.linked_workout_id = w.id))                  as utenfor_arsplan_uendret;


-- ══ STEG 1b — FORTIDS-RADENE, MED SIGNALER (ren lesing) ════
-- Disse rører migreringen IKKE. Kolonnene til høyre viser om økta ser
-- gjennomført ut i praksis: har den varighet, aktiviteter eller
-- konkurranseresultat, er den trolig ekte. Er alt tomt, er den trolig
-- auto-markert og aldri rørt.
select
  w.date,
  k.event_type,
  w.title,
  w.workout_type,
  w.duration_minutes,
  (select count(*) from public.workout_activities a where a.workout_id = w.id) as aktiviteter,
  (select count(*) from public.workout_competition_data c where c.workout_id = w.id) as konkurransedata,
  w.completed_at
from public.workouts w
join public.season_key_dates k on k.linked_workout_id = w.id
where w.is_completed and w.date <= current_date
order by w.date desc
limit 100;


-- ══ STEG 2 — RETTINGEN (ett statement, én transaksjon) ═════
do $$
declare
  b_total      bigint;
  b_arsplan    bigint;
  b_fremtid    bigint;
  b_fortid     bigint;
  b_utenfor    bigint;
  a_total      bigint;
  a_fremtid    bigint;
  a_fortid     bigint;
  a_utenfor    bigint;
  n_endret     bigint;
begin
  select count(*) into b_total from public.workouts where is_completed;
  select count(*) into b_arsplan from public.workouts w
    join public.season_key_dates k on k.linked_workout_id = w.id where w.is_completed;
  select count(*) into b_fremtid from public.workouts w
    join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed and w.date > current_date;
  select count(*) into b_fortid from public.workouts w
    join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed and w.date <= current_date;
  select count(*) into b_utenfor from public.workouts w
    where w.is_completed and not exists (
      select 1 from public.season_key_dates k where k.linked_workout_id = w.id);

  raise notice 'FØR: % gjennomførte totalt · % fra årsplan (% fremtidige, % fortid) · % utenfor årsplan',
    b_total, b_arsplan, b_fremtid, b_fortid, b_utenfor;

  -- Nullstiller KUN fremtidige, årsplan-koblede. completed_at nullstilles
  -- sammen med flagget, slik markWorkoutCompleted/-Uncompleted også gjør.
  with malgruppe as (
    select w.id
    from public.workouts w
    join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed and w.date > current_date
  )
  update public.workouts w
  set is_completed = false,
      completed_at = null,
      updated_at = now()
  from malgruppe m
  where w.id = m.id;

  get diagnostics n_endret = row_count;

  select count(*) into a_total from public.workouts where is_completed;
  select count(*) into a_fremtid from public.workouts w
    join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed and w.date > current_date;
  select count(*) into a_fortid from public.workouts w
    join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed and w.date <= current_date;
  select count(*) into a_utenfor from public.workouts w
    where w.is_completed and not exists (
      select 1 from public.season_key_dates k where k.linked_workout_id = w.id);

  raise notice 'ETTER: % gjennomførte totalt · % fremtidige igjen · % fortid · % utenfor årsplan · % rader endret',
    a_total, a_fremtid, a_fortid, a_utenfor, n_endret;

  -- 1. Ingen fremtidige årsplan-økter står lenger som gjennomført.
  if a_fremtid <> 0 then
    raise exception 'Verifisering feilet: % fremtidige årsplan-økter står fortsatt som gjennomført', a_fremtid;
  end if;

  -- 2. DIFFERANSEN ER NØYAKTIG DE FEILAKTIG AUTO-MARKERTE. Ingenting annet
  --    ble av-markert.
  if b_total - a_total <> b_fremtid then
    raise exception 'Verifisering feilet: totalen falt med %, men bare % skulle rettes',
      b_total - a_total, b_fremtid;
  end if;
  if n_endret <> b_fremtid then
    raise exception 'Verifisering feilet: % rader ble endret, forventet %', n_endret, b_fremtid;
  end if;

  -- 3. Fortidige årsplan-økter er urørt (de skal vurderes manuelt).
  if a_fortid <> b_fortid then
    raise exception 'Verifisering feilet: fortidige årsplan-økter endret (%→%)', b_fortid, a_fortid;
  end if;

  -- 4. Økter UTENFOR årsplanen er ikke rørt i det hele tatt — det er her
  --    brukerens egne, faktisk gjennomførte økter ligger.
  if a_utenfor <> b_utenfor then
    raise exception 'Verifisering feilet: gjennomførte økter utenfor årsplanen endret (%→%)', b_utenfor, a_utenfor;
  end if;

  raise notice 'OK: % fremtidige årsplan-økter nullstilt. Alt annet urørt.', n_endret;
  perform pg_notify('pgrst', 'reload schema');
end $$;


-- ══ STEG 3 — ETTER-TILSTAND (samme query som STEG 1a) ══════
-- Forventet: fremtidige_rettes = 0 · gjennomfort_totalt redusert med nøyaktig
-- det tallet · fortid_rores_ikke og utenfor_arsplan_uendret identiske med STEG 1a.
select
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'workouts'
      and column_name = 'is_completed')                                    as is_completed_default,
  (select count(*) from public.workouts where is_completed)                as gjennomfort_totalt,
  (select count(*) from public.workouts w
     join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed)                                                  as fra_arsplan_gjennomfort,
  (select count(*) from public.workouts w
     join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed and w.date > current_date)                        as fremtidige_rettes,
  (select count(*) from public.workouts w
     join public.season_key_dates k on k.linked_workout_id = w.id
    where w.is_completed and w.date <= current_date)                       as fortid_rores_ikke,
  (select count(*) from public.workouts w
    where w.is_completed
      and not exists (select 1 from public.season_key_dates k
                       where k.linked_workout_id = w.id))                  as utenfor_arsplan_uendret;


-- ── MERK: default-verdien er IKKE endret ───────────────────
-- `workouts.is_completed` står fortsatt til default true. Å snu den ville
-- vært en større endring som treffer alle innsettingsveier samtidig, og alle
-- andre veier setter feltet eksplisitt. Vil du snu den likevel — som et vern
-- mot at neste nye kodevei gjør samme feil — er det en egen, liten migrering:
--
--   alter table public.workouts alter column is_completed set default false;
--
-- Den bør i så fall vurderes for seg, med samme før/etter-telling.
