-- Phase 60 — Rename movement_name 'Ski-erg' → 'SkiErg' (CamelCase, matcher Concept2-produktnavnet).
-- Kjøres etter at lib/types.ts er deployet med ny streng-konstant. Eksisterende
-- workout_activities-rader må oppdateres så dropdownen i editoren matcher dem;
-- ellers vises de som "ukjent bevegelsesform" i UI etter renaming.

-- 1. Direkte kolonne — workout_activities.movement_name.
UPDATE workout_activities
SET movement_name = 'SkiErg'
WHERE movement_name = 'Ski-erg';

-- 2. Maler — workout_templates.activities er jsonb-array med activity-rader.
--    Strenge-replace fungerer her fordi 'Ski-erg' kun forekommer som
--    movement_name-verdi i denne strukturen, og er aldri en delstreng av et
--    annet navn.
UPDATE workout_templates
SET activities = REPLACE(activities::text, '"movement_name":"Ski-erg"', '"movement_name":"SkiErg"')::jsonb
WHERE activities::text LIKE '%"movement_name":"Ski-erg"%';

-- 3. Plan-templates — plan_templates.payload kan også inneholde planlagte
--    bevegelsesformer per dag.
UPDATE plan_templates
SET payload = REPLACE(payload::text, '"movement_name":"Ski-erg"', '"movement_name":"SkiErg"')::jsonb
WHERE payload::text LIKE '%"movement_name":"Ski-erg"%';

-- 4. Brukerens egne bevegelsesformer — user_movement_types.name. Treffes kun
--    hvis noen brukere har lagt til 'Ski-erg' selv (sjelden, men trygt).
UPDATE user_movement_types
SET name = 'SkiErg'
WHERE name = 'Ski-erg';
