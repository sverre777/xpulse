-- Fase 18: Stjerne-system for favoritt-grafer i Analyse.
-- En rad per (bruker, chart_key). Brukes av FavoriteChartsSection i Oversikt
-- til å rendre de grafene brukeren har stjerne-markert fra de andre fanene.

create table if not exists public.user_favorite_charts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  chart_key    text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, chart_key)
);

create index if not exists user_favorite_charts_user_idx
  on public.user_favorite_charts (user_id, sort_order);

alter table public.user_favorite_charts enable row level security;

drop policy if exists "Own favorite charts" on public.user_favorite_charts;
create policy "Own favorite charts"
  on public.user_favorite_charts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
