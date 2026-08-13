-- Fase 81: Utøvere kan lese profilene til sine AKTIVE trenere.
-- Rotårsak for to bugs: profiles hadde kun «own» + «coach → athlete»-policy.
-- Utøver-siden fikk dermed aldri trenerens rad → «Ukjent trener» på hjem og
-- trener manglet i ny melding-mottakerlisten. Speiler den eksisterende
-- «Coaches can view their athletes profiles»-policyen i motsatt retning.
-- Idempotent — trygg å kjøre flere ganger.

drop policy if exists "Athletes can view their coaches profiles" on public.profiles;
create policy "Athletes can view their coaches profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.coach_athlete_relations r
      where r.coach_id = profiles.id
        and r.athlete_id = auth.uid()
        and r.status = 'active'
    )
  );

notify pgrst, 'reload schema';
