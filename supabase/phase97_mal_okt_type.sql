-- Fase 97 (mal-fiksen, bolk 1): økttype + standardøkt-kobling på øktmaler.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Ingen temp-tabeller.
--
-- To nye kolonner på workout_templates:
--   · okt_type text — malens økttype. Verdiene kommer fra OKT_MAL_TYPER i
--     lib/okt-template-library.ts (fasiten i kode). BEVISST ingen CHECK:
--     typelista er kode-eid og utvides der; en CHECK ville krevd migrering
--     for hver nye type. `category` er OPPTATT (sport-kategori) og røres ikke.
--   · standard_session_series_id uuid — «mal som standardøkt»: peker på
--     brukerens serie. Økter fra malen får serien forhåndsvalgt. NULL = vanlig
--     mal. on delete set null: slettes serien, blir malen vanlig igjen.

-- ══ STEG 1 — FØR (ren lesing) ══
select
  (select count(*) from public.workout_templates)                 as maler_totalt,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='workout_templates'
      and column_name in ('okt_type','standard_session_series_id')) as nye_kolonner_finnes;

-- ══ STEG 2 — ENDRINGEN (én transaksjon) ══
do $$
declare
  b_rader bigint; a_rader bigint; n_kol int;
begin
  select count(*) into b_rader from public.workout_templates;

  alter table public.workout_templates
    add column if not exists okt_type text,
    add column if not exists standard_session_series_id uuid
      references public.standard_session_series(id) on delete set null;

  select count(*) into a_rader from public.workout_templates;
  select count(*) into n_kol from information_schema.columns
   where table_schema='public' and table_name='workout_templates'
     and column_name in ('okt_type','standard_session_series_id');

  if a_rader <> b_rader then
    raise exception 'Radantall endret %→%', b_rader, a_rader;
  end if;
  if n_kol <> 2 then
    raise exception 'Forventet 2 nye kolonner, fant %', n_kol;
  end if;
  raise notice 'OK: okt_type + standard_session_series_id lagt til. % rader urørt.', a_rader;
  perform pg_notify('pgrst', 'reload schema');
end $$;

-- ══ STEG 3 — ETTER (samme som STEG 1; forventet nye_kolonner_finnes = 2) ══
select
  (select count(*) from public.workout_templates)                 as maler_totalt,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='workout_templates'
      and column_name in ('okt_type','standard_session_series_id')) as nye_kolonner_finnes;

-- ══ TELLING (ren lesing, egen kjøring): long_run-gjelden ══
-- materializeOktmalAtDate falt tilbake på 'long_run' for alt som ikke var
-- test. Øvre grense for feilstemplede: økter opprettet fra mal med
-- workout_type='long_run'. NB: noen kan være EKTE langturer (td.workout_type
-- satt) — tallet er en øvre grense, fordelt så Sverre kan avgjøre reparasjon.
select
  workout_type,
  is_planned,
  is_completed,
  count(*) as okter
from public.workouts
where template_id is not null
  and workout_type = 'long_run'
group by 1, 2, 3
order by okter desc;
