-- Fase 100: Skipark-tester (utstyr + skipark bolk 3)
--
-- UTVIDER eksisterende skitest-modell (ski_tests + ski_test_entries/rank_in_test)
-- — erstatter ingenting:
-- 1. ski_tests.test_type  — testmalen: tidtaker-glid / lengde-glid / parallelltest / egen.
--    Eksisterende rader forblir null (= fri test fra før malene fantes).
-- 2. ski_tests.weather + humidity_pct — «forhold på alle tester»:
--    sted/føre/temp luft+snø finnes fra før; vær og luftfuktighet er nye.
-- 3. ski_test_entries.distance_m — lengde-glid måler meter, ikke sekunder.
-- 4. Eventuell unique-constraint på (test_id, ski_id) fjernes: «under skiene»
--    er testvariabelen — samme ski skal kunne stille flere ganger m/ ulik smøring.
-- 5. ski_test_templates — EGNE tester lagret som mal (navn + beskrivelse + målemåte).
--
-- Prod-verifisert før skriving: ski_tests/ski_test_entries finnes (200),
-- test_type/weather/humidity_pct/distance_m mangler (400), ski_test_templates 404.

-- ── STEG 1 — LESING (kjør først, se på resultatet) ──────────────────────────
select count(*) as tester, count(distinct user_id) as brukere from public.ski_tests;
select count(*) as entries from public.ski_test_entries;

-- Constraints på ski_test_entries (ser etter ev. unique på test_id+ski_id):
select c.conname, c.contype, pg_get_constraintdef(c.oid) as def
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relname = 'ski_test_entries';

-- ── STEG 2 — ENDRING (én blokk, kjøres i sin helhet) ────────────────────────
do $$
declare
  v_unique text;
  v_for int;
  v_etter int;
begin
  select count(*) into v_for from public.ski_tests;

  -- 1) Testtype (null = fri/eldre test).
  alter table public.ski_tests add column if not exists test_type text
    check (test_type is null or test_type in ('tidtaker','lengde','parallell','egen'));

  -- 2) Forhold: vær + luftfuktighet.
  alter table public.ski_tests add column if not exists weather text;
  alter table public.ski_tests add column if not exists humidity_pct numeric;

  -- 3) Lengde-glid: meter per entry.
  alter table public.ski_test_entries add column if not exists distance_m numeric;

  -- 4) Samme ski flere ganger i samme test («under skiene» er variabelen):
  --    fjern unique på (test_id, ski_id) hvis den finnes.
  select c.conname into v_unique
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'ski_test_entries'
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) like '%test_id%ski_id%';
  if v_unique is not null then
    execute format('alter table public.ski_test_entries drop constraint %I', v_unique);
    raise notice 'Droppet unique-constraint %', v_unique;
  end if;

  -- 5) Egne test-maler.
  create table if not exists public.ski_test_templates (
    id          uuid primary key default uuid_generate_v4(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    name        text not null,
    description text,
    measure     text not null default 'score' check (measure in ('tid','lengde','score')),
    created_at  timestamptz not null default now()
  );
  create index if not exists ski_test_templates_user_idx on public.ski_test_templates(user_id);

  alter table public.ski_test_templates enable row level security;

  drop policy if exists "Own ski test templates" on public.ski_test_templates;
  create policy "Own ski test templates"
    on public.ski_test_templates for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  -- Ingen rader skal endres av migreringen — bare skjema.
  select count(*) into v_etter from public.ski_tests;
  if v_for <> v_etter then
    raise exception 'Radantall endret seg (% -> %) — skal ikke skje', v_for, v_etter;
  end if;

  raise notice 'OK: % tester urørt.', v_etter;
end $$;

notify pgrst, 'reload schema';

-- ── STEG 3 — LESING (kjør til slutt, lim inn resultatet) ────────────────────
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'ski_tests'
      and column_name in ('test_type','weather','humidity_pct')) as nye_ski_tests_kolonner_av_3,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'ski_test_entries'
      and column_name = 'distance_m') as distance_m_finnes,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'ski_test_templates') as maltabell_finnes,
  (select count(*) from public.ski_tests) as tester_etter;
