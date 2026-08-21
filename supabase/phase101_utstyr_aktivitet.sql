-- Fase 101: «Utstyr brukt» kobles til AKTIVITET (utstyr bolk 4)
--
-- workout_equipment får activity_id:
--   null  = «hele økta»-ARV (standard): utstyret telles på hver aktivitet.
--   satt  = per-aktivitet-overstyring (⇄ på raden — kun der man faktisk byttet).
--
-- MIGRERING = INGEN DATAENDRING: alle eksisterende rader HAR allerede
-- activity_id null og blir dermed «hele økta»-arv av seg selv — null datatap.
-- Tellingen for arv-rader bruker samme grunnlag som før (øktas totaler), så
-- km og tid per utstyr er identisk før/etter. Tredelt paritet (koblinger +
-- km + tid) måles i STEG 1 og STEG 3 og assertes i STEG 2.
--
-- Unique-endring: (workout_id, equipment_id) erstattes av en unik indeks som
-- inkluderer activity_id — samme utstyr skal kunne stå som arv OG på
-- enkeltaktiviteter (eller på flere aktiviteter) i samme økt.

-- ── STEG 1 — LESING (kjør først, se på resultatet) ──────────────────────────
-- Paritet-baseline: koblinger + km + tid.
select
  count(*) as koblinger,
  round(coalesce(sum(w.distance_km), 0)::numeric, 1) as sum_km,
  coalesce(sum(w.duration_minutes), 0) as sum_min,
  count(*) filter (where true) as alle_er_arv_kandidater
from public.workout_equipment we
join public.workouts w on w.id = we.workout_id;

-- ── STEG 2 — ENDRING (én blokk, kjøres i sin helhet) ────────────────────────
do $$
declare
  v_unique text;
  v_kobl_for int;
  v_km_for numeric;
  v_min_for numeric;
  v_kobl_etter int;
  v_km_etter numeric;
  v_min_etter numeric;
  v_ikke_arv int;
begin
  -- Paritet-baseline inne i blokken (samme tall som STEG 1).
  select count(*),
         round(coalesce(sum(w.distance_km), 0)::numeric, 1),
         coalesce(sum(w.duration_minutes), 0)
    into v_kobl_for, v_km_for, v_min_for
  from public.workout_equipment we
  join public.workouts w on w.id = we.workout_id;

  -- 1) Aktivitets-kobling. Slettes aktiviteten (økta redigeres/reinsertes),
  --    forsvinner overstyringen — arven (null) består via workout_id.
  alter table public.workout_equipment add column if not exists activity_id uuid
    references public.workout_activities(id) on delete cascade;
  create index if not exists workout_equipment_activity_idx
    on public.workout_equipment(activity_id);

  -- 2) Unique: fjern (workout_id, equipment_id) og legg en variant som
  --    inkluderer aktiviteten (null-arv representert med null-uuid i indeksen).
  select c.conname into v_unique
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'workout_equipment'
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) like '%workout_id%equipment_id%';
  if v_unique is not null then
    execute format('alter table public.workout_equipment drop constraint %I', v_unique);
    raise notice 'Droppet unique-constraint %', v_unique;
  end if;
  create unique index if not exists workout_equipment_unique_per_activity
    on public.workout_equipment(workout_id, equipment_id,
      coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid));

  -- Tredelt paritet-assertion: koblinger + km + tid uendret,
  -- og ALLE eksisterende rader er arv (activity_id null).
  select count(*),
         round(coalesce(sum(w.distance_km), 0)::numeric, 1),
         coalesce(sum(w.duration_minutes), 0)
    into v_kobl_etter, v_km_etter, v_min_etter
  from public.workout_equipment we
  join public.workouts w on w.id = we.workout_id;

  if v_kobl_for <> v_kobl_etter then
    raise exception 'PARITET BRUTT (koblinger): % -> %', v_kobl_for, v_kobl_etter;
  end if;
  if v_km_for <> v_km_etter then
    raise exception 'PARITET BRUTT (km): % -> %', v_km_for, v_km_etter;
  end if;
  if v_min_for <> v_min_etter then
    raise exception 'PARITET BRUTT (tid): % -> %', v_min_for, v_min_etter;
  end if;

  select count(*) into v_ikke_arv from public.workout_equipment where activity_id is not null;
  if v_ikke_arv <> 0 then
    raise exception '% rader fikk activity_id satt av migreringen — skal være 0', v_ikke_arv;
  end if;

  raise notice 'OK: % koblinger, % km, % min — identisk før/etter. Alle rader er hele økta-arv.',
    v_kobl_etter, v_km_etter, v_min_etter;
end $$;

notify pgrst, 'reload schema';

-- ── STEG 3 — LESING (kjør til slutt, lim inn resultatet) ────────────────────
select
  count(*) as koblinger,
  round(coalesce(sum(w.distance_km), 0)::numeric, 1) as sum_km,
  coalesce(sum(w.duration_minutes), 0) as sum_min,
  count(*) filter (where we.activity_id is null) as arv_rader,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'workout_equipment'
      and column_name = 'activity_id') as activity_id_finnes
from public.workout_equipment we
join public.workouts w on w.id = we.workout_id;
