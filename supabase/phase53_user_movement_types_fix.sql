-- Fase 53 — user_movement_types schema-drift fix.
--
-- Symptom: "Could not find the 'subcategories' column of 'user_movement_types'
-- in the schema cache" ved opprettelse av egen bevegelsesform i innstillinger.
-- Samme mønster som notes-kolonnen i phase52 — drift mellom phase16-SQL og prod.
--
-- Phase16 erklærer:
--   subcategories text[]
--   notes         text
--   unique (user_id, name)
--
-- Idempotent. Trygg å kjøre flere ganger.

-- ── 1. subcategories text[] ──────────────────────────────────
-- text[] (Postgres array av tekst) for at brukerne kan lagre flere
-- underkategorier per bevegelsesform — matcher phase16:13.
alter table public.user_movement_types
  add column if not exists subcategories text[];

-- ── 2. notes text (re-applisert defensivt) ───────────────────
-- Phase52 la denne på, men vi gjentar `if not exists` her for å gjøre
-- denne migrasjonen alenestående brukbar.
alter table public.user_movement_types
  add column if not exists notes text;

-- ── 3. unique (user_id, name) ────────────────────────────────
-- Hvis constrainten har driftet bort kan det føre til duplikat-rader
-- og merkelige UI-feil. Sjekk om en unique constraint på (user_id, name)
-- finnes; legg på hvis ikke.
do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel       on rel.oid = con.conrelid
    join pg_namespace nsp   on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'user_movement_types'
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) ilike '%(user_id, name)%'
  ) then
    alter table public.user_movement_types
      add constraint user_movement_types_user_id_name_key
      unique (user_id, name);
  end if;
end $$;

-- ── Reload PostgREST schema cache ────────────────────────────
notify pgrst, 'reload schema';
