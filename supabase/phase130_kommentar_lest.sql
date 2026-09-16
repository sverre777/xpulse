/* Fase 130: KOMMENTARER KAN MERKES LEST - RPC. */ 
/* */ 
/* SAKEN (meldt av Erik Jørstad 16. sep): telleren pa innboks-ikonet gikk */ 
/* aldri ned. Kartleggingen fant TRE feil som alle ma vaere borte for */ 
/* tallet kan na null. */ 
/* */ 
/* 1  TRENEREN SA ALDRI DET TELLEREN TALTE. */ 
/*    getInboxUnreadCount teller for en trener: kommentarer pa MINE */ 
/*    utovere som NOEN ANDRE har skrevet (author_id <> meg). */ 
/*    getInboxComments hentet for en trener: .eq('author_id', meg) - */ 
/*    altsa kommentarene TRENEREN SELV hadde skrevet. To disjunkte */ 
/*    mengder: det telleren talte, kom aldri i lista han kunne apne. */ 
/*    Rettet i koden, ikke her. */ 
/* */ 
/* 2  markInboxCommentRead BLE ALDRI KALT. Funksjonen har ligget i */ 
/*    app/actions/inbox.ts siden fase 26 uten ett eneste kallsted */ 
/*    (grep: null treff utenfor sin egen definisjon). Ingen ting i appen */ 
/*    skrev is_read = true pa en kommentar - hverken ved apning, klikk */ 
/*    eller svar. Rettet i koden, ikke her. */ 
/* */ 
/* 3  UTOVEREN HAR IKKE LOV TIL A SKRIVE is_read. Dette er hullet som */ 
/*    KREVER SQL, og grunnen til at punkt 2 ikke kunne rettes alene. */ 
/* */ 
/* phase26_coach_panel.sql:187 «Write comments on own or own athlete» er */ 
/* en FOR ALL-policy, og USING-leddet er: */ 
/* */ 
/*    (author_id = auth.uid() and athlete_id = auth.uid()) */ 
/*    or  <aktiv trener-relasjon til athlete_id> */ 
/* */ 
/* En utover som vil merke TRENERENS kommentar pa sin egen okt treffer */ 
/* ingen av dem: author_id er trenerens, og han er ikke trener for seg */ 
/* selv. UPDATE-en avvises - og i PostgREST betyr «avvist av USING» ikke */ 
/* en feilmelding, men NULL RADER OG HTTP 204. Et kall som ser ut til a */ 
/* virke, endrer ingenting. Punkt 2 rettet alene ville altsa gitt en */ 
/* knapp som ikke gjorde noe, for utoveren - som er verre enn ingen. */ 
/* */ 
/* HVORFOR RPC OG IKKE EN NY UPDATE-POLICY: */ 
/* RLS kan ikke begrense HVILKE KOLONNER en UPDATE rorer. En policy som */ 
/* slapp utoveren til for a sette is_read, ville samtidig latt ham endre */ 
/* content pa trenerens kommentar. RPC-en setter ett felt, og gjor */ 
/* rettighetssjekken selv. Samme grep som fase 125. */ 
/* */ 
/* DEN VIKTIGE INVARIANTEN: RPC-en merker NOYAKTIG DET TELLEREN TELLER. */ 
/* Begge sier «kommentarer pa data jeg er part i, skrevet av en annen»: */ 
/* author_id <> auth.uid(), og athlete_id er meg eller en av mine */ 
/* utovere. Divergerer de to, er vi tilbake til feil 1 - derfor er */ 
/* betingelsen skrevet ut her, ikke gjemt i en hjelpefunksjon. */ 
/* */ 
/* Ingen datarader endres av migrasjonen selv. */ 
/* Kolonnene er sjekket mot phase26_coach_panel.sql:152-164 */ 
/* (coach_comments: id, author_id, athlete_id, is_read) og mot */ 
/* coach_athlete_relations (coach_id, athlete_id, status). */ 
 
begin; 
 
/* ── FØR: funksjonen, radene, og hvor mange som star som lest ─────────────── */ 
select 'FØR' as steg, 
       (select count(*) from pg_proc p 
          join pg_namespace n on n.oid = p.pronamespace 
         where n.nspname = 'public' 
           and p.proname = 'merk_kommentarer_lest') as funksjonen_finnes, 
       (select count(*) from public.coach_comments) as antall_rader, 
       (select count(*) from public.coach_comments where is_read) as antall_lest; 
 
