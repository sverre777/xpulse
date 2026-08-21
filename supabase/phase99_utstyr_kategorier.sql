-- Fase 99: Utstyr + skipark bolk 1 (+ sliphistorikk-tabellen for bolk 2)
--
-- 1. Utvider equipment.category fra 5 til 9 verdier:
--      ski · rulleski · skisko · lopesko · sykkelsko · skistaver · sykkel · klokke · annet
--    Eksisterende 'sko'-rader mappes til 'lopesko' (Sverres default).
-- 2. start_km på alt utstyr («km allerede gått» — legges til tellingen i appen).
-- 3. Kategorispesifikke kolonner på equipment (null for kategorier de ikke gjelder):
--      size            skisko / lopesko / sykkelsko — størrelse (tekst, tåler «42 2/3»)
--      usage_type      lopesko (trening/konkurranse/terreng) / skistaver (skoyte/klassisk/rulleski)
--                      — verdisettet varierer per kategori (fasit seksjon 1), derfor ingen CHECK;
--                      appen styrer chips-verdiene. Ski har sin bruk i ski_data (konkurranse/trening).
--      length_cm       skistaver — lengde (ski-lengde ligger fortsatt i equipment_ski_data)
--      subtype         rulleski: skoyte/klassisk · skisko: type · sykkel: sykkeltype
--      wheel_type      rulleski — hjultype
--      resistance      rulleski — motstand felles (ELLER foran/bak under)
--      resistance_front / resistance_rear   rulleski — motstand per ende
--      cleat_system    sykkelsko — festesystem
--      drivetrain      sykkel — drivverk
--      wheelset        sykkel — hjulsett
-- 4. equipment_ski_data.usage_type — bruk-chips (konkurranse/trening) for ski.
-- 5. equipment_grinds (bolk 2): sliphistorikk — ny slip legges OPPÅ, aldri overskriving.
--    Eksisterende current_slip i equipment_ski_data backfilles som første historikkrad.
--
-- Prod-verifisert før skriving: equipment.category er text m/ CHECK (ikke enum);
-- ingen av de nye kolonnene finnes (400 på select); equipment_ski_data finnes;
-- equipment_grinds finnes ikke (404).

-- ── STEG 1 — LESING (kjør først, se på resultatet) ──────────────────────────
select category, count(*) as antall
from public.equipment
group by category
order by category;

select count(*) as ski_data_rader,
       count(current_slip) as med_slip
from public.equipment_ski_data;

-- ── STEG 2 — ENDRING (én blokk, kjøres i sin helhet) ────────────────────────
do $$
declare
  v_constraint text;
  v_sko_for int;
  v_sko_etter int;
  v_utenfor int;
  v_backfill int;
