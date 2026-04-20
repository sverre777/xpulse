-- Fase 8.3: Pulsprofil-felter på profiles.
-- Brukes av Innstillinger → Pulssoner. Alle valgfrie.

alter table public.profiles
  add column if not exists max_heart_rate int
    check (max_heart_rate is null or (max_heart_rate between 100 and 250)),
  add column if not exists lactate_threshold_hr int
    check (lactate_threshold_hr is null or (lactate_threshold_hr between 80 and 230)),
  add column if not exists resting_heart_rate int
    check (resting_heart_rate is null or (resting_heart_rate between 25 and 120));

notify pgrst, 'reload schema';
