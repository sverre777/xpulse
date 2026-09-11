-- BACKFILL AV KLOKKESLETT - sverre_glomnes@icloud.com (abd9520e-2733-40ec-9d99-1336bf142ecb)
-- Prøvekjøring på ÉN konto. Ikke en migrasjon (ingen phase-nummer).
--
-- Bakgrunn: Strava-økter importert før a0c776d fikk time_of_day fra start_date
-- (UTC). Riktig verdi er start_date_local, hentet fra /athlete/activities
-- 11. sep 2026 for hver av radene under. Alle 34 er +2 t (sommertid), ingen
-- bytter dato. Holdt utenfor: 3 rader redigert etter import (updated_at mer
-- enn 5 min etter imported_at) og 1 rad uten time_of_day.
--
-- Én UPDATE, alt-eller-ingenting: optimistisk WHERE på gammel dato + tid, og
-- DO-blokken kaster hvis antallet ikke er 34 - da rulles alt tilbake.
-- updated_at settes til now(), ellers tror updated_at-vernet i neste kjøring at
-- radene aldri er rørt.
--
-- ═══ FØR: kjør denne først, skal gi 34 ═══
--
-- select count(*) from public.workouts w
--   join (values
--     ('c3cb80a8-0b99-4099-a72b-26aa90220380'::uuid, '2026-05-11'::date, '13:16'::time),
--     ('ac1b89b4-56ce-43a1-9f2b-10fba76e6b4c'::uuid, '2026-05-10'::date, '13:41'::time),
--     ('925c9c28-9e5d-47ff-a3d7-44ce0822abf1'::uuid, '2026-05-16'::date, '06:32'::time),
--     ('9f988666-aed6-4ace-aa3c-c4bfa8934559'::uuid, '2026-05-16'::date, '07:09'::time),
--     ('a1e20a00-2137-4193-8f8d-18c521584fbe'::uuid, '2026-05-18'::date, '18:45'::time),
--     ('af95de21-4bf1-459b-9b21-3de9c1a06007'::uuid, '2026-05-19'::date, '18:01'::time),
--     ('3da1e4d9-e116-44fe-baf1-ecfba99e8a13'::uuid, '2026-05-21'::date, '08:33'::time),
--     ('2eee238b-de22-4bdf-a12b-1256f447d490'::uuid, '2026-05-23'::date, '08:57'::time),
--     ('8a83c442-4374-4dfc-807a-c435c3cdf8c6'::uuid, '2026-05-24'::date, '10:03'::time),
--     ('63c9d9a5-f875-4583-9dee-3054bc03b37b'::uuid, '2026-05-25'::date, '09:42'::time),
--     ('9302d92a-36fc-45ef-a499-675beb7483e5'::uuid, '2026-05-27'::date, '12:04'::time),
--     ('07a0c3b8-f22a-45a8-ba2a-086ada7e7a14'::uuid, '2026-05-28'::date, '17:07'::time),
--     ('262f8b54-ebae-4e45-a6e2-db613c56581c'::uuid, '2026-06-03'::date, '17:14'::time),
--     ('385504ae-a785-430e-a676-f097d31799d3'::uuid, '2026-06-09'::date, '13:19'::time),
--     ('e2361d56-7c25-4223-802e-c04a3cef8b7e'::uuid, '2026-06-08'::date, '11:52'::time),
--     ('d2f9129e-7410-4f50-a4e9-e9bea1ce4904'::uuid, '2026-06-12'::date, '14:22'::time),
--     ('9429236f-58c6-4f89-b677-4cb6f4ac7db5'::uuid, '2026-06-14'::date, '10:06'::time),
--     ('1b70efd5-d8ca-444f-b6a4-e0c5a4d9e3dd'::uuid, '2026-06-20'::date, '12:16'::time),
--     ('4f8b98fa-7970-4695-ba3e-204b9ebfd430'::uuid, '2026-06-14'::date, '10:06'::time),
--     ('c5a2f31b-b166-4762-af74-45f9b972af04'::uuid, '2026-07-01'::date, '18:53'::time),
--     ('359a9c68-d183-468e-861c-01376aa76671'::uuid, '2026-06-28'::date, '18:26'::time),
--     ('db151843-72e8-4fa4-8f9d-fa4cafd5d82a'::uuid, '2026-06-20'::date, '12:17'::time),
--     ('c03d7061-5908-4e65-9b4a-09e7d7fb1e20'::uuid, '2026-07-04'::date, '08:00'::time),
--     ('21e2d272-59de-4710-936d-3c51939c3c8e'::uuid, '2026-07-09'::date, '10:18'::time),
--     ('12086b7c-42e3-48a0-adc4-929dc884f54b'::uuid, '2026-07-09'::date, '13:41'::time),
--     ('d191d200-7e54-4604-a548-8f674e82706f'::uuid, '2026-07-17'::date, '17:29'::time),
--     ('faef674a-39cc-4929-b5d4-c476526409cc'::uuid, '2026-07-20'::date, '16:35'::time),
--     ('55919e8d-517a-4959-8e3e-579f3de720b5'::uuid, '2026-08-19'::date, '07:57'::time),
--     ('c3208f5a-c583-4321-9676-9ee0e518ff0b'::uuid, '2026-08-07'::date, '12:44'::time),
--     ('21cf0af6-73c2-4db0-9e56-1e4e6f9c955a'::uuid, '2026-08-23'::date, '09:14'::time),
--     ('8ea474bb-1da2-4a6c-9485-e72d1efb6187'::uuid, '2026-08-23'::date, '08:50'::time),
--     ('5cf2989e-188a-4851-a7dc-f2c936df1c61'::uuid, '2026-08-20'::date, '16:00'::time),
--     ('b9b58afe-aa72-4e7e-9a06-1d62a22f8878'::uuid, '2026-08-19'::date, '13:37'::time),
--     ('31e366ef-acda-497a-912e-5d63566233df'::uuid, '2026-09-06'::date, '11:43'::time)
--   ) as p(id, gammel_dato, gammel_tid) on p.id = w.id
--  where w.user_id = 'abd9520e-2733-40ec-9d99-1336bf142ecb'
--    and w.date = p.gammel_dato
--    and w.time_of_day = p.gammel_tid;

