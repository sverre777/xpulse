-- Fase 52 — Database-fixer for tre lurende bugs.
--
-- 1. user_movement_types.notes — schema-cache eller faktisk kolonne-mangling
-- 2. seasons.updated_at — trigger feiler hvis kolonne mangler
-- 3. workouts.workout_type — constraint mangler 'testlop' (smoking gun for
--    C-konkurranse-insert-feil; competition_c mapper til 'testlop' i
--    seasons.ts:480, men phase31 bygde constrainten uten 'testlop')
--
-- Idempotent. Trygg å kjøre flere ganger.

-- ── 1. user_movement_types.notes ─────────────────────────────
-- Defensivt: legg til hvis mangler. Hvis allerede der er dette no-op.
alter table public.user_movement_types
  add column if not exists notes text;

-- ── 2. seasons.updated_at ────────────────────────────────────
-- handle_updated_at()-triggeren forutsetter at NEW har feltet.
-- Defensivt sett kolonnen + (gjen)opprett triggeren slik phase10 gjør.
alter table public.seasons
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists seasons_updated_at on public.seasons;
create trigger seasons_updated_at
  before update on public.seasons
  for each row execute procedure public.handle_updated_at();

-- ── 3. workouts.workout_type — full liste ────────────────────
-- Drop alle eksisterende workout_type-constraints (uansett navn) og legg
-- på en med komplett verdi-liste. Følger samme pattern som phase31.
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel       on rel.oid = con.conrelid
    join pg_namespace nsp   on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'workouts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%workout_type%'
  loop
    execute 'alter table public.workouts drop constraint if exists ' || quote_ident(r.conname);
  end loop;
end $$;

alter table public.workouts
  add constraint workouts_workout_type_check
  check (workout_type in (
    -- Standard utholdenhet/intensitet
    'long_run','interval','threshold','easy','recovery','technical','other',
    -- Konkurranse + test
    'competition','testlop','test',
    -- Skiskyting
    'hard_combo','easy_combo','basis_shooting','warmup_shooting',
    -- Legacy bakoverkompatibilitet
    'endurance','strength'
  ));

-- ── Reload PostgREST schema cache ────────────────────────────
notify pgrst, 'reload schema';
