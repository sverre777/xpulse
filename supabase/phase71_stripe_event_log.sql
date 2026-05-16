-- Phase 71 — Stripe webhook idempotens-log.
--
-- Stripe gjenoppretter ved nettverksfeil og kan sende samme event flere
-- ganger. Vi lagrer event.id per behandlet event og hopper over hvis vi
-- allerede har sett den. Tabellen er service_role-only (RLS) siden bare
-- webhook-handleren skriver/leser her.

create table if not exists public.processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists processed_stripe_events_type_idx
  on public.processed_stripe_events(event_type, processed_at desc);

alter table public.processed_stripe_events enable row level security;

-- Service-role only — authenticated/anon har ingen tilgang.
drop policy if exists "Service manages stripe events" on public.processed_stripe_events;
create policy "Service manages stripe events"
  on public.processed_stripe_events for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.processed_stripe_events to service_role;

notify pgrst, 'reload schema';
