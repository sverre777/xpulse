-- Fase 76: standardøkt-tagging
-- En øktmal ER en "standardøkt" (fast terskeltest, standard intervalløkt, fast
-- rute). Vi vil kunne TAGGE en gjennomført økt som "denne standardøkten" UTEN å
-- hente mal-data — særlig for klokkesynk-økter som ikke kom fra en mal.
--
-- Forskjell fra template_id: template_id settes når økten ble OPPRETTET fra en
-- mal. standard_workout_template_id sier "denne økten REPRESENTERER denne
-- standardøkten", uavhengig av om den ble laget fra malen. (Når man bruker en
-- mal settes begge.)

alter table public.workouts
  add column if not exists standard_workout_template_id uuid
    references public.workout_templates(id) on delete set null;

create index if not exists idx_workouts_standard_workout_template_id
  on public.workouts (standard_workout_template_id)
  where standard_workout_template_id is not null;

grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workouts to service_role;

notify pgrst, 'reload schema';
