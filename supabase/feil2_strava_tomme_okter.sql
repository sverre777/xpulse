-- FEIL-2, DIAGNOSE (REN LESING): Strava-økter uten aktivitetsrader.
-- Kjør spørringene ÉN og ÉN (editoren viser bare siste resultat).
--
-- Symptom: sykkel- og svømmeøkt kom inn med kun tittel og varighet.
-- Tre mulige årsaker med hver sin signatur i dataene:
--   (a) lap-insert feilet stille  → økta HAR samples (streams kom inn),
--       men 0 aktivitetsrader. Klokke-økt: puls satt på økta.
--   (b) kilden var tom (manuelt ført i Strava) → 0 aktivitetsrader OG
--       ingen samples OG som regel ingen puls. Korrekt import av tom kilde.
--   (c) API-kall feilet underveis → ligner (a), men gjerne klumpet i tid
--       (rate limit rammer en hel kjøring).


-- ══ 1. HOVEDTALLET: tomme Strava-økter per måned ══
-- «Tom» = 0 rader i workout_activities.
select
  to_char(w.created_at, 'YYYY-MM')                       as importert_maaned,
  count(*)                                               as strava_okter,
  count(*) filter (where a.n = 0)                        as uten_aktivitetsrader,
  count(*) filter (where a.n = 0 and s.n > 0)            as tomme_MED_samples,   -- → (a)/(c)
  count(*) filter (where a.n = 0 and s.n = 0)            as tomme_UTEN_samples   -- → (b)
from public.workouts w
left join lateral (
  select count(*) as n from public.workout_activities wa where wa.workout_id = w.id
) a on true
left join lateral (
  select count(*) as n from public.workout_samples ws where ws.workout_id = w.id
) s on true
where w.imported_from = 'strava'
group by 1
order by 1;


-- ══ 2. DE TOMME, EN OG EN — nyeste først ══
-- avg_heart_rate satt + tom → klokkeøkt der lap-insert feilet → (a)/(c).
-- Alt null + tom → manuelt ført i Strava → (b).
select
  w.id, w.date, w.title, w.duration_minutes, w.distance_km,
  w.avg_heart_rate is not null                           as har_puls,
  s.n > 0                                                as har_samples,
  ia.imported_at,
  ia.external_id                                         as strava_id
from public.workouts w
left join lateral (
  select count(*) as n from public.workout_samples ws where ws.workout_id = w.id
) s on true
left join public.imported_activities ia on ia.workout_id = w.id and ia.source = 'strava'
where w.imported_from = 'strava'
  and not exists (select 1 from public.workout_activities wa where wa.workout_id = w.id)
order by ia.imported_at desc nulls last
limit 40;


-- ══ 3. FORDELING AV ANTALL RADER PER STRAVA-ØKT ══
-- Gir følelsen for normalen: en vanlig klokkeøkt har 1+ (én per lap).
select a.n as aktivitetsrader, count(*) as okter
from public.workouts w
left join lateral (
  select count(*) as n from public.workout_activities wa where wa.workout_id = w.id
) a on true
where w.imported_from = 'strava'
group by 1
order by 1;
