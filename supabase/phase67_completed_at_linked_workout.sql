-- Phase 67 — completed_at + linked_workout_id på workouts.
--
-- completed_at: tidsstempel for når brukeren markerte planlagt økt som gjennomført,
-- enten manuelt via "Marker som gjennomført"-knapp eller indirekte via Strava-sync
-- som markerer planlagte økter som fullført når en samme-dato-aktivitet importeres.
-- Eksisterende is_completed boolean beholdes for back-compat — completed_at gir oss
-- bare presisjonen til å vise "Gjennomført [dato]" i UI uten å lese updated_at
-- (som kan endres av andre felt-mutasjoner).
--
-- linked_workout_id: peker fra planlagt-økt → faktisk gjennomført importert økt.
-- Brukes når Strava-import kommer for samme dato som en planlagt økt og brukeren
-- velger "marker planlagt som gjennomført + behold importert separat". Da kan UI
-- vise lenke "Se faktisk økt" på den planlagte raden.

alter table public.workouts
  add column if not exists completed_at timestamptz,
  add column if not exists linked_workout_id uuid
    references public.workouts(id) on delete set null;

create index if not exists workouts_linked_workout_idx
  on public.workouts(user_id, linked_workout_id)
  where linked_workout_id is not null;

-- Backfill completed_at for eksisterende is_completed=true-rader.
-- Bruker updated_at som beste tilgjengelige proxy. Gjøres bare hvis null.
update public.workouts
set completed_at = updated_at
where is_completed = true and completed_at is null;

grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workouts to service_role;

notify pgrst, 'reload schema';
