-- ============================================================
-- Fase 112 — Prestasjonsmodellen bolk 6: profil-utvidelse +
-- førstegangsvarsel.
--
-- Målt i prod 28. aug (32 profiler): profiles HAR allerede
-- first/last/full_name, birth_year, gender, country, primary_sport,
-- secondary_sports, profile_image_url + bilde-opplasting. Vekt bor i
-- daily_health.body_weight_kg (helseflatens kilde — profilfeltet
-- leser/skriver SAMME felt, regel 11 — ingen ny kolonne).
--
-- Nytt: brukernavn (unikt, normalisert lowercase — unikheten
-- håndheves case-insensitivt i basen), fødselsdato (birth_year
-- beholdes som AVLEDET felt for sone-fallback og skrives i samme
-- lagring — birth_date er fasit når begge finnes), høyde, og
-- server-side hukommelse for førstegangsvarselet (aldri
-- localStorage alene).
--
-- FØR (kjør separat):
--   select count(*) as profiler from public.profiles;   -- målt: 32
-- Idempotent. KJØRES IKKE før Sverre har godkjent.
-- ============================================================

alter table public.profiles
  add column if not exists username text;
alter table public.profiles
  add column if not exists birth_date date;
alter table public.profiles
  add column if not exists height_cm integer
    check (height_cm is null or height_cm between 100 and 250);
alter table public.profiles
  add column if not exists profilvarsel_lukket_at timestamptz;

-- Unikhet case-insensitivt: «Sverre» og «sverre» er samme navn.
create unique index if not exists profiles_username_unik_idx
  on public.profiles (lower(username))
  where username is not null;

-- ETTER (kjør separat):
--   select count(*) as profiler,
--          count(username) as med_brukernavn,
--          count(birth_date) as med_fodselsdato,
--          count(height_cm) as med_hoyde,
--          count(profilvarsel_lukket_at) as varsel_lukket
--     from public.profiles;
--   -- Forventet: 32 · 0 · 0 · 0 · 0 (alt nytt starter tomt).

notify pgrst, 'reload schema';
