-- Phase 24: Treadmill incline (%) on running activities
alter table public.workout_activities
  add column if not exists incline_percent numeric(4,1);

notify pgrst, 'reload schema';
