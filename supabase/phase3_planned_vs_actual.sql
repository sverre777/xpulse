-- ─────────────────────────────────────────────────────────────
-- Phase 3 — Planlagt vs faktisk gjennomført
-- Separerer planens innhold fra faktisk gjennomført økt
-- Alle nye felt er NULLABLE. Eksisterende felt (duration_minutes,
-- distance_km, workout_zones, workout_movements) beholdes som fallback
-- for eksisterende rader og generelle oppsummeringer.
-- ─────────────────────────────────────────────────────────────

alter table public.workouts
  add column if not exists planned_minutes         int,
  add column if not exists planned_km              numeric(6,2),
  add column if not exists planned_zones           jsonb,
  add column if not exists planned_movement_types  jsonb,
  add column if not exists actual_minutes          int,
  add column if not exists actual_km               numeric(6,2),
  add column if not exists actual_zones            jsonb,
  add column if not exists actual_movement_types   jsonb;

-- Forventet struktur for jsonb-feltene:
--
--   planned_zones / actual_zones:
--     [{ "zone_name": "I1", "minutes": 30 }, { "zone_name": "I2", "minutes": 15 }]
--
--   planned_movement_types / actual_movement_types:
--     [{ "movement_name": "Løping", "minutes": 45, "distance_km": 9.2 }]
--
-- Feltene fylles ut slik:
--   • Økt opprettet i Plan  → planned_* settes, actual_* forblir null
--   • Planlagt økt merket gjennomført i Dagbok
--                           → actual_* settes, planned_* bevares uendret
--   • Ikke-planlagt logg i Dagbok
--                           → actual_* settes, planned_* forblir null

-- Valgfrie indekser for raskere oppslag når disse feltene brukes
-- i analyse-/periodiseringsvisning senere:
create index if not exists workouts_planned_minutes_idx
  on public.workouts (user_id, date)
  where planned_minutes is not null;

create index if not exists workouts_actual_minutes_idx
  on public.workouts (user_id, date)
  where actual_minutes is not null;
