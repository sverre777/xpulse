-- Fase 17: Fjern 'Triathlon' som bevegelsesform.
-- Triathlon er en sport (valgt øverst i skjemaet), ikke en bevegelsesform.
-- Eksisterende aktiviteter med movement_name='Triathlon' migreres til 'Løping'
-- (default fallback — utøveren kan endre manuelt om ønskelig).

update public.workout_activities
set movement_name = 'Løping'
where movement_name = 'Triathlon';

notify pgrst, 'reload schema';
