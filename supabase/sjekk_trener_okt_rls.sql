-- DIAGNOSE, ikke migrering. Ingen skriving. Kjør blokka SAMLET.
--
-- SPØRSMÅL: ser treneren barnetabellene bak en økt, eller bare selve økta?
--
-- Puls ligger på workouts-raden (forelder). Km og drag ligger i
-- workout_activities, laktat i workout_lactate_measurements (barn). Treneren
-- ser puls men ikke km/drag — det peker mot at RLS slipper ham til forelderen
-- og stopper barna.
--
-- MERK: en RLS-nektet embed gir TOM LISTE, ikke feil. Verifisert mot
-- PostgREST: anon fikk PGRST116 («0 rader»), ikke «permission denied», så
-- alle tabellene har GRANT. Det er RLS som avgjør, og den viser seg som
-- nuller — ikke som en feilmelding.
--
--   trener  5755dc3b-ae82-438c-9c18-94ea29272cf7
--   utøver  1b4144d9-a8e1-4694-ba71-077215a156a0
--   økt     30fffc42-1c10-473e-bf6a-61f384e71386  (2026-04-18 «Rolig løp 1t»)
--
-- FASIT, målt med service_role som går utenom RLS:
--   okt 1 · bevegelse 1 · tag 1 · aktivitet 1
-- Får treneren 1 på alle fire, er RLS uskyldig og feilen ligger et annet sted.
-- Får han 1 på okt og 0 på de tre andre, er det RLS på barnetabellene.

set role authenticated;
set request.jwt.claims = '{"sub":"5755dc3b-ae82-438c-9c18-94ea29272cf7","role":"authenticated"}';

select
  (select count(*) from workouts
     where id = '30fffc42-1c10-473e-bf6a-61f384e71386') as okt,
  (select count(*) from workout_movements
     where workout_id = '30fffc42-1c10-473e-bf6a-61f384e71386') as bevegelse,
  (select count(*) from workout_tags
     where workout_id = '30fffc42-1c10-473e-bf6a-61f384e71386') as tag,
  (select count(*) from workout_activities
     where workout_id = '30fffc42-1c10-473e-bf6a-61f384e71386') as aktivitet;

reset role;

-- Kjører editoren `reset role` over en pooled forbindelse som ikke rekker
-- gjennom, kan fanen bli liggende som `authenticated`. Det gir MINDRE tilgang,
-- aldri mer. Ser du «permission denied» på noe du normalt ser etterpå: åpne
-- ny fane.
