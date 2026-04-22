-- ============================================================
-- Phase 27: trener-invitasjonskoder
-- Utøver genererer en kode, deler med trener, trener løser inn
-- for å opprette coach_athlete_relations automatisk.
-- ============================================================

create table if not exists public.coach_invite_codes (
  id               uuid primary key default uuid_generate_v4(),
  athlete_id       uuid not null references auth.users(id) on delete cascade,
  code             text not null unique,
  expires_at       timestamptz not null,
  used_at          timestamptz,
  used_by_coach_id uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

create index if not exists coach_invite_codes_athlete_idx on public.coach_invite_codes(athlete_id);
create index if not exists coach_invite_codes_code_idx on public.coach_invite_codes(code);

alter table public.coach_invite_codes enable row level security;

drop policy if exists "Athlete manages own codes" on public.coach_invite_codes;
create policy "Athlete manages own codes"
  on public.coach_invite_codes for all
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

-- Trener slår opp koden før innløsning. Select er trygt siden koden er et
-- hemmelig 8-tegns token (utøver må aktivt dele den).
drop policy if exists "Coach looks up code" on public.coach_invite_codes;
create policy "Coach looks up code"
  on public.coach_invite_codes for select
  using (true);

-- Trener må kunne oppdatere used_at / used_by_coach_id når koden løses inn.
drop policy if exists "Coach marks code used" on public.coach_invite_codes;
create policy "Coach marks code used"
  on public.coach_invite_codes for update
  using (used_at is null and expires_at > now())
  with check (used_by_coach_id = auth.uid());

notify pgrst, 'reload schema';
