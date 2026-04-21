-- Fase 13: Personlig øvelsesbibliotek (autocomplete i styrke-editor).
-- Hver bruker bygger sitt eget bibliotek — siste brukte verdier lagres som
-- default, times_used + last_used_at brukes til sortering.

create table if not exists public.user_exercises (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  category          text,
  notes             text,
  default_reps      int,
  default_weight_kg numeric(6,2),
  times_used        int not null default 0,
  last_used_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists user_exercises_user_idx
  on public.user_exercises(user_id, last_used_at desc);

alter table public.user_exercises enable row level security;

drop policy if exists "Own exercises" on public.user_exercises;
create policy "Own exercises"
  on public.user_exercises for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
