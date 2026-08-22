-- Fase 104: Hendelser i årsplanen — egen 'testlop'-type, 'test' blir ren 🧪 test
--
-- Bakgrunn (Sverre 22. aug): hendelses-panelet skal kunne velge mellom
-- KONKURRANSE (m/ A/B/C-prioritet), TESTLØP og TEST — som i økt-panelet.
-- Dagens 'test'-verdi har hele tiden vært merket «Testløp» i UI-et, og en
-- ren test-type fantes ikke.
--
-- 1. CHECK-en på season_key_dates.event_type utvides med 'testlop'.
-- 2. Eksisterende 'test'-rader migreres til 'testlop' (det var semantikken
--    de ble opprettet med) — 'test' er heretter ren 🧪 test.
-- Ingen andre felter røres.

-- ── STEG 1 — LESING (kjør først, se på resultatet) ──────────────────────────
select event_type, count(*) as antall
from public.season_key_dates
group by event_type
order by event_type;

-- ── STEG 2 — ENDRING (én blokk, kjøres i sin helhet) ────────────────────────
do $$
declare
  v_constraint text;
  v_for int;
  v_test_for int;
  v_etter int;
  v_test_etter int;
begin
  select count(*) into v_for from public.season_key_dates;
  select count(*) into v_test_for from public.season_key_dates where event_type = 'test';

  -- Finn og fjern dagens CHECK dynamisk (navnet kan variere).
  select c.conname into v_constraint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'season_key_dates'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%event_type%';
  if v_constraint is null then
    raise exception 'Fant ikke CHECK-constrainten på season_key_dates.event_type — stopper';
  end if;
  execute format('alter table public.season_key_dates drop constraint %I', v_constraint);

  -- Migrer: gamle 'test'-hendelser VAR testløp (UI-labelen har alltid sagt det).
  update public.season_key_dates set event_type = 'testlop' where event_type = 'test';

  alter table public.season_key_dates add constraint season_key_dates_event_type_check
    check (event_type in ('competition_a','competition_b','competition_c','testlop','test','camp','other'));

  select count(*) into v_etter from public.season_key_dates;
  select count(*) into v_test_etter from public.season_key_dates where event_type = 'test';
  if v_for <> v_etter then
    raise exception 'Radantall endret seg (% -> %) — skal ikke skje', v_for, v_etter;
  end if;
  if v_test_etter <> 0 then
    raise exception '% rader står igjen som test — migreringen feilet', v_test_etter;
  end if;

  raise notice 'OK: % rader urørt i antall, % test-rader migrert til testlop.', v_etter, v_test_for;
end $$;

notify pgrst, 'reload schema';

-- ── STEG 3 — LESING (kjør til slutt, lim inn resultatet) ────────────────────
select event_type, count(*) as antall
from public.season_key_dates
group by event_type
order by event_type;
