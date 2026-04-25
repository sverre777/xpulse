-- ============================================================
-- Fase 33 — Fart/pace per km
--   • workout_activities.avg_pace_seconds_per_km   integer
--   • workout_activities.splits_per_km             jsonb     -- [{km:int, seconds:int}, …]
--   • workout_activities.pace_unit_preference      text      -- 'min_per_km' | 'km_per_h'
--   • profiles.default_pace_unit                   text      -- 'min_per_km' | 'km_per_h'
-- Idempotent. Kjør i Supabase SQL Editor.
-- ============================================================

alter table public.workout_activities
  add column if not exists avg_pace_seconds_per_km integer
    check (avg_pace_seconds_per_km is null
           or (avg_pace_seconds_per_km > 0 and avg_pace_seconds_per_km < 36000));

alter table public.workout_activities
  add column if not exists splits_per_km jsonb;

alter table public.workout_activities
  add column if not exists pace_unit_preference text
    check (pace_unit_preference is null
           or pace_unit_preference in ('min_per_km','km_per_h'));

alter table public.profiles
  add column if not exists default_pace_unit text
    check (default_pace_unit is null
           or default_pace_unit in ('min_per_km','km_per_h'));

-- ── Reload PostgREST schema cache ──────────────────────────
notify pgrst, 'reload schema';
