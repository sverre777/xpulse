-- Phase 67b — Defensiv kombinert kolonne-fiks for workouts-tabellen.
--
-- Bakgrunn: forrige deploy-runde la inn TO sett med kolonne-utvidelser:
--   * phase66_workouts_imported_from.sql (imported_from text)
--   * phase67_completed_at_linked_workout.sql (completed_at, linked_workout_id)
--
-- Hvis kun én av disse var kjørt mot prod og koden refererer til den andre,
-- får alle calendar-spørringer (getCalendarWorkouts/getWorkoutsForMonth)
-- "column does not exist" og hele Plan/Dagbok-siden krasjer.
--
-- Denne fila er fullt idempotent (alle add-er er IF NOT EXISTS) og kjører
-- ALT som koden krever i én sleng. Trygg å kjøre selv om alt allerede finnes.

alter table public.workouts
  add column if not exists imported_from     text,
  add column if not exists completed_at      timestamptz,
  add column if not exists linked_workout_id uuid
    references public.workouts(id) on delete set null;

-- Indekser for kalender-filter + "se faktisk økt"-lookup.
create index if not exists workouts_imported_from_idx
  on public.workouts(user_id, imported_from)
  where imported_from is not null;

create index if not exists workouts_linked_workout_idx
  on public.workouts(user_id, linked_workout_id)
  where linked_workout_id is not null;

-- Backfill imported_from fra imported_activities-tabellen for eksisterende
-- Strava-importer som ble lagret før kolonnen fantes. Idempotent.
update public.workouts w
set imported_from = ia.source
from public.imported_activities ia
where ia.workout_id = w.id
  and (w.imported_from is null or w.imported_from = '');

-- Backfill completed_at = updated_at for eksisterende is_completed=true-rader
-- som mangler eksplisitt tidsstempel. Idempotent.
update public.workouts
set completed_at = updated_at
where is_completed = true and completed_at is null;

-- Grants (per memory #28-pattern) — RLS-policies styrer per-bruker-tilgang.
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workouts to service_role;

-- Reload PostgREST schema-cache så nye kolonner blir synlige for klienten.
notify pgrst, 'reload schema';
