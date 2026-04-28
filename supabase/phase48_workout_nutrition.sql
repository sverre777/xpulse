-- Fase 48 — Ernæring-logging per økt.
--
-- Lange utholdenhetsøkter krever planlagt energi-inntak (gels, drikke,
-- bars, salt). Tabellen lagrer hver enkelt rad per økt — én rad per
-- inntakshendelse. Visning summerer karbo/protein per økt og kan beregne
-- karbo per time hvis varighet er kjent.
--
-- Speiler mønsteret fra workout_activity_lactate_measurements (per-rad,
-- sortert på tidsforskyvning), men kobler direkte mot workouts (ikke per-
-- aktivitet) siden ernæring rangerer over hele økten.
--
-- RLS: eier full tilgang + aktiv trener med can_view_dagbok kan lese.

create table if not exists public.workout_nutrition_entries (
  id                    uuid primary key default uuid_generate_v4(),
  workout_id            uuid not null references public.workouts(id) on delete cascade,
  user_id               uuid not null references public.profiles(id) on delete cascade,
  -- Minutter inn i økten (0 = ved start). Null = "uvisst klokkeslett".
  time_offset_minutes   integer,
  nutrition_type        text not null
    check (nutrition_type in ('gel','drikke','bar','frukt','mat','salt','egendefinert')),
  carbs_g               numeric(6,1),
  protein_g             numeric(6,1),
  fat_g                 numeric(6,1),
  ketones_g             numeric(6,2),
  custom_label          text,
  notes                 text,
  created_at            timestamptz not null default now()
);

-- Idempotent — sørger for at fat_g finnes også hvis tabellen ble opprettet
-- uten kolonnen (tidlig versjon av phase48 manglet fett).
alter table public.workout_nutrition_entries
  add column if not exists fat_g numeric(6,1);

create index if not exists workout_nutrition_workout_idx
  on public.workout_nutrition_entries(workout_id, time_offset_minutes nulls last);

alter table public.workout_nutrition_entries enable row level security;

drop policy if exists "Owner full access" on public.workout_nutrition_entries;
create policy "Owner full access"
  on public.workout_nutrition_entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Coach read access" on public.workout_nutrition_entries;
create policy "Coach read access"
  on public.workout_nutrition_entries for select
  using (
    exists (
      select 1 from public.coach_athlete_relations
      where coach_id = auth.uid()
        and athlete_id = workout_nutrition_entries.user_id
        and status = 'active'
        and can_view_dagbok = true
    )
  );

notify pgrst, 'reload schema';
