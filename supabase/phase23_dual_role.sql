-- Phase 23: Dual-role system
-- A user can be both athlete ("utøver") and coach ("trener").
-- The old `role` column is kept for backwards compatibility but is no longer
-- actively used. UI/routing/RLS should rely on the new flags + active_role.

alter table public.profiles
  add column if not exists has_athlete_role boolean not null default true,
  add column if not exists has_coach_role boolean not null default false,
  add column if not exists active_role text default 'athlete' check (active_role in ('athlete','coach'));

-- Backfill from existing role values.
update public.profiles
set has_athlete_role = (role = 'athlete' or role is null),
    has_coach_role  = (role = 'coach'),
    active_role     = coalesce(active_role, case when role = 'coach' then 'coach' else 'athlete' end);

-- Ensure everyone has at least one role.
update public.profiles
set has_athlete_role = true
where has_athlete_role = false
  and has_coach_role = false;

notify pgrst, 'reload schema';
