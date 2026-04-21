-- Fase 14: Mal-utvidelse (aktiviteter i mal, kategori, beskrivelse) + tagging på workouts.
-- workout_templates finnes allerede (phase25_schema.sql); vi utvider.
-- Eksisterende kolonner: id, user_id, name, template_data (jsonb), last_used_at, use_count.
-- Nye: description, category, sport, activities (jsonb — ny primær datamodell), times_used.

alter table public.workout_templates
  add column if not exists description text,
  add column if not exists category    text,
  add column if not exists sport       text,
  add column if not exists activities  jsonb,
  add column if not exists times_used  int not null default 0,
  add column if not exists updated_at  timestamptz not null default now();

create index if not exists workout_templates_user_idx
  on public.workout_templates(user_id, category);

-- workouts — kobling til mal + denormalisert tag-array for GIN-søk.
-- workouts.workout_tags (child-tabell) beholdes for bakoverkomp, men tags[]
-- mirrores ved lagring slik at filter-queries kan bruke GIN-indeks.
alter table public.workouts
  add column if not exists template_id   uuid references public.workout_templates(id) on delete set null,
  add column if not exists template_name text,
  add column if not exists tags          text[];

create index if not exists workouts_template_idx on public.workouts(template_id);
create index if not exists workouts_tags_idx     on public.workouts using gin(tags);

notify pgrst, 'reload schema';
