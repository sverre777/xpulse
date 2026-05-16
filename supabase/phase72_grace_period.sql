-- Phase 72 — 90-dagers grace-period for utløpte abonnement.
--
-- Når en subscription kanselleres eller blir past_due og perioden passerer,
-- mister brukeren tilgang til /app — men dataen beholdes i 90 dager så
-- brukeren kan reaktivere og hente alt tilbake. Etter 90 dager kjører
-- cleanup-cron full sletting av brukerens treningsdata.
--
-- expired_at: når brukerens tilgang faktisk opphørte (period_end + cancel)
-- data_deletion_scheduled_at: når data blir slettet (typisk expired_at + 90d)
--
-- Webhook setter feltene ved subscription.deleted og clear-er dem ved
-- reactivation (status='active'/'trialing' igjen).

alter table public.subscriptions
  add column if not exists expired_at timestamptz,
  add column if not exists data_deletion_scheduled_at timestamptz;

create index if not exists subscriptions_deletion_due_idx
  on public.subscriptions(data_deletion_scheduled_at)
  where data_deletion_scheduled_at is not null;

grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;

notify pgrst, 'reload schema';
