-- Fase 8.2: Bytt til Olympiatoppens I-skala som default pulssoner.
-- Oppdaterer alle eksisterende user_heart_zones-rader til OLT-ranges
-- basert på brukerens birth_year i profiles. Mangler birth_year → fallback
-- til 30 år (HFmax 190).
--
-- HFmax = 220 - alder, hvor alder = (inneværende år - birth_year).
-- Dersom birth_year mangler defaulter alder til 30.

update public.user_heart_zones z
set
  min_bpm = case z.zone_name
    when 'I1' then floor(ages.hfmax * 0.55)::int
    when 'I2' then floor(ages.hfmax * 0.72)::int
    when 'I3' then floor(ages.hfmax * 0.82)::int
    when 'I4' then floor(ages.hfmax * 0.87)::int
    when 'I5' then floor(ages.hfmax * 0.92)::int
  end,
  max_bpm = case z.zone_name
    when 'I1' then floor(ages.hfmax * 0.72)::int
    when 'I2' then floor(ages.hfmax * 0.82)::int
    when 'I3' then floor(ages.hfmax * 0.87)::int
    when 'I4' then floor(ages.hfmax * 0.92)::int
    when 'I5' then floor(ages.hfmax * 0.97)::int
  end,
  updated_at = now()
from (
  select
    p.id as user_id,
    (220 - (extract(year from now())::int
            - coalesce(p.birth_year, extract(year from now())::int - 30)))::numeric as hfmax
  from public.profiles p
) ages
where z.user_id = ages.user_id;

notify pgrst, 'reload schema';
