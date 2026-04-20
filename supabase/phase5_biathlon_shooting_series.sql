-- ============================================================
-- Fase 5 — Skiskyting som sport (ikke bevegelsesform) + serie-basert skyting
-- Kjør i Supabase SQL Editor (idempotent)
-- ============================================================

-- ── workout_shooting_blocks: nye kolonner ──────────────────
-- start_time:       klokkeslett serien ble skutt (HH:MM, for pulssync)
-- duration_seconds: hvor lang tid serien tok
-- avg_heart_rate:   snittpuls under serien
alter table public.workout_shooting_blocks
  add column if not exists start_time time,
  add column if not exists duration_seconds integer,
  add column if not exists avg_heart_rate integer;

-- ── Oppdater shooting_type-check med nye verdier ────────────
-- Mulige verdier: rolig_komb, hurtighet_komb, hard_komb,
--                 innskyting, basisskyting, konkurranse
alter table public.workout_shooting_blocks
  drop constraint if exists workout_shooting_blocks_shooting_type_check;

alter table public.workout_shooting_blocks
  add constraint workout_shooting_blocks_shooting_type_check
  check (shooting_type in (
    'rolig_komb','hurtighet_komb','hard_komb',
    'innskyting','basisskyting','konkurranse'
  ));

-- ── Migrér eksisterende data ───────────────────────────────
-- Skiskyting er ikke lenger en bevegelsesform. Alle økter som har
-- 'Skiskyting' som movement_name: sett workouts.sport='biathlon'
-- og gi bevegelsen navnet 'Langrenn' i stedet.
update public.workouts w
set sport = 'biathlon'
from public.workout_movements m
where m.workout_id = w.id
  and m.movement_name = 'Skiskyting'
  and w.sport <> 'biathlon';

update public.workout_movements
set movement_name = 'Langrenn'
where movement_name = 'Skiskyting';

-- ── Reload PostgREST schema-cache ──────────────────────────
notify pgrst, 'reload schema';
