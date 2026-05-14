-- Phase 66 — workouts.imported_from text-kolonne for badge-visning.
-- Indikerer kilden hvis økten er importert fra ekstern tjeneste:
--   'strava'  — Strava-import via /api/strava/* eller bulk-import-route
--   'fit'     — .fit-fil opplastet via klokkesync (kommer)
--   null      — manuelt logget i Dagbok
--
-- Vi bruker ikke imported_activities-tabellen direkte for badge-visning fordi
-- det ville krevd N+1-joins i kalender-spørringer. Denormalisert kolonne
-- gir én indeks-lookup per økt og oppdateres ved import-tid.

alter table public.workouts
  add column if not exists imported_from text;

-- Backfill: alle workouts som har en imported_activities-rad markeres med
-- kilden. Idempotent — kjøres på nytt setter samme verdi.
update public.workouts w
set imported_from = ia.source
from public.imported_activities ia
where ia.workout_id = w.id
  and (w.imported_from is null or w.imported_from = '');

-- Indeks for raskere "vis kun importerte"-filter (sjelden, men billig).
create index if not exists workouts_imported_from_idx
  on public.workouts(user_id, imported_from)
  where imported_from is not null;

-- Standard grants per memory #28-pattern.
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workouts to service_role;

notify pgrst, 'reload schema';
