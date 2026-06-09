-- Fase 80: utvidet styrke-modul (live økt-modus + supersett)
-- Live styrkeøkt bygges som et tynt lag oppå eksisterende datamodell
-- (workouts + workout_activities + workout_activity_exercises +
-- workout_activity_exercise_sets). Bare to nye felt trengs:
--
--   1) workouts.live_started_at — markerer at en økt er "i gang" (draft) og gir
--      starttidspunkt for å regne total tid (inkl. pauser) robust mot app-lukking.
--      En draft med live_started_at != null og is_completed = false kan gjenopptas.
--   2) workout_activity_exercises.superset_group — øvelser med samme gruppe-nr er
--      et supersett (logges rundebasert). null = vanlig øvelse.
--
-- I tillegg en funksjonell indeks på lower(exercise_name) for raskt
-- "forrige økt på denne øvelsen"-oppslag (nøkles på navn, kontekst-uavhengig).

alter table public.workouts
  add column if not exists live_started_at timestamptz;

alter table public.workout_activity_exercises
  add column if not exists superset_group smallint;

create index if not exists idx_wae_exercise_name_lower
  on public.workout_activity_exercises (lower(exercise_name));

-- Grants (Supabase-regel: re-grant eksplisitt på berørte tabeller).
grant select, insert, update, delete on public.workouts                    to authenticated;
grant select, insert, update, delete on public.workouts                    to service_role;
grant select, insert, update, delete on public.workout_activity_exercises  to authenticated;
grant select, insert, update, delete on public.workout_activity_exercises  to service_role;

notify pgrst, 'reload schema';
