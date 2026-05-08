-- ============================================================
-- Fase 56 — user_exercises.kind for analyse-grunnlag
-- Kjør i Supabase SQL Editor (idempotent — trygt å kjøre på nytt)
-- ============================================================
--
-- Bakgrunn (Fase 3d av økt-føring-refaktor):
-- user_exercises bygges per i dag opp implisitt fra styrke-aktiviteter ved
-- saveWorkout. Når brukerne nå kan opprette egne styrkeøvelser direkte i
-- bibliotek-UI (fritekst-bibliotek), trenger vi en eksplisitt type-kolonne så
-- analyse-modulen senere kan filtrere og aggregere på "alle styrkeøvelser
-- over tid" uten å måtte trekke tilbake til opprinnelses-sporet.
--
-- Default 'strength' siden alle eksisterende rader stammer fra styrke-økter.
-- Constraint åpner for fremtidige verdier (f.eks. 'mobility', 'plyometric')
-- uten å bryte eksisterende kode.

alter table public.user_exercises
  add column if not exists kind text not null default 'strength';

comment on column public.user_exercises.kind is
  'Type øvelse — strength (default), eventuelt mobility/plyometric senere. Brukes som filter i øvelses-bibliotek-UI og som grunnlag for analyser per øvelse-type.';

-- Backfill: alle eksisterende rader er styrke (kun kilden i dag).
-- Default-klausulen tar seg av nye rader; oppdater alle som mangler verdi
-- for sikkerhets skyld før constraint legges på.
update public.user_exercises set kind = 'strength' where kind is null;

alter table public.user_exercises
  drop constraint if exists user_exercises_kind_check;

alter table public.user_exercises
  add constraint user_exercises_kind_check
  check (kind in ('strength', 'mobility', 'plyometric'));

create index if not exists user_exercises_user_kind_idx
  on public.user_exercises(user_id, kind, last_used_at desc);

-- ── Reload PostgREST schema-cache ──────────────────────────
notify pgrst, 'reload schema';
