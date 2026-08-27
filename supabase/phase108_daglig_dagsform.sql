-- phase108 — daglig dagsform (følelse) på daily_health.
--
-- Beslutning 27. aug: daglig energiføring bruker SAMME skala som
-- økt-følelsen (1–5, StarRating) — eget felt for DAGEN, adskilt fra
-- øktenes day_form_physical/mental. daily_health er det manuelle laget
-- (importer rører den aldri), så feltet bor der.
--
-- KJØRES VIA CHAT: korte linjer, verifisering til slutt.

alter table public.daily_health
  add column if not exists day_form smallint;

alter table public.daily_health
  drop constraint if exists daily_health_day_form_check;

alter table public.daily_health
  add constraint daily_health_day_form_check
  check (
    day_form is null
    or day_form between 1 and 5
  );

-- Verifisering: kolonnen finnes med riktig type.
select column_name, data_type
  from information_schema.columns
 where table_name = 'daily_health'
   and column_name = 'day_form';
