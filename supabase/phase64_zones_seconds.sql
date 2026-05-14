-- Phase 64 — workout_activities.zones jsonb-verdier konverteres fra MINUTTER til SEKUNDER.
-- UI støtter nå MM:SS-input (1:30 = 90 sek, 0:45 = 45 sek) i tillegg til
-- ren minutt-input ("60" = 60 min). Lagringsformatet i jsonb er fra nå
-- alltid sekunder for å støtte sub-minutt-presisjon.
--
-- Migrasjonen multipliserer hver eksisterende numerisk verdi i zones-feltet
-- med 60. Idempotens: kjøres kun én gang — det finnes ingen flagg som
-- markerer rader som "konvertert". Kjør én gang og dokumenter.

update public.workout_activities
set zones = (
  select jsonb_object_agg(key, (value::numeric * 60)::int)
  from jsonb_each_text(zones)
  where value::numeric > 0
)
where zones is not null
  and jsonb_typeof(zones) = 'object'
  and exists (
    select 1 from jsonb_each_text(zones) where value::numeric > 0
  );

notify pgrst, 'reload schema';
