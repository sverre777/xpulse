-- Fase 28: Plan- og periodiseringsmaler.
-- Utøvere lagrer hele uker/måneder fra Plan eller hele sesonger fra Periodisering
-- som gjenbrukbare maler. Trenere kan pushe lagrede maler til sine utøvere eller
-- grupper via det eksisterende push-systemet.
--
-- plan_templates:
--   Frosset snapshot av én eller flere uker/måneder fra Plan. plan_data er en
--   JSON-struktur { workouts: [...], day_states: [...], week_notes: {...},
--   month_notes: {...}, focus_points: [...] } som UI-et kan gjengi direkte
--   under forhåndsvisning og materialisere inn i mottakerens kalender.
--
-- periodization_templates:
--   Snapshot av en hel sesong (perioder, konkurranser, A/B/C-mål). periodization_data
--   har { season: {...}, periods: [...], key_dates: [...] }.

create table if not exists public.plan_templates (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  description       text,
  duration_days     int  not null check (duration_days > 0),
  plan_data         jsonb not null,
  category          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists plan_templates_user_idx
  on public.plan_templates(user_id, category);

create table if not exists public.periodization_templates (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  description       text,
  duration_days     int  not null check (duration_days > 0),
  periodization_data jsonb not null,
  category          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists periodization_templates_user_idx
  on public.periodization_templates(user_id, category);

alter table public.plan_templates         enable row level security;
alter table public.periodization_templates enable row level security;

drop policy if exists "Own plan templates"          on public.plan_templates;
drop policy if exists "Own periodization templates" on public.periodization_templates;

create policy "Own plan templates" on public.plan_templates
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Own periodization templates" on public.periodization_templates
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
