-- Fase 35: Faktiske datoer på plan- og periodiseringsmaler.
-- Tidligere lagret malene kun duration_days + relative day_offset i jsonb.
-- Nå lagrer vi i tillegg start_date (og end_date som ledet utledning)
-- slik at trener kan fylle ut konkrete kalenderdager når en mal opprettes
-- eller pushes. Felter er nullable for bakoverkompabilitet med eldre maler.

alter table public.plan_templates
  add column if not exists start_date date,
  add column if not exists end_date   date;

alter table public.periodization_templates
  add column if not exists start_date date,
  add column if not exists end_date   date;

-- Indeks for sortering/filtrering på dato (best-effort — eldre rader har null).
create index if not exists plan_templates_start_date_idx
  on public.plan_templates(user_id, start_date);

create index if not exists periodization_templates_start_date_idx
  on public.periodization_templates(user_id, start_date);

notify pgrst, 'reload schema';
