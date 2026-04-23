-- Phase 30: SECURITY DEFINER RPC for å opprette gruppe + bootstrap admin-medlemskap
-- Nødvendig fordi "Admins manage members"-RLS (phase 26) krever en eksisterende
-- admin-rad før man kan sette inn nye rader i coach_group_members. Den første
-- admin-raden har ingen admin ennå og må opprettes via definer-rettigheter.
--
-- Pakket inn i DO-blokk med EXECUTE fordi Supabase SQL Editor ellers tolker
-- plpgsql-variabler i funksjonskroppen som relasjoner før CREATE FUNCTION
-- er parset som én enhet.
-- ============================================================

do $migration$
begin
  execute $fn$
    create or replace function public.create_coach_group(
      p_name text,
      p_description text default null,
      p_member_ids uuid[] default array[]::uuid[]
    ) returns uuid
    language plpgsql
    security definer
    set search_path = public, auth
    as $body$
    declare
      v_group_id uuid;
      v_user_id uuid := auth.uid();
      v_member_id uuid;
      v_member_is_coach boolean;
      v_is_coach boolean;
    begin
      if v_user_id is null then
        raise exception 'Ikke innlogget';
      end if;

      select has_coach_role into v_is_coach from public.profiles where id = v_user_id;
      if not coalesce(v_is_coach, false) then
        raise exception 'Kun trenere kan opprette grupper';
      end if;

      if coalesce(trim(p_name), '') = '' then
        raise exception 'Gruppenavn er påkrevd';
      end if;

      insert into public.coach_groups (name, description, created_by)
      values (trim(p_name), nullif(trim(p_description), ''), v_user_id)
      returning id into v_group_id;

      insert into public.coach_group_members (group_id, user_id, role)
      values (v_group_id, v_user_id, 'admin');

      foreach v_member_id in array coalesce(p_member_ids, array[]::uuid[]) loop
        if v_member_id = v_user_id then continue; end if;

        select has_coach_role into v_member_is_coach
        from public.profiles where id = v_member_id;

        insert into public.coach_group_members (group_id, user_id, role)
        values (
          v_group_id,
          v_member_id,
          case when coalesce(v_member_is_coach, false) then 'coach' else 'athlete' end
        )
        on conflict (group_id, user_id) do nothing;
      end loop;

      return v_group_id;
    end;
    $body$;
  $fn$;
end
$migration$;

grant execute on function public.create_coach_group(text, text, uuid[]) to authenticated;
