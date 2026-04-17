-- ── Fase 2.5 v2 — nye økttyper + bevegelseskolonner ──────────────────────────

-- STEG 1: Legg til workout_type hvis kolonnen mangler
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'workouts'
      and column_name  = 'workout_type'
  ) then
    alter table public.workouts
      add column workout_type text not null default 'long_run';
  end if;
end $$;

-- STEG 2: Fjern ALLE check-constraints på workout_type (uansett navn)
do $$
declare r record;
begin
  for r in
    select con.conname
    from   pg_constraint con
    join   pg_class      rel on rel.oid = con.conrelid
    join   pg_namespace  nsp on nsp.oid = rel.relnamespace
    where  nsp.nspname = 'public'
      and  rel.relname = 'workouts'
      and  con.contype = 'c'
      and  pg_get_constraintdef(con.oid) like '%workout_type%'
  loop
    execute 'alter table public.workouts drop constraint if exists ' || quote_ident(r.conname);
  end loop;
end $$;

-- STEG 3: Legg til ny constraint med alle gyldige verdier
alter table public.workouts
  add constraint workouts_workout_type_check
  check (workout_type in (
    'long_run','interval','threshold','easy',
    'competition','recovery','technical','other',
    'hard_combo','easy_combo','basis_shooting','warmup_shooting',
    'endurance','strength'   -- legacy-verdier for bakoverkompatibilitet
  ));

-- STEG 4: Legg til nye kolonner på workout_movements
alter table public.workout_movements
  add column if not exists avg_heart_rate    integer,
  add column if not exists inline_zones      jsonb default '[]'::jsonb,
  add column if not exists inline_exercises  jsonb default '[]'::jsonb;
