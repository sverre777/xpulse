-- Fase 46 — sort_order på workouts for samme-dag-rekkefølge.
--
-- En utøver logger ofte flere økter på samme dag uten klokkeslett (f.eks.
-- "tidlig styrke" + "kveldsløp" uten å notere tid). Vi trenger en eksplisitt
-- rekkefølge så Økt 1/Økt 2-numrering blir stabil og brukeren kan endre den.
--
-- Lik sort_order på flere økter samme dag = "samme økt" (vises som Økt 1.1,
-- Økt 1.2 i UI). Default 0 og ikke-unik er bevisst — ingen retro-numrering
-- nødvendig, eksisterende rader behandles som "uten eksplisitt rekkefølge".
--
-- Idempotent.

alter table public.workouts
  add column if not exists sort_order integer not null default 0;

create index if not exists workouts_user_date_sort_idx
  on public.workouts(user_id, date, sort_order);

notify pgrst, 'reload schema';
