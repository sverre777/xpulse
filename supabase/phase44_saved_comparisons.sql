-- Fase 44 — Lagrede økt-sammenligninger
--
-- Brukeren kan lagre et utvalg av økter som en navngitt sammenligning og
-- åpne den senere fra Sammenlign-fanen. workout_ids er en uuid[] som
-- valideres på lese-tid (RLS sikrer kun egne økter via Workouts-policyene).
--
-- Idempotent.

create table if not exists public.saved_comparisons (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  workout_ids uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists saved_comparisons_user_idx
  on public.saved_comparisons(user_id, created_at desc);

alter table public.saved_comparisons enable row level security;

drop policy if exists "Own saved comparisons" on public.saved_comparisons;
create policy "Own saved comparisons"
  on public.saved_comparisons for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
