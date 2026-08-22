-- Fase 103 — sleep_records.sleep_score: manuell søvnscore (0–100).
-- KJØRT I PROD 2026-08-22. Faktisk resultat er notert nederst.
--
-- HVORFOR EN NY KOLONNE, OG IKKE ET AV DE TO STEDENE SCOREN ALLEREDE FINNES:
--
--  · `daily_health.sleep_quality` er 1–5-skalaen («opplevd kvalitet»). En
--    score fra klokka er 0–100 og en annen ting — å presse den inn der ville
--    ødelagt både historikken og skalaen.
--  · `health_brand_metrics.metrics->>'sleep_score'` er MERKETS egen score
--    (Polar i dag). Den tabellen tømmes med `delete where brand = …` ved
--    frakobling, og brand-kolonnen har en CHECK som ikke tillater 'manual'.
--    Legger vi brukerens egen score der, forsvinner den den dagen klokka
--    kobles fra — og den ville utgitt seg for å komme fra et merke.
--
-- Den hører hjemme i fellesfelt-laget, `sleep_records`, med kilde 'manual' i
-- `sources` — da er den vernet av «manuell vinner»-regelen
-- (lib/health-source-rules.ts) akkurat som resten av søvnfeltene.
--
-- ══════════════════════════════════════════════════════════════
-- TO FELLER I SUPABASE-EDITOREN, som formet denne fila (2026-08-22):
--
--  1. `sources ? 'nokkel'` (jsonb «har nøkkel») gir syntaksfeil — `?` tolkes
--     som en parameter-plassholder. Bruk `sources->>'nokkel' is not null`.
--  2. Lange innlimte blokker BLIR MANGLET av editoren (tegn faller ut midt i
--     ord), og dashbordet føyer på egne `ALTER TABLE … ENABLE ROW LEVEL
--     SECURITY`-linjer for det den tror er nye tabeller. En do-blokk med
--     assertions var derfor ikke kjørbar. Endringen ble delt i korte
--     setninger som limes inn ÉN og ÉN, og vernet ligger i at STEG 1 og
--     STEG 3 telles og sammenlignes manuelt.
--
--     Skriv derfor korte setninger i migreringsfiler herfra, og la
--     før/etter-tellingen være vernet — ikke en do-blokk som ikke kommer
--     gjennom editoren.
-- ══════════════════════════════════════════════════════════════

-- ══ STEG 1 — FØR (ren lesing; kjør denne alene først) ══
-- SKJEMA-REGELEN: migreringsfilene i repoet er ikke fasit for prod. Se
-- faktisk skjema før noe endres. Forventet: sleep_score_finnes = 0.
select
  (select count(*) from public.sleep_records) as sleep_rader,
  (select count(*) from public.sleep_records where sources->>'perceived_quality' is not null) as med_manuell_kvalitet,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='sleep_records' and column_name='sleep_score') as sleep_score_finnes,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='sleep_records') as antall_kolonner;

-- ══ STEG 2a — kolonnen (idempotent) ══
alter table public.sleep_records add column if not exists sleep_score integer;

-- ══ STEG 2b — grensen 0–100 ══
-- Ny kjøring gir «constraint already exists». Ufarlig: ingenting endres.
alter table public.sleep_records
  add constraint sleep_records_sleep_score_check
  check (sleep_score is null or sleep_score between 0 and 100);

-- ══ STEG 3 — ETTER ══
-- Fasit: sleep_rader UENDRET fra steg 1, med_score = 0 (ingen eksisterende
-- rad rørt), sleep_score_finnes = 1, antall_kolonner én høyere.
select
  (select count(*) from public.sleep_records) as sleep_rader,
  (select count(*) from public.sleep_records where sleep_score is not null) as med_score,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='sleep_records' and column_name='sleep_score') as sleep_score_finnes,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='sleep_records') as antall_kolonner;

-- ══ FAKTISK KJØRING 2026-08-22 ══
--   STEG 1:  sleep_rader 1 · med_manuell_kvalitet 0 · sleep_score_finnes 0 · antall_kolonner 15
--   STEG 2a: success
--   STEG 2b: success
--   STEG 3:  sleep_rader 1 · med_score 0 · sleep_score_finnes 1 · antall_kolonner 16
--   ⇒ raden er urørt, kolonnen er lagt til tom, som planlagt.
--
-- RLS: sleep_records har allerede egen policy per bruker (fase 91) + fase 92s
-- trener-lesing. En ny kolonne arver den — ingen policy-endring trengs.
