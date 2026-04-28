-- Fase 48b — Sørg for fat_g-kolonne på workout_nutrition_entries.
--
-- Den første versjonen av phase48 manglet fat_g. Senere ble den lagt til,
-- men hvis du allerede hadde kjørt den første versjonen og ikke har re-
-- kjørt phase48, så mangler kolonnen i din DB.
--
-- Denne fila gjør kun ALTER + reload schema. Trygt å kjøre flere ganger.

alter table public.workout_nutrition_entries
  add column if not exists fat_g numeric(6,1);

notify pgrst, 'reload schema';
