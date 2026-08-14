-- Fase 83 (kø #39 del E): VALGFRI nedbryting av månedsvolum — timer per
-- sone og/eller per bevegelsesform. Lagres på årsplanens månedsvolum
-- (monthly_volume_plans) — én kilde, ingen dobbeltlagring.
--
-- Format (ren jsonb {etikett: timer}):
--   zone_hours:     {"I1-2": 30, "I3": 8, "I4-5": 8}   (gruppert)
--                   {"I1": 20, "I2": 10, ...}           (detaljert)
--   movement_hours: {"Løping": 20, "Rulleski": 15}
-- NULL = ikke satt (default er kun totaltimer — ingen mas).
--
-- Idempotent: trygg å kjøre flere ganger. Ingen RLS-/grant-endringer
-- (kolonnene arver tabellens eksisterende policies og grants).
-- Koden er tolerant FØR kjøring (select * + betinget skriving), men
-- lagring av fordeling feiler med tydelig feilmelding til denne er kjørt.

alter table public.monthly_volume_plans
  add column if not exists zone_hours jsonb,
  add column if not exists movement_hours jsonb;

notify pgrst, 'reload schema';

-- ── VERIFISERING (kjør manuelt) ────────────────────────────
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'monthly_volume_plans'
--   order by ordinal_position;
-- Forventet: zone_hours jsonb + movement_hours jsonb nederst.
