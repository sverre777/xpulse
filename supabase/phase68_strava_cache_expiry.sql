-- Phase 68 — Strava API Agreement § 7 compliance: rå Strava-data (samples)
-- må slettes etter maks 7 dager. cache_expires_at-kolonnen markerer når en
-- samples-rad er klar for sletting via /api/cron/cleanup-strava-samples.
--
-- Aggregerte verdier (workout-tittel, varighet, sone-fordeling, lap-data)
-- beholdes permanent — kun rå sekund-data (hr_samples, watt_samples osv.)
-- regnes som "raw data" per Stravas definisjon.
--
-- Ikke-Strava-samples (FIT-upload, Garmin-direkte) får null i feltet og
-- påvirkes ikke av cleanup-cron.

alter table public.workout_samples
  add column if not exists cache_expires_at timestamptz;

-- Backfill: eksisterende Strava-samples får frist = imported_at + 7 dager.
-- imported_at finnes på workout_samples-raden selv (created_at), eller via
-- imported_activities-tabellen. Bruker created_at som proxy siden phase50
-- alltid setter den ved insert.
update public.workout_samples ws
set cache_expires_at = ws.created_at + interval '7 days'
where ws.source = 'strava'
  and ws.cache_expires_at is null;

-- Indeks for raske cleanup-queries (cron leser daglig).
create index if not exists workout_samples_strava_expiry_idx
  on public.workout_samples(cache_expires_at)
  where source = 'strava' and cache_expires_at is not null;

-- strava_connections: add disconnected_at for revisjon ved frakobling.
alter table public.strava_connections
  add column if not exists disconnected_at timestamptz;

grant select, insert, update, delete on public.workout_samples       to authenticated;
grant select, insert, update, delete on public.workout_samples       to service_role;
grant select, insert, update, delete on public.strava_connections    to authenticated;
grant select, insert, update, delete on public.strava_connections    to service_role;

notify pgrst, 'reload schema';
