-- Fase 43 — Fellestrening-markering på workouts
--
-- is_group_session:    flagger økten som fellestrening (klubbtrening, lagsamling osv).
-- group_session_label: valgfri tekst som lar flere økter på tvers av utøvere knyttes
--                      til samme fellestrening (f.eks. "Tirsdagstrening klubb").
--
-- Trener-oversikten aggregerer på (date, label) — krever minst 2 utøvere for at en
-- fellestrening skal vises i kortet "Neste fellestrening".
--
-- Idempotent.

alter table public.workouts
  add column if not exists is_group_session boolean not null default false,
  add column if not exists group_session_label text;

create index if not exists workouts_group_session_idx
  on public.workouts(user_id, date)
  where is_group_session = true;

create index if not exists workouts_group_session_label_idx
  on public.workouts(group_session_label, date)
  where is_group_session = true and group_session_label is not null;

notify pgrst, 'reload schema';
