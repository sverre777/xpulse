-- Fase 47 — Waitlist for kommende funksjoner (klokkesync, AI-tier).
--
-- Brukeren skriver inn e-post på en "Snart kommer"-side og får varsel ved
-- lansering. Anonym INSERT er tillatt så landing-skjema fungerer uten login.
-- SELECT er begrenset til egne rader (innloggede brukere som senere vil se
-- om de er på listen).
--
-- Idempotent.

create table if not exists public.feature_waitlist (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null,
  feature     text not null,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (email, feature)
);

alter table public.feature_waitlist enable row level security;

drop policy if exists "Anyone can join waitlist" on public.feature_waitlist;
create policy "Anyone can join waitlist"
  on public.feature_waitlist for insert
  with check (true);

drop policy if exists "Authenticated read own waitlist" on public.feature_waitlist;
create policy "Authenticated read own waitlist"
  on public.feature_waitlist for select
  using (user_id = auth.uid());

create index if not exists feature_waitlist_feature_idx
  on public.feature_waitlist (feature, created_at desc);

notify pgrst, 'reload schema';
