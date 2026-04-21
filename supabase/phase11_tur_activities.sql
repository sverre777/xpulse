-- Fase 11: Tur + høydemeter på aktiviteter.
-- Utvider workout_activities med høydemeter og tur-spesifikke felt
-- (pakke-/pulkvekt, værforhold, temperatur).

alter table public.workout_activities
  add column if not exists pack_weight_kg  numeric(5,2),
  add column if not exists sled_weight_kg  numeric(5,2),
  add column if not exists elevation_gain_m int,
  add column if not exists elevation_loss_m int,
  add column if not exists weather         text,
  add column if not exists temperature_c   numeric(4,1);

notify pgrst, 'reload schema';
