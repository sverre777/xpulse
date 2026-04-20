-- Fase 8.1: Fleksibel skyting — ny aktivitetstype `skyting_basis`.
-- Utvider CHECK-constraint på workout_activities.activity_type.

alter table public.workout_activities
  drop constraint if exists workout_activities_activity_type_check;

alter table public.workout_activities
  add constraint workout_activities_activity_type_check
  check (activity_type in (
    'oppvarming','aktivitet','pause','aktiv_pause',
    'skyting_liggende','skyting_staaende','skyting_kombinert',
    'skyting_innskyting','skyting_basis',
    'nedjogg','annet'
  ));

notify pgrst, 'reload schema';
