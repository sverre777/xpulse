-- Fase 98 (#50-justering): egen A/B/C-prioritet på konkurransedata.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Ingen temp-tabeller.
--
-- Bakgrunn: A/B/C i panelet leste KUN årsplanens event_type. Sverre 21. aug:
-- prioritet må kunne settes også uten årsplan-kobling. Kolonnen er IKKE et
-- duplikatfelt: uten kobling er den eneste kilde; MED kobling vinner
-- årsplanen (og skrives tilbake dit) — koden håndhever rangeringen.

-- ══ STEG 1 — FØR (ren lesing) ══
select
  (select count(*) from public.workout_competition_data)          as rader,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='workout_competition_data'
      and column_name='priority')                                 as priority_finnes;

-- ══ STEG 2 — ENDRINGEN ══
do $$
declare b bigint; a bigint; n int;
begin
  select count(*) into b from public.workout_competition_data;
  alter table public.workout_competition_data
    add column if not exists priority text
    check (priority is null or priority in ('a','b','c'));
  select count(*) into a from public.workout_competition_data;
  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='workout_competition_data'
     and column_name='priority';
  if a <> b then raise exception 'Radantall endret %→%', b, a; end if;
  if n <> 1 then raise exception 'priority-kolonnen mangler'; end if;
  raise notice 'OK: priority lagt til. % rader urørt.', a;
  perform pg_notify('pgrst', 'reload schema');
end $$;

-- ══ STEG 3 — ETTER (forventet priority_finnes = 1, rader uendret) ══
select
  (select count(*) from public.workout_competition_data)          as rader,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='workout_competition_data'
      and column_name='priority')                                 as priority_finnes;
