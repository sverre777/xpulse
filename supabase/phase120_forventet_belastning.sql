-- ══════════════════════════════════════════════════════════════════════
-- FASE 120 — FORVENTET BELASTNING PÅ PLANLAGT ØKT (Øktbygger bolk 5)
-- ══════════════════════════════════════════════════════════════════════
-- TIL GODKJENNING — IKKE KJØRT. Kjøres setning for setning i Supabase
-- SQL-editoren (korte linjer, aldri do-blokker — regel fra fase 103).
--
-- HVORFOR: plan-grafens nøkkeltallsrad har cellen «forventet 1–10» —
-- planleggerens (utøver eller trener) egen vurdering, i samme skala som
-- opplevd belastning på den gjennomførte økta, så «forventet 6 → opplevd
-- 8» kan leses rett av. workouts.rpe er OPPLEVD og settes ved
-- gjennomføring på SAMME rad (planen markeres gjennomført, den
-- dupliseres ikke) — derfor kan ikke rpe bære forventet: den ville blitt
-- overskrevet i det økta gjennomføres. Målt 2. sep 2026: ingen
-- kolonne for forventet finnes (workouts har rpe, planned_minutes,
-- planned_km, planned_zones, planned_movement_types, planned_snapshot).
--
-- ÉN kolonne, ett felt for utøver og trener (regel 19). Ingen backfill:
-- tomt betyr «ikke ført» og vises som «—» med mulighet for å sette.

-- ══ STEG 1 — FØR ═══════════════════════════════════════════════════════
-- Riktig prosjekt: qknzigesgtmbmxuwtvrm. Kjør og noter tallene.
select count(*) as okter from workouts;
-- Forventet (2. sep 2026): 954 (+ e2e-testbrukerens økter mens de finnes).
select count(*) as har_kolonne
from information_schema.columns
where table_name = 'workouts' and column_name = 'forventet_belastning';
-- Forventet: 0

-- ══ STEG 2 — ENDRING ═══════════════════════════════════════════════════
alter table workouts
  add column forventet_belastning smallint;
alter table workouts
  add constraint workouts_forventet_belastning_check
  check (forventet_belastning is null or (forventet_belastning between 1 and 10));
comment on column workouts.forventet_belastning is
  'Planleggerens forventede belastning 1–10 (samme skala som rpe). Settes på planlagt økt, sammenlignes med rpe etter gjennomføring.';

-- ══ STEG 3 — ETTER ═════════════════════════════════════════════════════
select count(*) as okter from workouts;
-- Forventet: samme tall som STEG 1.
select count(*) as har_kolonne
from information_schema.columns
where table_name = 'workouts' and column_name = 'forventet_belastning';
-- Forventet: 1
select count(*) as med_verdi from workouts where forventet_belastning is not null;
-- Forventet: 0 (ingen backfill).

-- ══ KJØRT ══════════════════════════════════════════════════════════════
-- (fylles inn med faktiske FØR/ETTER-tall når Sverre har kjørt den)
