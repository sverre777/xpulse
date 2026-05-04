-- Fase 54 — Aligner user_movement_types til phase16-spec.
--
-- Diagnostic på prod 2026-05-04 viser at tabellen ble laget av phase25
-- (med parent_category) før phase16 ble kjørt. phase16 sin `create table
-- if not exists` ble derfor no-op, og kolonnene type/subcategories/
-- updated_at kom aldri på. Phase52 + 53 fikset notes og subcategories.
-- Denne migrasjonen lukker gapet for type og updated_at.
--
-- Beholder parent_category i tabellen — den er ikke referert i app/lib/
-- components, men tas ikke ned før vi vet 100% den er tom (separat phase).
--
-- Idempotent.

-- ── 1. type-kolonnen ─────────────────────────────────────────
-- Add med default 'utholdenhet' så eventuelle eksisterende rader får
-- gyldig verdi før NOT NULL aktiveres.
alter table public.user_movement_types
  add column if not exists type text default 'utholdenhet';

-- Backfill nullverdier (kan skje hvis kolonnen ble lagt på uten default
-- i en tidligere kjøring).
update public.user_movement_types
set type = 'utholdenhet'
where type is null;

-- Lås NOT NULL. No-op hvis allerede NOT NULL.
alter table public.user_movement_types
  alter column type set not null;

-- CHECK-constraint på gyldige verdier. Drop alle eksisterende type-checks
-- (uansett navn) og legg ny — sikrer ren tilstand.
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel       on rel.oid = con.conrelid
    join pg_namespace nsp   on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'user_movement_types'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%type%in%utholdenhet%'
  loop
    execute 'alter table public.user_movement_types drop constraint if exists ' || quote_ident(r.conname);
  end loop;
end $$;

alter table public.user_movement_types
  add constraint user_movement_types_type_check
  check (type in ('utholdenhet','styrke','tur','annet'));

-- ── 2. updated_at-kolonnen ───────────────────────────────────
-- Phase16 erklærer den som NOT NULL DEFAULT now(). Add først (m/ default
-- så eksisterende rader får verdi), backfill defensivt, lås NOT NULL.
alter table public.user_movement_types
  add column if not exists updated_at timestamptz default now();

update public.user_movement_types
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.user_movement_types
  alter column updated_at set not null;

-- Sett default på nytt eksplisitt — `add column if not exists` setter den
-- bare ved opprinnelig opprettelse, ikke om kolonnen allerede eksisterte
-- uten default.
alter table public.user_movement_types
  alter column updated_at set default now();

-- ── 3. parent_category beholdes ──────────────────────────────
-- Ingen drop. Ikke referert i app-koden, men droppes ikke før egen phase
-- som verifiserer (a) den er tom eller (b) data er migrert til
-- subcategories. Sikrer at vi ikke mister data ved et uhell.

-- ── Reload PostgREST schema cache ────────────────────────────
notify pgrst, 'reload schema';
