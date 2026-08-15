-- Fase 84 (kø #47 G5): FJERN de gamle samling/høyde-FLAGGENE på
-- season_periods (fase 77/79). Markeringslaget (season_markings, fase 82)
-- er nå ENESTE kilde — all kodelesing OG -skriving ble lagt om i B2/G5
-- (grep-bevist: null gjenværende referanser; kompilatoren håndhever det
-- etter at feltene ble fjernet fra typene).
--
-- ⚠️ KJØR IKKE FØR:
--   1) Mal-rundtur-testen (sesong → mal → push) er verifisert OK live.
--   2) G5-koden (`app/actions/seasons.ts` uten flagg-skriving) er DEPLOYET —
--      ellers feiler createPeriod/updatePeriod. (Koden sluttet å skrive
--      flaggene i G5-committen; å kjøre denne FØR deploy gir feil ved
--      periode-lagring.)
--
-- ⚠️ ROLLBACK-NOTAT: Dette er et PUNKT UTEN RETUR for flagg-dataene.
-- Frem til nå kunne fase 82 rulles tilbake (flaggene sto urørt som kopi).
-- Etter denne migreringen finnes samling/høyde KUN i season_markings.
-- Tellevakten under AVBRYTER automatisk hvis antall migrerte markeringer
-- er lavere enn antall flaggede perioder — da mangler noe i season_markings
-- og ingenting droppes.

-- ── FØR-TELLING (kjør gjerne manuelt først og noter tallene) ──
--   select count(*) as flaggede from public.season_periods
--     where coalesce(is_training_camp,false) or coalesce(is_altitude_period,false);
--   select count(*) as migrerte from public.season_markings
--     where source_period_id is not null;

-- ── TELLEVAKT: avbryt hvis migreringen ikke dekker alle flaggede ──
do $$
declare
  flagged int;
  migrated int;
begin
  select count(*) into flagged from public.season_periods
    where coalesce(is_training_camp, false) or coalesce(is_altitude_period, false);
  select count(*) into migrated from public.season_markings
    where source_period_id is not null;
  if migrated < flagged then
    raise exception
      'AVBRUTT: % flaggede perioder, men bare % migrerte markeringer — kjør fase 82-migreringen på nytt før flaggene droppes.',
      flagged, migrated;
  end if;
  raise notice 'OK: % flaggede perioder, % migrerte markeringer — dropper flaggene.', flagged, migrated;
end $$;

-- ── DROPP (idempotent) ──────────────────────────────────────
alter table public.season_periods
  drop column if exists is_training_camp,
  drop column if exists location,
  drop column if exists is_altitude_period,
  drop column if exists altitude_meters;

notify pgrst, 'reload schema';

-- ── ETTER-VERIFISERING (kjør manuelt) ───────────────────────
-- 1) Kolonnene er borte:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'season_periods'
--   order by ordinal_position;
-- 2) Markeringene består (samme antall som «migrerte» i før-tellingen):
--   select count(*) from public.season_markings where source_period_id is not null;
-- 3) Stikkprøve på at arv/kalender fortsatt virker: åpne en økt midt i et
--    høydeopphold (skal arve moh) + sjekk 📍/🏔 i kalender og årsvisning.