/* Tallene fryses her, sa assertionen under kan sammenligne mot dem. */ 
/* on commit drop: tabellen forsvinner nar transaksjonen er ferdig. */ 
create temporary table _fase130_for on commit drop as 
select (select count(*) from public.coach_comments) as antall_rader, 
       (select count(*) from public.coach_comments where is_read) as antall_lest; 
 
create or replace function public.merk_kommentarer_lest(p_ids uuid[]) 
returns integer 
language plpgsql 
security definer 
set search_path = public 
as $$ 
declare 
  v_antall integer; 
begin 
  if auth.uid() is null then 
    raise exception 'Ikke innlogget' using errcode = '42501'; 
  end if; 
 
  if p_ids is null or array_length(p_ids, 1) is null then 
    return 0; 
  end if; 
 
  update public.coach_comments c 
     set is_read = true 
   where c.id = any(p_ids) 
     and c.is_read = false 
     /* aldri mine egne: de er ikke innkommende for meg, og telleren */ 
     /* teller dem heller ikke */ 
     and c.author_id <> auth.uid() 
     and ( 
       /* utoveren: kommentarer pa mine egne data */ 
       c.athlete_id = auth.uid() 
       /* treneren: kommentarer pa en utover jeg har aktiv relasjon til */ 
       or exists ( 
         select 1 
           from public.coach_athlete_relations r 
          where r.athlete_id = c.athlete_id 
            and r.coach_id = auth.uid() 
            and r.status = 'active' 
       ) 
     ); 
 
  get diagnostics v_antall = row_count; 
  return v_antall; 
end; 
$$; 
 
revoke all on function public.merk_kommentarer_lest(uuid[]) from public, anon; 
grant execute on function public.merk_kommentarer_lest(uuid[]) to authenticated; 
 
/* ── ETTER: samme tre ─────────────────────────────────────────────────────── */ 
select 'ETTER' as steg, 
       (select count(*) from pg_proc p 
          join pg_namespace n on n.oid = p.pronamespace 
         where n.nspname = 'public' 
           and p.proname = 'merk_kommentarer_lest') as funksjonen_finnes, 
       (select count(*) from public.coach_comments) as antall_rader, 
       (select count(*) from public.coach_comments where is_read) as antall_lest; 
 
/* ── TRE ASSERTIONS OG EN AVLESNING ───────────────────────────────────────── */ 
select 'funksjonen finnes, er security definer, og har search_path=public' as sjekk, 
       case when exists ( 
         select 1 from pg_proc p 
           join pg_namespace n on n.oid = p.pronamespace 
          where n.nspname = 'public' 
            and p.proname = 'merk_kommentarer_lest' 
            and p.prosecdef 
            and p.proconfig @> array['search_path=public'] 
       ) then 'OK' else 'FEIL' end as resultat 
union all 
/* DEN VIKTIGSTE: en security definer-funksjon som star apen for PUBLIC */ 
/* eller anon er verre enn policyen vi unngikk. proacl er NULL sa lenge */ 
/* ingen har rort rettighetene - og NULL betyr at PUBLIC HAR EXECUTE, */ 
/* som er standarden for funksjoner i Postgres. Derfor er revoke-linja */ 
/* ikke pynt, og derfor sjekkes proacl eksplisitt her. */ 
select 'execute er gitt til authenticated, og IKKE til public eller anon', 
       case when ( 
         select p.proacl is not null 
            and exists (select 1 from aclexplode(p.proacl) a 
                         where a.grantee = to_regrole('authenticated')::oid 
                           and a.privilege_type = 'EXECUTE') 
            and not exists (select 1 from aclexplode(p.proacl) a 
                             where a.grantee = 0 
                               and a.privilege_type = 'EXECUTE') 
            and not exists (select 1 from aclexplode(p.proacl) a 
                             where a.grantee = coalesce(to_regrole('anon')::oid, 0) 
                               and a.privilege_type = 'EXECUTE') 
           from pg_proc p 
           join pg_namespace n on n.oid = p.pronamespace 
          where n.nspname = 'public' 
            and p.proname = 'merk_kommentarer_lest' 
       ) then 'OK' else 'FEIL' end 
union all 
/* Migrasjonen skal opprette en funksjon, ikke rore data. Star det FEIL */ 
/* her, har noe merket kommentarer lest - og da skal den rulles tilbake. */ 
select 'ingen rad har endret is_read (migrasjonen rorer ikke data)', 
       case when (select f.antall_lest from _fase130_for f) 
               = (select count(*) from public.coach_comments where is_read) 
         then 'OK' else 'FEIL' end 
union all 
select 'AVLESNING: radtall uendret i coach_comments (FØR = ETTER over)', 
       'SE TALLENE'; 
 
commit; 
