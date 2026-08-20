-- Fase 96: Reisedag som dagtilstand.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Ingen temp-tabeller.
--
-- Reisedag er en markering på dato, som hviledag/sykdom/skade: den kan
-- planlegges frem i tid, sameksisterer med økter og alt annet ført samme
-- dag, og teller ikke i totaler. Nytt felt: antall timer reise.

-- ══ STEG 1 — FØR (ren lesing) ══
select
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.day_states'::regclass
      and conname = 'day_states_state_type_check')            as constraint_naa,
  (select count(*) from public.day_states)                    as rader_totalt,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'day_states'
      and column_name = 'travel_hours')                       as travel_hours_finnes;

-- ══ STEG 2 — ENDRINGEN (én transaksjon) ══
do $$
declare
  b_rader bigint;
  a_rader bigint;
  c_def   text;
begin
  select count(*) into b_rader from public.day_states;

  alter table public.day_states
    drop constraint if exists day_states_state_type_check;
  alter table public.day_states
    add constraint day_states_state_type_check
    check (state_type in ('hviledag','sykdom','skade','reisedag'));

  -- Timer reise: 0–24, halvtimer OK. Kun meningsfull for reisedag,
  -- men håndheves i appen — ikke i skjemaet (samme mønster som
  -- expected_days_off, som også er typespesifikk).
  alter table public.day_states
    add column if not exists travel_hours numeric(4,1)
    check (travel_hours is null or (travel_hours >= 0 and travel_hours <= 24));

  select count(*) into a_rader from public.day_states;
  select pg_get_constraintdef(oid) into c_def from pg_constraint
   where conrelid = 'public.day_states'::regclass
     and conname = 'day_states_state_type_check';

  if a_rader <> b_rader then
    raise exception 'Radantall endret %→% — skal være umulig', b_rader, a_rader;
  end if;
  if c_def not like '%reisedag%' then
    raise exception 'Constrainten mangler reisedag: %', c_def;
  end if;

  raise notice 'OK: reisedag i constrainten, travel_hours lagt til. % rader urørt.', a_rader;
  perform pg_notify('pgrst', 'reload schema');
end $$;

-- ══ STEG 3 — ETTER (samme som STEG 1) ══
-- Forventet: constrainten inneholder reisedag · travel_hours_finnes = 1 ·
-- rader_totalt uendret.
select
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.day_states'::regclass
      and conname = 'day_states_state_type_check')            as constraint_naa,
  (select count(*) from public.day_states)                    as rader_totalt,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'day_states'
      and column_name = 'travel_hours')                       as travel_hours_finnes;
