-- Fase 16: Egne bevegelsesformer — brukere kan definere sporter/aktiviteter
-- som ikke finnes i standardlisten (MOVEMENT_CATEGORIES). Typen (utholdenhet,
-- styrke, tur, annet) styrer UI-branchen i ActivitiesSection.
--
-- Data lagres vanlig i workout_activities.movement_name som tekst — ingen FK,
-- slik at sletting av en bruker-form ikke bryter historikk.

create table if not exists public.user_movement_types (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  type          text not null check (type in ('utholdenhet','styrke','tur','annet')),
  subcategories text[],
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists user_movement_types_user_idx
  on public.user_movement_types(user_id);

alter table public.user_movement_types enable row level security;

drop policy if exists "Own movement types" on public.user_movement_types;
create policy "Own movement types"
  on public.user_movement_types for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
