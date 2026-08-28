-- ============================================================
-- Fase 111 — Prestasjonsmodellen bolk 5: utvidet skala I6–I8
--
-- Én sannhet per utøver: profiles.utvidet_skala (boolean, default
-- false = dagens oppførsel, ingen migrasjonssmerte). Skalaen er
-- SPRÅKVALG for planlegging/føring/visning — I6–I8 er aldri puls-
-- soner (user_heart_zones/ZoneName forblir I1–I5, makspuls er toppen
-- av I5).
--
-- Trener med plan-rett slår av/på SAMME innstilling via RPC-en under
-- (aldri en trener-kopi). profiles-RLS gir ikke trener-skriving, så
-- RPC-en er SECURITY DEFINER med samme tilgangssjekk-mønster som
-- kan_flette_for (fase 109).
--
-- FØR (kjør separat):
--   select count(*) as profiler from public.profiles;
--   -- Målt 28. aug: 32
-- Idempotent. KJØRES IKKE før Sverre har godkjent.
-- ============================================================

alter table public.profiles
  add column if not exists utvidet_skala boolean not null default false;

create or replace function public.sett_utvidet_skala(
  p_bruker uuid,
  p_paa boolean
) returns jsonb language plpgsql security definer
set search_path = public as $fn$
begin
  if not (
    p_bruker = auth.uid()
    or exists (
      select 1 from public.coach_athlete_relations r
      where r.athlete_id = p_bruker
        and r.coach_id   = auth.uid()
        and r.status     = 'active'
        and r.can_edit_plan
    )
  ) then
    return jsonb_build_object('error', 'Mangler tillatelse');
  end if;

  update public.profiles set utvidet_skala = p_paa where id = p_bruker;
  return jsonb_build_object('ok', true, 'utvidet_skala', p_paa);
end $fn$;

revoke all on function public.sett_utvidet_skala(uuid, boolean) from anon;

-- ETTER (kjør separat):
--   select count(*) as profiler,
--          count(*) filter (where utvidet_skala) as paa
--     from public.profiles;
--   -- Forventet: 32 profiler · 0 på (default false for alle).

notify pgrst, 'reload schema';
