-- ============================================================
-- Fase 113 — «Legg til detaljer» bolk 1: tidsvinduer på
-- aktivitetsrader. Fasit: design/xpulse-tidsplassering-design.html
-- (V9.3).
--
-- Målt i prod 28. aug:
--   · workout_activities: 2 565 rader; sort_order finnes (visnings-
--     rekkefølge — röres ALDRI av tidsplassering); start_time (TIME)
--     finnes men brukes knapt (18 rader) og er klokkeslett, ikke
--     kurve-offset — den lar vi ligge.
--   · Skytetid bor i workout_shooting_series.time_seconds (ført hos
--     3 av 44 serier) — DET er statistikk-porten; vinduet under er
--     aldri statistikk.
--   · Punktmarkørene trenger INGEN nye kolonner (regel 11):
--     laktat øktnivå = workout_lactate_measurements.measured_at_time
--     (TIME), aktivitetsnivå = workout_activity_lactate_measurements
--     .measured_at (TIME), ernæring = workout_nutrition_entries
--     .time_offset_minutes. Drag-punktene skriver de EKSISTERENDE
--     feltene (klokkeslett avledes som time_of_day + offset — samme
--     fallback som øktgrafen leser med i dag).
--
-- To nye VALGFRIE kolonner — tidsplassering er DATA, forankret i
-- øktas tidslinje (sekunder fra start). Begge null = raden er ikke
-- plassert (ingen backfill; alle 2 565 eksisterende rader står uten
-- vindu). window_duration_seconds er VINDUETS lengde (f.eks. 40 s
-- puls-markering for skyting uten ført tid) og er BEVISST adskilt fra
-- duration_seconds (radens varighet, statistikk).
-- Idempotent. KJØRES IKKE før Sverre har godkjent.
-- ============================================================

alter table public.workout_activities
  add column if not exists window_start_seconds integer
    check (window_start_seconds is null or window_start_seconds >= 0);

alter table public.workout_activities
  add column if not exists window_duration_seconds integer
    check (window_duration_seconds is null
           or window_duration_seconds between 1 and 86400);

-- FØR (kjør separat):
--   select count(*) as rader from public.workout_activities;
--   -- Målt 28. aug: 2565
-- ETTER (kjør separat):
--   select count(*) as rader,
--          count(window_start_seconds) as med_vindu
--     from public.workout_activities;
--   -- Forventet: 2565 · 0 (ingen backfill — alt starter uplassert).

notify pgrst, 'reload schema';
