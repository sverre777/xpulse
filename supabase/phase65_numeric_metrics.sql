-- Phase 65 — Konverter integer-kolonner som mottar Strava/FIT-desimaler til numeric.
-- Strava returnerer average_heartrate som FLOAT (f.eks. 121.1), men workout_activities.
-- avg_heart_rate og workouts.avg_heart_rate/max_heart_rate er definert som integer
-- i basis-schemaet. Resultat: "invalid input syntax for type integer: 121.1" som
-- aborterte 89 av 100 bulk-import-forsøk.
--
-- Phase51-kolonner (avg_watts, max_watts, avg_speed_ms, max_speed_ms, avg_cadence,
-- max_cadence) er allerede numeric(6,1)/numeric(6,3) — kun max_hr trenger konvertering.

alter table public.workouts
  alter column avg_heart_rate type numeric(5,1) using avg_heart_rate::numeric,
  alter column max_heart_rate type numeric(5,1) using max_heart_rate::numeric;

alter table public.workout_activities
  alter column avg_heart_rate type numeric(5,1) using avg_heart_rate::numeric,
  alter column max_hr         type numeric(5,1) using max_hr::numeric;

-- Grants (per memory #28-pattern): RLS-policies styrer per-bruker-tilgang;
-- grants gir PostgREST lov å se kolonnene etter type-endring.
grant select, insert, update, delete on public.workouts            to authenticated;
grant select, insert, update, delete on public.workouts            to service_role;
grant select, insert, update, delete on public.workout_activities  to authenticated;
grant select, insert, update, delete on public.workout_activities  to service_role;

-- Reload PostgREST schema-cache så ny kolonne-type blir synlig.
notify pgrst, 'reload schema';
