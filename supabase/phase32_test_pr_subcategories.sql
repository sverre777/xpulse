-- Phase 32: Utvid Test/PR med subcategory + custom_label.
-- Kobler manuelle Test/PR og workout-test-data til samme felles
-- struktur (sport → underkategori → fritekst "Egen") slik at samme
-- skjema kan brukes i Dagbok (workout_type='test') og i Analyse
-- ("+ Legg til Test/PR manuelt").
--
-- Idempotent: "add column if not exists".

alter table public.personal_records
  add column if not exists subcategory  text,
  add column if not exists custom_label text;

alter table public.workout_test_data
  add column if not exists subcategory  text,
  add column if not exists custom_label text;

-- Indeks for listevisning gruppert per sport → underkategori.
create index if not exists personal_records_user_sport_subcat_idx
  on public.personal_records(user_id, sport, subcategory);
create index if not exists workout_test_data_user_sport_subcat_idx
  on public.workout_test_data(user_id, sport, subcategory);

notify pgrst, 'reload schema';
