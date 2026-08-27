-- phase107 — imported_activities.source får verdien 'stridee'.
--
-- Klokkesynk-importen (bolk 4) skriver anti-duplikatrader med
-- source = 'stridee'. Constrainten fra phase89 tillater bare
-- strava/fit_upload/garmin/polar og må utvides.
--
-- KJØRES VIA CHAT: korte linjer, rene statements, verifisering til slutt
-- (se sql-korte-linjer-regelen). Ingen dollar-blokker nødvendig her.

alter table public.imported_activities
  drop constraint if exists imported_activities_source_check;

alter table public.imported_activities
  add constraint imported_activities_source_check
  check (source in (
    'strava',
    'fit_upload',
    'garmin',
    'polar',
    'stridee'
  ));

-- Verifisering: skal vise den nye definisjonen med 'stridee'.
select pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.imported_activities'::regclass
   and conname = 'imported_activities_source_check';
