-- Phase 26: Coach panel MVP
-- Bygger trener-opplevelsen oppå eksisterende dual-role (phase 23).
-- Kjøres som én samlet migrering. Idempotent via "if not exists" / "drop policy if exists".

-- ============================================================
-- 1. Permissions-kolonner på coach_athlete_relations
-- Default true: eksisterende relasjoner beholder dagens tilgang.
-- Finkornet kontroll settes per-relasjon fra trener-UI senere.
-- ============================================================
alter table public.coach_athlete_relations
  add column if not exists can_edit_plan          boolean not null default true,
  add column if not exists can_view_dagbok        boolean not null default true,
  add column if not exists can_view_analysis      boolean not null default true,
  add column if not exists can_edit_periodization boolean not null default true;

-- ============================================================
-- 2. workouts.created_by_coach_id
-- Null for egenlagde økter. Set når trener oppretter/pusher.
-- on delete set null slik at trener som fjernes ikke sletter utøverens økt.
-- ============================================================
alter table public.workouts
  add column if not exists created_by_coach_id uuid references public.profiles(id) on delete set null;

create index if not exists workouts_created_by_coach_idx
  on public.workouts(created_by_coach_id) where created_by_coach_id is not null;

-- ============================================================
-- 3. coach_groups + coach_group_members
-- Trenergrupper. Utøvere ser ikke gruppestruktur utover egen medlemskap.
-- ============================================================
create table if not exists public.coach_groups (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists coach_groups_creator_idx on public.coach_groups(created_by);

create table if not exists public.coach_group_members (
  id        uuid primary key default uuid_generate_v4(),
  group_id  uuid not null references public.coach_groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('admin','coach','athlete')),
  added_at  timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists coach_group_members_group_idx on public.coach_group_members(group_id);
create index if not exists coach_group_members_user_idx  on public.coach_group_members(user_id);

alter table public.coach_groups        enable row level security;
alter table public.coach_group_members enable row level security;

drop policy if exists "Members read groups" on public.coach_groups;
create policy "Members read groups"
  on public.coach_groups for select
  using (exists (
    select 1 from public.coach_group_members m
    where m.group_id = id and m.user_id = auth.uid()
  ));

drop policy if exists "Creator manages groups" on public.coach_groups;
create policy "Creator manages groups"
  on public.coach_groups for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Members read own membership" on public.coach_group_members;
create policy "Members read own membership"
  on public.coach_group_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.coach_group_members m
      where m.group_id = coach_group_members.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin','coach')
    )
  );

drop policy if exists "Admins manage members" on public.coach_group_members;
create policy "Admins manage members"
  on public.coach_group_members for all
  using (exists (
    select 1 from public.coach_group_members m
    where m.group_id = coach_group_members.group_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  ))
  with check (exists (
    select 1 from public.coach_group_members m
    where m.group_id = coach_group_members.group_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  ));

-- ============================================================
-- 4. messages (DM + gruppemeldinger)
-- ============================================================
create table if not exists public.messages (
  id           uuid primary key default uuid_generate_v4(),
  sender_id    uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  group_id     uuid references public.coach_groups(id) on delete cascade,
  content      text not null,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now(),
  check (recipient_id is not null or group_id is not null)
);

create index if not exists messages_recipient_idx on public.messages(recipient_id, created_at desc);
create index if not exists messages_group_idx     on public.messages(group_id, created_at desc);
create index if not exists messages_sender_idx    on public.messages(sender_id);

alter table public.messages enable row level security;

drop policy if exists "Sender and recipient read messages" on public.messages;
create policy "Sender and recipient read messages"
  on public.messages for select
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or (group_id is not null and exists (
      select 1 from public.coach_group_members m
      where m.group_id = messages.group_id and m.user_id = auth.uid()
    ))
  );

drop policy if exists "Authenticated users send messages" on public.messages;
create policy "Authenticated users send messages"
  on public.messages for insert
  with check (sender_id = auth.uid());

drop policy if exists "Own messages updatable" on public.messages;
create policy "Own messages updatable"
  on public.messages for update
  using (
    recipient_id = auth.uid()
    or (group_id is not null and exists (
      select 1 from public.coach_group_members m
      where m.group_id = messages.group_id and m.user_id = auth.uid()
    ))
  );

