-- Fase 77: høyde- og varmetrening-markering
-- Utøvere vil markere økter (og hele årsplan-perioder) som høydetrening (med moh)
-- og enkeltøkter som varmetrening (med kroppstemperatur), for å kunne analysere
-- effekt/kontekst (form etter høydeopphold, varme-akklimatisering).
--
-- Arv-logikk (håndteres i app-laget): en periode markert som høyde gir default
-- høyde til øktene i perioden; per-økt moh overstyrer (man kan trene høyere enn
-- man bor/sover). Varme er KUN på økt-nivå (typisk enkeltøkter, ikke perioder).

-- ── Økt-nivå ──────────────────────────────────────────────
alter table public.workouts
  add column if not exists is_altitude_training boolean not null default false,
  add column if not exists altitude_meters integer,
  add column if not exists is_heat_training boolean not null default false,
  add column if not exists body_temperature numeric(4,1);

-- ── Periode-nivå (årsplan) ────────────────────────────────
-- Tabellnavnet for årsplan-perioder bekreftes mot schema; juster om nødvendig.
alter table public.season_periods
  add column if not exists is_altitude_period boolean not null default false,
  add column if not exists altitude_meters integer;

grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workouts to service_role;
grant select, insert, update, delete on public.season_periods to authenticated;
grant select, insert, update, delete on public.season_periods to service_role;

notify pgrst, 'reload schema';
