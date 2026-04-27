-- Phase 39 — RLS-audit inventar
-- Kjør dette read-only-scriptet i Supabase SQL editor for å verifisere
-- at alle public-tabeller har RLS aktivert og minst én policy.
-- Forventet: ingen rader med rls_enabled = false, ingen rader med policy_count = 0.

-- 1) RLS-status per tabell
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  (
    select count(*)::int
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
  ) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity asc, c.relname asc;

-- 2) Policies per tabell (kommando + uttrykk)
select
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3) Tabeller uten user_id-kolonne (potensielle delte/lookup-tabeller — verifiser at delt tilgang er ønsket)
select
  c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = c.relname
      and column_name = 'user_id'
  )
order by c.relname;

-- 4) Eskalerings-sjekk: funksjoner som kjører som SECURITY DEFINER
-- (disse omgår RLS og må gjennomgås nøye)
select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;

-- 5) Tabeller hvor anon-rollen har skrive-tilgang (skal være tom-resultat)
select
  table_schema, table_name, privilege_type, grantee
from information_schema.table_privileges
where table_schema = 'public'
  and grantee in ('anon', 'PUBLIC')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by table_name, privilege_type;
