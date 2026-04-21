-- Fase 19: Form-topp markering for nøkkeldatoer.
-- En bruker kan markere utvalgte nøkkeldatoer (typisk A-konkurranser) som
-- form-topp-mål. Disse får gull-glød i Årskalender og Plan.

alter table public.season_key_dates
  add column if not exists is_peak_target boolean not null default false;

notify pgrst, 'reload schema';
