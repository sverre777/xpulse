-- Fase 9: Kommentar for uke og måned i Plan og Dagbok.
-- En rad per (bruker, scope, periode, kontekst). Plan og Dagbok har egne
-- kommentarer så refleksjon ikke overstyrer planen.

create table if not exists public.period_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('week','month')),
  period_key text not null,                    -- 'YYYY-WNN' eller 'YYYY-MM'
  context text not null check (context in ('plan','dagbok')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope, period_key, context)
);

create index if not exists period_notes_user_scope_idx
  on public.period_notes (user_id, scope, period_key);

alter table public.period_notes enable row level security;

drop policy if exists "own_period_notes" on public.period_notes;
create policy "own_period_notes" on public.period_notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
