-- ============================================================
-- Fase 58 — Trener-kalender (Faser A-D, del B)
-- Kjør i Supabase SQL Editor (idempotent — trygt å kjøre på nytt)
-- ============================================================
--
-- Bakgrunn:
-- Treneren får sin egen kalender-rute /app/trener/kalender. Kalender-content
-- bygges av tre kilder:
--   1) Konkurranser fra koblede utøvere (workouts joined med
--      coach_athlete_relations) — eksisterende data, ingen ny tabell.
--   2) Egne notater (trainer_calendar_notes) — møte/utstyrs-levering osv.
--   3) Trener-attendance (trainer_attendance) — én rad per økt/mal trener
--      eksplisitt har markert "Skal delta" på.
--
-- "Skal delta" gir også badge på utøvers egen plan-side ("Trener X skal delta")
-- — derfor RLS som lar utøveren lese attendance-rader for sine workouts.

-- ── 1) trainer_calendar_notes ──────────────────────────────
create table if not exists public.trainer_calendar_notes (
  id               uuid primary key default gen_random_uuid(),
  trainer_user_id  uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  start_time       time,
  end_time         time,
  title            text not null check (length(trim(title)) > 0),
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists trainer_calendar_notes_user_date_idx
  on public.trainer_calendar_notes(trainer_user_id, date);

alter table public.trainer_calendar_notes enable row level security;

drop policy if exists "Own trainer calendar notes" on public.trainer_calendar_notes;
create policy "Own trainer calendar notes"
  on public.trainer_calendar_notes for all
  using (trainer_user_id = auth.uid())
  with check (trainer_user_id = auth.uid());

-- ── 2) trainer_attendance ──────────────────────────────────
-- workout_id ELLER pushed_template_id må være satt (ikke begge).
-- pushed_template_id refererer til workout_templates (mal-id som trener kan
-- ha pusht til flere utøvere; én attendance-rad uavhengig av antall utøvere).
create table if not exists public.trainer_attendance (
  id                   uuid primary key default gen_random_uuid(),
  trainer_user_id      uuid not null references auth.users(id) on delete cascade,
  workout_id           uuid references public.workouts(id) on delete cascade,
  pushed_template_id   uuid references public.workout_templates(id) on delete cascade,
  created_at           timestamptz not null default now(),

  -- Nøyaktig én av de to FK-ene må være satt.
  constraint trainer_attendance_target_xor check (
    (workout_id is null) <> (pushed_template_id is null)
  )
);

-- Partial unique-indekser hindrer dupliserte attendance-rader for samme
-- target. Standard UNIQUE ville inkludert NULL = NULL = forskjellig, så
-- vi bruker WHERE NOT NULL i index for hver kolonne separat.
create unique index if not exists trainer_attendance_unique_workout
  on public.trainer_attendance(trainer_user_id, workout_id)
  where workout_id is not null;

create unique index if not exists trainer_attendance_unique_template
  on public.trainer_attendance(trainer_user_id, pushed_template_id)
  where pushed_template_id is not null;

create index if not exists trainer_attendance_user_idx
  on public.trainer_attendance(trainer_user_id);

create index if not exists trainer_attendance_workout_idx
  on public.trainer_attendance(workout_id) where workout_id is not null;

alter table public.trainer_attendance enable row level security;

-- Trener leser/skriver kun egne rader.
drop policy if exists "Own trainer attendance" on public.trainer_attendance;
create policy "Own trainer attendance"
  on public.trainer_attendance for all
  using (trainer_user_id = auth.uid())
  with check (trainer_user_id = auth.uid());

-- Utøveren kan SE attendance-rader hvor workout_id matcher en av deres økter
-- (for "Trener X skal delta"-badge på plan-siden). Ingen INSERT/UPDATE/DELETE.
drop policy if exists "Athlete reads attendance for own workouts" on public.trainer_attendance;
create policy "Athlete reads attendance for own workouts"
  on public.trainer_attendance for select
  using (
    workout_id is not null
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

-- Utøveren kan også se attendance-rader hvor pushed_template_id matcher en
-- mal som er pusht til dem. Krever at vi vet hvordan pusht-relasjonen er
-- modellert. Per Fase 58 dropper vi denne biten — kommer i Fase B.4 hvis
-- pushed-mal-attendance skal vises på utøvers plan-side. Workout-attendance
-- er dekket av forrige policy.

-- ── Reload PostgREST schema-cache ──────────────────────────
notify pgrst, 'reload schema';
