-- Phase 39b — Defense-in-depth: tilbakekall DML-privilegier fra anon-rollen.
--
-- Bakgrunn (audit-funn F9):
-- Supabase oppretter `public.*`-tabeller med automatiske GRANTs på INSERT/UPDATE/DELETE
-- til både `anon` og `authenticated`. RLS hindrer i praksis anon fra å gjøre noe
-- (siden alle policies krever auth.uid()), men defense-in-depth tilsier at anon
-- ikke skal ha DML-privilegier i det hele tatt — RLS bør være andre lag, ikke det
-- eneste laget.
--
-- Etter denne migrasjonen:
--   · anon kan fortsatt SELECT på alle tabeller (Supabase trenger dette for at
--     PostgREST skal kunne svare på "ikke autorisert" i stedet for "ikke funnet").
--     RLS hindrer faktisk lesing av rader.
--   · anon kan IKKE INSERT/UPDATE/DELETE noen rader. Selv om en RLS-policy ved
--     en feil skulle bruke `using (true)` på en write-policy, ville GRANT-mangelen
--     fortsatt blokkere skriving fra anon.
--   · `authenticated` beholder alle privilegier — det er der RLS gjør jobben.
--
-- Idempotent: REVOKE er trygt å kjøre flere ganger.

revoke insert, update, delete on all tables in schema public from anon;

-- Default privileges for fremtidige tabeller (sørger for at nye CREATE TABLE
-- ikke får DML-grants til anon på nytt).
alter default privileges in schema public
  revoke insert, update, delete on tables from anon;

-- Tilsvarende på sequences (anon trenger ikke å mutere ID-sekvenser).
revoke usage, update on all sequences in schema public from anon;

alter default privileges in schema public
  revoke usage, update on sequences from anon;

notify pgrst, 'reload schema';
