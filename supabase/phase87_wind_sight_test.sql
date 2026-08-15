-- Fase 87 (kø #49 VIND & SIKT, bolk 1): vind/sikt per skyteserie + test-flagg på øktmal.
-- SENDES FOR GODKJENNING — IKKE KJØR før godkjent. Idempotent, rent additiv.
--
-- AVHENGIGHETSSTATUS (rapporteres, jf. bestillingen «sjekk koden først»):
--  · #47 seriemodellen ER landet (phase85 kjørt) → vind/sikt legges på
--    workout_shooting_series slik spec-en primært beskriver.
--  · #48 standardøkter er IKKE startet → test-sammenligningen (bolk 5)
--    bygges delt/generisk slik spec-en beskriver; ingen DB-avhengighet her.
--
-- DATAMODELL-VALG (rapporteres):
--  · Vi lagrer det utøveren SER — vimpelretning + styrke, ingen meteorologi:
--    vind_retning 'V'|'H' (vimpelen peker mot venstre/høyre), vind_styrke 0–5
--    (0 = vindstille — appen setter da vind_retning null; DB håndhever kun
--    verdiområdene så gamle/delvise rader aldri avvises).
--  · Vimpel-skalaens 11 tilstander = (retning V|H × styrke 1–5) + vindstille.
--  · sikt: 'god'|'lett_taake'|'taake'|'tett_taake' — valgfritt, samme popup.
--  · Alt nullable: tomt = ikke ført (samme «kun førte»-prinsipp som treff).
--  · TEST-MAL er IKKE egen entitet: workout_templates.is_test boolean —
--    skytetest-maler og alle idretters test-maler bruker samme flagg.
--    NSSF-standardene forblir låst i kode (lib/shooting-test-templates.ts).
--  · RLS: ingen nye policyer — kolonnene følger radpolicyene som allerede
--    finnes (workout_shooting_series: Own + Coach read/write fra phase85;
--    workout_templates: RLS enabled m/ «Own templates»).

-- ── FØR-TELLING ─────────────────────────────────────────────
do $$
declare
  n_series bigint;
  n_templates bigint;
begin
  select count(*) into n_series from public.workout_shooting_series;
  select count(*) into n_templates from public.workout_templates;
  raise notice 'FØR: % skyteserier, % øktmaler', n_series, n_templates;
end $$;

-- ── 1. Vind + sikt per skyteserie ───────────────────────────
alter table public.workout_shooting_series
  add column if not exists vind_retning text
    check (vind_retning in ('V', 'H')),
  add column if not exists vind_styrke int
    check (vind_styrke between 0 and 5),
  add column if not exists sikt text
    check (sikt in ('god', 'lett_taake', 'taake', 'tett_taake'));

-- ── 2. Test-flagg på øktmal ─────────────────────────────────
alter table public.workout_templates
  add column if not exists is_test boolean not null default false;

-- ── ETTER-TELLING + VERIFISERING ───────────────────────────
-- Additiv migrering: radantall UENDRET; alle nye vind/sikt-felter null;
-- ingen serier med vind_styrke utenfor 0–5 (spec-kravet håndheves også
-- av check-constrainten); ingen maler flagget som test ennå.
do $$
declare
  n_series bigint;
  n_templates bigint;
  n_wind bigint;
  n_bad bigint;
  n_test bigint;
begin
  select count(*) into n_series from public.workout_shooting_series;
  select count(*) into n_templates from public.workout_templates;
  select count(*) into n_wind from public.workout_shooting_series
    where vind_retning is not null or vind_styrke is not null or sikt is not null;
  select count(*) into n_bad from public.workout_shooting_series
    where vind_styrke is not null and (vind_styrke < 0 or vind_styrke > 5);
  select count(*) into n_test from public.workout_templates where is_test;
  raise notice 'ETTER: % skyteserier, % øktmaler', n_series, n_templates;
  raise notice 'Serier m/ vind/sikt: % (forventet 0) · vind_styrke utenfor 0–5: % (forventet 0) · test-maler: % (forventet 0)',
    n_wind, n_bad, n_test;
  if n_bad > 0 then
    raise exception 'Verifisering feilet: % serier med vind_styrke utenfor 0–5', n_bad;
  end if;
end $$;

grant select, insert, update, delete on public.workout_shooting_series to authenticated;
grant select, insert, update, delete on public.workout_shooting_series to service_role;
grant select, insert, update, delete on public.workout_templates to authenticated;
grant select, insert, update, delete on public.workout_templates to service_role;

notify pgrst, 'reload schema';
