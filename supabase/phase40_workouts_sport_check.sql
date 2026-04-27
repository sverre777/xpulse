-- Phase 40 — Fix workouts_sport_check
--
-- Bakgrunn:
-- Den aktive constrainten på public.workouts.sport (fra eldre schema.sql) tillater
-- kun 5 verdier: running, cross_country_skiing, biathlon, triathlon, other.
-- Men 'other' er ikke en del av Sport-typen i koden, og constrainten mangler
-- cycling, long_distance_skiing og endurance som koden faktisk bruker.
-- Resultat: insert/update av økter med disse sportene feiler med
-- "violates check constraint workouts_sport_check".
--
-- Fix: erstatt constrainten med samtlige 7 verdier fra `Sport`-typen i
-- lib/types.ts:2-4. Disse er de eneste verdiene koden faktisk skriver til
-- workouts.sport. (TestPRSport — løping/sykling/svømming/etc — er en
-- separat type for personal_records-tabellen og er ikke relevant her.)
--
-- Tilsvarende constraint på profiles.primary_sport ble allerede satt korrekt
-- i phase2_schema.sql med samme 7 verdier — den lar vi være.
--
-- Idempotent: drop if exists → add.

alter table public.workouts
  drop constraint if exists workouts_sport_check;

alter table public.workouts
  add constraint workouts_sport_check
  check (sport in (
    'running',
    'cross_country_skiing',
    'biathlon',
    'triathlon',
    'cycling',
    'long_distance_skiing',
    'endurance'
  ));

notify pgrst, 'reload schema';
