-- Fase 37: Ski-spesifikk data for utstyr.
-- Utvider equipment-tabellen med valgfrie ski-felter via 1:1 sub-tabell.
-- Brukes når equipment.category = 'ski'. Ikke alle ski har data utfylt.

create table if not exists public.equipment_ski_data (
  equipment_id    uuid primary key references public.equipment(id) on delete cascade,
  ski_type        text check (ski_type in ('klassisk','skoyting','staking')),
  length_cm       int,
  camber          text,
  current_slip    text,
  slip_date       date,
  slip_by         text,
  current_wax     text,
  notes           text,
  updated_at      timestamptz not null default now()
);

alter table public.equipment_ski_data enable row level security;

drop policy if exists "Own ski data" on public.equipment_ski_data;
create policy "Own ski data"
  on public.equipment_ski_data for all
  using (exists (
    select 1 from public.equipment e
    where e.id = equipment_id and e.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.equipment e
    where e.id = equipment_id and e.user_id = auth.uid()
  ));

drop policy if exists "Coach reads ski data" on public.equipment_ski_data;
create policy "Coach reads ski data"
  on public.equipment_ski_data for select
  using (exists (
    select 1 from public.equipment e
    join public.coach_athlete_relations r on r.athlete_id = e.user_id
    where e.id = equipment_id
      and r.coach_id = auth.uid()
      and r.status = 'active'
  ));

notify pgrst, 'reload schema';
