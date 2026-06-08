-- ============================================================
-- Fase 78 — Fiks: sletting av hviledag/dagtilstand feiler
-- ============================================================
-- Symptom: «Slett»-knappen på en hviledag gjør ingenting — raden blir liggende.
-- Rotårsak: server-handler, RLS-policy og UI-kode er alle korrekte, men
-- `authenticated`-rollen mangler DELETE-GRANT på day_states (RLS og GRANT er to
-- uavhengige lag). En delete uten grant treffer 0 rader og returnerer «success»,
-- så UI lukker modalen uten å fjerne noe.
--
-- Dette er samme fiks som phase73_delete_audit.sql for day_states, isolert så
-- den er enkel å kjøre. Idempotent — trygt å kjøre flere ganger.

-- 1) DELETE-grant til authenticated (no-op hvis allerede satt)
grant delete on public.day_states to authenticated;
grant delete on public.day_states to service_role;

-- 2) Sikre eier-DELETE-policy (fase 20 «Own day states» er `for all` og dekker
--    DELETE; gjenopprettes eksplisitt for sikkerhets skyld).
alter table public.day_states enable row level security;
drop policy if exists "Own day states" on public.day_states;
create policy "Own day states"
  on public.day_states for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3) Reload PostgREST schema-cache
notify pgrst, 'reload schema';