-- ============================================================
-- 5. coach_comments
-- Trådbaserte kommentarer på økt/dag/uke/måned i plan/dagbok/periodisering.
-- ============================================================
create table if not exists public.coach_comments (
  id         uuid primary key default uuid_generate_v4(),
  author_id  uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  scope      text not null check (scope in ('day','week','month','workout')),
  period_key text not null,
  context    text not null check (context in ('plan','dagbok','periodisering')),
  content    text not null,
  parent_id  uuid references public.coach_comments(id) on delete cascade,
  is_read    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_comments_athlete_period_idx
  on public.coach_comments(athlete_id, scope, period_key, context);
create index if not exists coach_comments_author_idx
  on public.coach_comments(author_id, created_at desc);

alter table public.coach_comments enable row level security;

drop policy if exists "Athlete and coach read comments" on public.coach_comments;
create policy "Athlete and coach read comments"
  on public.coach_comments for select
  using (
    athlete_id = auth.uid()
    or exists (
      select 1 from public.coach_athlete_relations r
      where r.athlete_id = coach_comments.athlete_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
    )
  );

drop policy if exists "Write comments on own or own athlete" on public.coach_comments;
create policy "Write comments on own or own athlete"
  on public.coach_comments for all
  using (
    (author_id = auth.uid() and athlete_id = auth.uid())
    or exists (
      select 1 from public.coach_athlete_relations r
      where r.athlete_id = coach_comments.athlete_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
    )
  )
  with check (
    author_id = auth.uid()
    and (
      athlete_id = auth.uid()
      or exists (
        select 1 from public.coach_athlete_relations r
        where r.athlete_id = coach_comments.athlete_id
          and r.coach_id = auth.uid()
          and r.status = 'active'
      )
    )
  );

-- ============================================================
-- 6. notifications
-- System-varsler. Insert typisk fra server action eller trigger.
-- ============================================================
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  content    text,
  link_url   text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Read own notifications" on public.notifications;
create policy "Read own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "Update own notifications" on public.notifications;
create policy "Update own notifications"
  on public.notifications for update
  using (user_id = auth.uid());

-- Tillat trenere å skrive varsler til sine egne utøvere,
-- og brukere å skrive til seg selv (selv-handlinger som kan trigge varsel).
drop policy if exists "Coach or self inserts notifications" on public.notifications;
create policy "Coach or self inserts notifications"
  on public.notifications for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.coach_athlete_relations r
      where r.athlete_id = notifications.user_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
    )
  );

-- ============================================================
-- 7. plan_templates + periodization_templates
-- ============================================================
create table if not exists public.plan_templates (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  duration_days int not null check (duration_days > 0),
  plan_data     jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists plan_templates_user_idx on public.plan_templates(user_id);

alter table public.plan_templates enable row level security;

drop policy if exists "Own plan templates" on public.plan_templates;
create policy "Own plan templates"
  on public.plan_templates for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.periodization_templates (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  template_data jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists periodization_templates_user_idx on public.periodization_templates(user_id);

alter table public.periodization_templates enable row level security;

drop policy if exists "Own periodization templates" on public.periodization_templates;
create policy "Own periodization templates"
  on public.periodization_templates for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- 8. coach_audit_log
-- Alle trener-endringer på utøvers data. Vises ikke i UI i MVP.
-- ============================================================
create table if not exists public.coach_audit_log (
  id          uuid primary key default uuid_generate_v4(),
  coach_id    uuid not null references auth.users(id) on delete cascade,
  athlete_id  uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists coach_audit_log_athlete_idx on public.coach_audit_log(athlete_id, created_at desc);
create index if not exists coach_audit_log_coach_idx   on public.coach_audit_log(coach_id, created_at desc);

alter table public.coach_audit_log enable row level security;

drop policy if exists "Coach reads own logs" on public.coach_audit_log;
create policy "Coach reads own logs"
  on public.coach_audit_log for select
  using (coach_id = auth.uid());

drop policy if exists "Athlete reads own logs" on public.coach_audit_log;
create policy "Athlete reads own logs"
  on public.coach_audit_log for select
  using (athlete_id = auth.uid());

-- Insert krever at brukeren faktisk er aktiv trener for utøveren.
drop policy if exists "Coach inserts audit" on public.coach_audit_log;
create policy "Coach inserts audit"
  on public.coach_audit_log for insert
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.coach_athlete_relations r
      where r.athlete_id = coach_audit_log.athlete_id
        and r.coach_id = auth.uid()
        and r.status = 'active'
    )
  );

-- ============================================================
-- updated_at triggers for nye tabeller som har kolonnen
-- (handle_updated_at finnes allerede i schema.sql)
-- ============================================================
drop trigger if exists coach_groups_updated_at on public.coach_groups;
create trigger coach_groups_updated_at
  before update on public.coach_groups
  for each row execute procedure public.handle_updated_at();

drop trigger if exists coach_comments_updated_at on public.coach_comments;
create trigger coach_comments_updated_at
  before update on public.coach_comments
  for each row execute procedure public.handle_updated_at();

drop trigger if exists plan_templates_updated_at on public.plan_templates;
create trigger plan_templates_updated_at
  before update on public.plan_templates
  for each row execute procedure public.handle_updated_at();

drop trigger if exists periodization_templates_updated_at on public.periodization_templates;
create trigger periodization_templates_updated_at
  before update on public.periodization_templates
  for each row execute procedure public.handle_updated_at();

notify pgrst, 'reload schema';
