-- Fase 79: treningssamling som periode-markering
-- Treningssamling flyttes fra nøkkeldatoer (season_key_dates event_type='camp')
-- til å være en MARKERING på en årsplan-periode (som høydetrening). Når en
-- periode markeres som treningssamling får den et sted (location). Tittelen er
-- periodens navn (season_periods.name).
--
-- is_training_camp er uavhengig av is_altitude_period (en periode kan være begge,
-- f.eks. en høydesamling). Endringen deles automatisk med trener via de samme
-- delte komponentene/serveractions (resolveTargetUser + getSeasonPeriods).

alter table public.season_periods
  add column if not exists is_training_camp boolean not null default false,
  add column if not exists location text;

grant select, insert, update, delete on public.season_periods to authenticated;
grant select, insert, update, delete on public.season_periods to service_role;

notify pgrst, 'reload schema';
