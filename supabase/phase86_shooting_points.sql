-- Fase 86 (kø #47 bolk 4): RING-/POENGFELT på skyteserier.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Idempotent, ren additiv.
--
-- NSSF Test 1 (ringsum 5p/3p per serie, maks 25) og NSSF Test 4 (1–10 p per
-- enkeltskudd) fører POENG, ikke treff — eget felt så treff %-statistikken
-- aldri forurenses (hits-feltet klemmes til ≤ skudd i delt beregning).
-- Poeng kan leses av skuddplottet (ringverdi fra radius) eller føres manuelt.
-- Koden er tolerant FØR kjøring: kolonnen skrives kun når poeng faktisk er
-- ført i en serie.

alter table public.workout_shooting_series
  add column if not exists points numeric
    check (points is null or points >= 0);

notify pgrst, 'reload schema';

-- Verifisering:
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name='workout_shooting_series';
