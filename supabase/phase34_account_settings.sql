-- Fase 34: Brukerkonto-innstillinger — utvider profiles med
-- profil-, sikkerhets-, enhets-, varslings- og GDPR-felter.
-- Idempotent: kan kjøres på nytt uten side-effekter.

-- ── Profil ─────────────────────────────────────────────────
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists profile_image_url text,
  add column if not exists gender text
    check (gender is null or gender in ('male','female','other','prefer_not_to_say')),
  add column if not exists country text;

-- ── Sikkerhet (e-post-bytte) ──────────────────────────────
-- requestEmailChange skriver pending + tidsstempel; bekreftes via Supabase
-- magic link → bekreftelses-server-action setter email + nuller pending.
alter table public.profiles
  add column if not exists email_change_pending text,
  add column if not exists email_change_requested_at timestamptz;

-- ── Måleenheter ──────────────────────────────────────────
alter table public.profiles
  add column if not exists default_distance_unit text
    check (default_distance_unit is null or default_distance_unit in ('km','mi')),
  add column if not exists default_temperature_unit text
    check (default_temperature_unit is null or default_temperature_unit in ('c','f')),
  add column if not exists default_weight_unit text
    check (default_weight_unit is null or default_weight_unit in ('kg','lb'));

-- ── Varsler (e-post på/av per type) ────────────────────────
alter table public.profiles
  add column if not exists notify_email_coach_comment boolean default true,
  add column if not exists notify_email_new_message boolean default true,
  add column if not exists notify_email_plan_pushed boolean default true,
  add column if not exists notify_email_weekly_summary boolean default false,
  add column if not exists notify_email_product_updates boolean default false;

-- ── GDPR: soft delete med 7-dagers angrefrist ──────────────
-- Når != null står konto i "scheduled for deletion"-modus.
-- Bakgrunnsjobb (cron) sletter når now() > deletion_requested_at + interval '7 days'.
alter table public.profiles
  add column if not exists deletion_requested_at timestamptz;

create index if not exists profiles_deletion_requested_at_idx
  on public.profiles (deletion_requested_at)
  where deletion_requested_at is not null;

-- Storage bucket for profilbilder. Privat bucket; lesing skjer via signed URLs
-- eller via profiles.profile_image_url (lagret som signert URL eller offentlig path).
insert into storage.buckets (id, name, public)
  values ('profile-images', 'profile-images', true)
  on conflict (id) do nothing;

-- RLS for storage.objects på profile-images: bruker kan lese/skrive egne filer
-- (path = user_id/...). Public read er enabled via bucket-public-flagget.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'profile_images_owner_write'
  ) then
    create policy profile_images_owner_write on storage.objects
      for all to authenticated
      using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

notify pgrst, 'reload schema';
