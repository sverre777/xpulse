-- ── Fase 2.5 v2 — new workout types + movement inline data ──────────────────

-- 1. Drop old workout_type constraint and add new values
alter table public.workouts
  drop constraint if exists workouts_workout_type_check;

alter table public.workouts
  add constraint workouts_workout_type_check
  check (workout_type in (
    'long_run','interval','threshold','easy','competition','recovery','technical','other',
    'hard_combo','easy_combo','basis_shooting','warmup_shooting',
    -- legacy values for backward compat
    'endurance','strength'
  ));

-- 2. Add new columns to workout_movements
alter table public.workout_movements
  add column if not exists avg_heart_rate integer,
  add column if not exists inline_zones   jsonb default '[]'::jsonb,
  add column if not exists inline_exercises jsonb default '[]'::jsonb;

-- 3. Optional: migrate old endurance → long_run, strength → other
-- Run only if you want to migrate existing data:
-- update public.workouts set workout_type = 'long_run' where workout_type = 'endurance';
-- update public.workouts set workout_type = 'other'    where workout_type = 'strength';
