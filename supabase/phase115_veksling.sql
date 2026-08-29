-- ═══════════════════════════════════════════════════════════════════
-- FASE 115: AKTIVITETSTYPEN «VEKSLING» (bytt-tid, triatlon/multisport)
-- Kjøres av Sverre i prod ETTER godkjenning, FØR veksling-koden deployes.
--
-- Bakgrunn: T1/T2 har vært en SKJULT KONVENSJON — aktiv_pause med navnet
-- «T1»/«T2» i triatlon-malen. Nå en egen type med egen tidskategori
-- (verken treningstid eller pause). Radnavnet blir liggende i
-- movement_name som før — ingen ny kolonne, ingen datamigrering.
--
-- MÅLT 29. aug: prod har 0 rader som matcher T1/T2-konvensjonen
-- (4 pause-rader totalt, ingen med T1/T2/transisjon). Det finnes altså
-- INGENTING å migrere — bare malen som skal peke på den nye typen.
--
-- Denne DDL-en utvider KUN check-constrainten. Ingen backfill.
--
-- FØR  (forventet): 2 569 rader · 0 med activity_type = 'veksling'
-- ETTER (forventet): 2 569 rader · 0 med activity_type = 'veksling'
--                     (typen blir lovlig, men tas i bruk først av brukeren)
-- ═══════════════════════════════════════════════════════════════════

-- Vis constrainten som gjelder i dag (til loggen):
select pg_get_constraintdef(oid) as gjeldende_constraint
from pg_constraint
where conrelid = 'public.workout_activities'::regclass
  and conname = 'workout_activities_activity_type_check';

alter table public.workout_activities
  drop constraint if exists workout_activities_activity_type_check;

alter table public.workout_activities
  add constraint workout_activities_activity_type_check
  check (activity_type in (
    'oppvarming', 'aktivitet', 'pause', 'aktiv_pause', 'veksling',
    'skyting_liggende', 'skyting_staaende', 'skyting_kombinert',
    'skyting_innskyting', 'skyting_basis',
    'nedjogg', 'annet'
  ));

notify pgrst, 'reload schema';

-- Kontroll (lim inn resultatet i svaret):
select
  count(*)                                                as rader_totalt,
  count(*) filter (where activity_type = 'veksling')      as med_veksling
from public.workout_activities;