begin;

do $backfill$
declare
  v_oppdatert int;
begin
  with plan(id, gammel_dato, gammel_tid, ny_dato, ny_tid) as (
    values
        ('c3cb80a8-0b99-4099-a72b-26aa90220380'::uuid, '2026-05-11'::date, '13:16'::time, '2026-05-11'::date, '15:16'::time),
        ('ac1b89b4-56ce-43a1-9f2b-10fba76e6b4c'::uuid, '2026-05-10'::date, '13:41'::time, '2026-05-10'::date, '15:41'::time),
        ('925c9c28-9e5d-47ff-a3d7-44ce0822abf1'::uuid, '2026-05-16'::date, '06:32'::time, '2026-05-16'::date, '08:32'::time),
        ('9f988666-aed6-4ace-aa3c-c4bfa8934559'::uuid, '2026-05-16'::date, '07:09'::time, '2026-05-16'::date, '09:09'::time),
        ('a1e20a00-2137-4193-8f8d-18c521584fbe'::uuid, '2026-05-18'::date, '18:45'::time, '2026-05-18'::date, '20:45'::time),
        ('af95de21-4bf1-459b-9b21-3de9c1a06007'::uuid, '2026-05-19'::date, '18:01'::time, '2026-05-19'::date, '20:01'::time),
        ('3da1e4d9-e116-44fe-baf1-ecfba99e8a13'::uuid, '2026-05-21'::date, '08:33'::time, '2026-05-21'::date, '10:33'::time),
        ('2eee238b-de22-4bdf-a12b-1256f447d490'::uuid, '2026-05-23'::date, '08:57'::time, '2026-05-23'::date, '10:57'::time),
        ('8a83c442-4374-4dfc-807a-c435c3cdf8c6'::uuid, '2026-05-24'::date, '10:03'::time, '2026-05-24'::date, '12:03'::time),
        ('63c9d9a5-f875-4583-9dee-3054bc03b37b'::uuid, '2026-05-25'::date, '09:42'::time, '2026-05-25'::date, '11:42'::time),
        ('9302d92a-36fc-45ef-a499-675beb7483e5'::uuid, '2026-05-27'::date, '12:04'::time, '2026-05-27'::date, '14:04'::time),
        ('07a0c3b8-f22a-45a8-ba2a-086ada7e7a14'::uuid, '2026-05-28'::date, '17:07'::time, '2026-05-28'::date, '19:07'::time),
        ('262f8b54-ebae-4e45-a6e2-db613c56581c'::uuid, '2026-06-03'::date, '17:14'::time, '2026-06-03'::date, '19:14'::time),
        ('385504ae-a785-430e-a676-f097d31799d3'::uuid, '2026-06-09'::date, '13:19'::time, '2026-06-09'::date, '15:19'::time),
        ('e2361d56-7c25-4223-802e-c04a3cef8b7e'::uuid, '2026-06-08'::date, '11:52'::time, '2026-06-08'::date, '13:52'::time),
        ('d2f9129e-7410-4f50-a4e9-e9bea1ce4904'::uuid, '2026-06-12'::date, '14:22'::time, '2026-06-12'::date, '16:22'::time),
        ('9429236f-58c6-4f89-b677-4cb6f4ac7db5'::uuid, '2026-06-14'::date, '10:06'::time, '2026-06-14'::date, '12:06'::time),
        ('1b70efd5-d8ca-444f-b6a4-e0c5a4d9e3dd'::uuid, '2026-06-20'::date, '12:16'::time, '2026-06-20'::date, '14:16'::time),
        ('4f8b98fa-7970-4695-ba3e-204b9ebfd430'::uuid, '2026-06-14'::date, '10:06'::time, '2026-06-14'::date, '12:06'::time),
        ('c5a2f31b-b166-4762-af74-45f9b972af04'::uuid, '2026-07-01'::date, '18:53'::time, '2026-07-01'::date, '20:53'::time),
        ('359a9c68-d183-468e-861c-01376aa76671'::uuid, '2026-06-28'::date, '18:26'::time, '2026-06-28'::date, '20:26'::time),
        ('db151843-72e8-4fa4-8f9d-fa4cafd5d82a'::uuid, '2026-06-20'::date, '12:17'::time, '2026-06-20'::date, '14:17'::time),
        ('c03d7061-5908-4e65-9b4a-09e7d7fb1e20'::uuid, '2026-07-04'::date, '08:00'::time, '2026-07-04'::date, '10:00'::time),
        ('21e2d272-59de-4710-936d-3c51939c3c8e'::uuid, '2026-07-09'::date, '10:18'::time, '2026-07-09'::date, '12:18'::time),
        ('12086b7c-42e3-48a0-adc4-929dc884f54b'::uuid, '2026-07-09'::date, '13:41'::time, '2026-07-09'::date, '15:41'::time),
        ('d191d200-7e54-4604-a548-8f674e82706f'::uuid, '2026-07-17'::date, '17:29'::time, '2026-07-17'::date, '19:29'::time),
        ('faef674a-39cc-4929-b5d4-c476526409cc'::uuid, '2026-07-20'::date, '16:35'::time, '2026-07-20'::date, '18:35'::time),
        ('55919e8d-517a-4959-8e3e-579f3de720b5'::uuid, '2026-08-19'::date, '07:57'::time, '2026-08-19'::date, '09:57'::time),
        ('c3208f5a-c583-4321-9676-9ee0e518ff0b'::uuid, '2026-08-07'::date, '12:44'::time, '2026-08-07'::date, '14:44'::time),
        ('21cf0af6-73c2-4db0-9e56-1e4e6f9c955a'::uuid, '2026-08-23'::date, '09:14'::time, '2026-08-23'::date, '11:14'::time),
        ('8ea474bb-1da2-4a6c-9485-e72d1efb6187'::uuid, '2026-08-23'::date, '08:50'::time, '2026-08-23'::date, '10:50'::time),
        ('5cf2989e-188a-4851-a7dc-f2c936df1c61'::uuid, '2026-08-20'::date, '16:00'::time, '2026-08-20'::date, '18:00'::time),
        ('b9b58afe-aa72-4e7e-9a06-1d62a22f8878'::uuid, '2026-08-19'::date, '13:37'::time, '2026-08-19'::date, '15:37'::time),
        ('31e366ef-acda-497a-912e-5d63566233df'::uuid, '2026-09-06'::date, '11:43'::time, '2026-09-06'::date, '13:43'::time)
  ),
  upd as (
    update public.workouts w
       set date = p.ny_dato, time_of_day = p.ny_tid, updated_at = now()
      from plan p
     where w.id = p.id
       and w.date = p.gammel_dato
       and w.time_of_day = p.gammel_tid
       and w.user_id = 'abd9520e-2733-40ec-9d99-1336bf142ecb'
    returning w.id
  )
  select count(*) into v_oppdatert from upd;
  if v_oppdatert <> 34 then
    raise exception 'Forventet 34 rader, traff %', v_oppdatert;
  end if;

  -- Ingen av de 34 øktene har workout_activities.start_time satt - ingen barnerader å flytte.
end $backfill$;

-- ═══ ETTER: de ti radene lest tilbake (skal vise ny tid) ═══
select id, date, time_of_day, updated_at
  from public.workouts
 where id in ('c3cb80a8-0b99-4099-a72b-26aa90220380', 'ac1b89b4-56ce-43a1-9f2b-10fba76e6b4c', '925c9c28-9e5d-47ff-a3d7-44ce0822abf1', '9f988666-aed6-4ace-aa3c-c4bfa8934559', 'a1e20a00-2137-4193-8f8d-18c521584fbe', 'af95de21-4bf1-459b-9b21-3de9c1a06007', '3da1e4d9-e116-44fe-baf1-ecfba99e8a13', '2eee238b-de22-4bdf-a12b-1256f447d490', '8a83c442-4374-4dfc-807a-c435c3cdf8c6', '63c9d9a5-f875-4583-9dee-3054bc03b37b')
 order by date, time_of_day;

commit;