begin
  -- 1) Kategori-utvidelse: finn og fjern dagens CHECK på equipment.category.
  select c.conname into v_constraint
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'equipment'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%category%';
  if v_constraint is null then
    raise exception 'Fant ikke CHECK-constrainten på equipment.category — stopper';
  end if;
  execute format('alter table public.equipment drop constraint %I', v_constraint);

  -- Mapp gamle 'sko'-rader til 'lopesko'.
  select count(*) into v_sko_for from public.equipment where category = 'sko';
  update public.equipment set category = 'lopesko' where category = 'sko';
  select count(*) into v_sko_etter from public.equipment where category = 'sko';
  if v_sko_etter <> 0 then
    raise exception 'Mapping feilet: % rader har fortsatt category=sko', v_sko_etter;
  end if;

  -- Ny CHECK med de ni kategoriene.
  alter table public.equipment add constraint equipment_category_check
    check (category in ('ski','rulleski','skisko','lopesko','sykkelsko','skistaver','sykkel','klokke','annet'));

  select count(*) into v_utenfor from public.equipment
  where category not in ('ski','rulleski','skisko','lopesko','sykkelsko','skistaver','sykkel','klokke','annet');
  if v_utenfor <> 0 then
    raise exception '% rader utenfor det nye kategorisettet', v_utenfor;
  end if;

  -- 2) start_km for alt utstyr.
  alter table public.equipment add column if not exists start_km numeric not null default 0;

  -- 3) Kategorispesifikke kolonner (null der de ikke gjelder — appen styrer per kategori).
  alter table public.equipment add column if not exists size text;
  alter table public.equipment add column if not exists usage_type text;
  alter table public.equipment add column if not exists length_cm numeric;
  alter table public.equipment add column if not exists subtype text;
  alter table public.equipment add column if not exists wheel_type text;
  alter table public.equipment add column if not exists resistance text;
  alter table public.equipment add column if not exists resistance_front text;
  alter table public.equipment add column if not exists resistance_rear text;
  alter table public.equipment add column if not exists cleat_system text;
  alter table public.equipment add column if not exists drivetrain text;
  alter table public.equipment add column if not exists wheelset text;

  -- 4) Bruk-chips for ski (ligger hos ski-dataene, samme sted som type/lengde/slip).
  alter table public.equipment_ski_data add column if not exists usage_type text
    check (usage_type is null or usage_type in ('konkurranse','trening'));

  -- 5) Sliphistorikk (bolk 2): ny slip legges OPPÅ — aldri overskriving.
  create table if not exists public.equipment_grinds (
    id           uuid primary key default uuid_generate_v4(),
    equipment_id uuid not null references public.equipment(id) on delete cascade,
    grind        text not null,
    grind_date   date not null,
    ground_by    text,
    notes        text,
    created_at   timestamptz not null default now()
  );
  create index if not exists equipment_grinds_equipment_idx
    on public.equipment_grinds(equipment_id, grind_date desc);

  alter table public.equipment_grinds enable row level security;

  drop policy if exists "Own grinds" on public.equipment_grinds;
  create policy "Own grinds"
    on public.equipment_grinds for all
    using (exists (
      select 1 from public.equipment e
      where e.id = equipment_id and e.user_id = auth.uid()
    ))
    with check (exists (
      select 1 from public.equipment e
      where e.id = equipment_id and e.user_id = auth.uid()
    ));

  drop policy if exists "Coach reads grinds" on public.equipment_grinds;
  create policy "Coach reads grinds"
    on public.equipment_grinds for select
    using (exists (
      select 1 from public.equipment e
      join public.coach_athlete_relations r on r.athlete_id = e.user_id
      where e.id = equipment_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
    ));

  -- Backfill: dagens current_slip blir første rad i historikken (kun rader med slip,
  -- og kun hvis historikken er tom for den skia — trygt å kjøre på nytt).
  insert into public.equipment_grinds (equipment_id, grind, grind_date, ground_by)
  select sd.equipment_id, sd.current_slip, coalesce(sd.slip_date, current_date), sd.slip_by
  from public.equipment_ski_data sd
  where sd.current_slip is not null
    and not exists (
      select 1 from public.equipment_grinds g where g.equipment_id = sd.equipment_id
    );
  get diagnostics v_backfill = row_count;

  raise notice 'OK: sko->lopesko mappet: % rader. Sliphistorikk backfillet: % rader.', v_sko_for, v_backfill;
end $$;

notify pgrst, 'reload schema';

-- ── STEG 3 — LESING (kjør til slutt, lim inn resultatet) ────────────────────
select category, count(*) as antall
from public.equipment
group by category
order by category;

select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment'
      and column_name in ('start_km','size','usage_type','length_cm','subtype','wheel_type',
                          'resistance','resistance_front','resistance_rear','cleat_system',
                          'drivetrain','wheelset')) as nye_equipment_kolonner_av_12,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment_ski_data'
      and column_name = 'usage_type') as ski_data_usage_type,
  (select count(*) from public.equipment_grinds) as sliphistorikk_rader;
