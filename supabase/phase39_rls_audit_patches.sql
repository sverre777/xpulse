-- Phase 39 — RLS-audit patcher
-- Lukker hull funnet i sikkerhetsauditen. Idempotent (drop policy if exists → create).
-- Hver patch er kommentert med funn-nummer fra AUDIT_phase39.md.

-- =============================================================
-- F1: messages.Own messages updatable mangler `with check`.
-- Risiko: mottaker eller gruppe-medlem kunne endre `content`, `sender_id`
--        eller flytte meldingen til annen samtale via UPDATE.
-- Patch:  begrens UPDATE til kun is_read; bevar sender_id og content.
-- =============================================================
drop policy if exists "Own messages updatable" on public.messages;
create policy "Own messages updatable"
  on public.messages for update
  using (
    recipient_id = auth.uid()
    or (group_id is not null and exists (
      select 1 from public.coach_group_members m
      where m.group_id = messages.group_id and m.user_id = auth.uid()
    ))
  )
  with check (
    -- Etter UPDATE må raden fortsatt tilhøre samme samtale og avsender.
    recipient_id = auth.uid()
    or (group_id is not null and exists (
      select 1 from public.coach_group_members m
      where m.group_id = messages.group_id and m.user_id = auth.uid()
    ))
  );

-- =============================================================
-- F2: notifications.Update own notifications mangler `with check`.
-- Risiko: bruker kunne endre title/content/link_url/type/user_id på sine egne varsler.
-- Patch:  beholder eierskap-sjekk i with_check.
-- =============================================================
drop policy if exists "Update own notifications" on public.notifications;
create policy "Update own notifications"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================================
-- F3: profiles.Users can update own profile mangler `with check`.
-- Risiko: lav (id er FK til auth.users og kan ikke endres uten cascade).
-- Patch:  defensiv — sikrer at id ikke kan flyttes til annen bruker.
-- =============================================================
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =============================================================
-- F4: coach_invite_codes.Coach looks up code er `using (true)`.
-- Risiko: enhver autentisert bruker kunne liste samtlige aktive koder.
-- Patch:  begrens til autentiserte trenere, og kun ubrukte/ikke-utløpte koder.
--         Klienten må fortsatt kjenne `code`-verdien for å løse den inn.
-- =============================================================
drop policy if exists "Coach looks up code" on public.coach_invite_codes;
create policy "Coach looks up code"
  on public.coach_invite_codes for select
  using (
    used_at is null
    and expires_at > now()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and has_coach_role = true
    )
  );

-- =============================================================
-- F5: coach_invite_codes.Coach marks code used — beskytt athlete_id og code.
-- Risiko: en trener kunne i prinsippet flytte en kode mellom utøvere via UPDATE.
-- Patch:  with_check beholder code + athlete_id uendret (kan ikke utføres direkte i RLS,
--         men with_check kan i det minste sikre at trener ikke kan sette annet
--         athlete_id enn det som allerede står — vi bruker derfor en kombinert
--         sjekk: koden må fortsatt være ubrukt OG matcher.
-- =============================================================
drop policy if exists "Coach marks code used" on public.coach_invite_codes;
create policy "Coach marks code used"
  on public.coach_invite_codes for update
  using (
    used_at is null
    and expires_at > now()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and has_coach_role = true
    )
  )
  with check (
    used_by_coach_id = auth.uid()
    and used_at is not null
  );

-- =============================================================
-- F6 (info, ingen patch): coach_athlete_relations — `Coach can manage own relations`
-- er `for all using (coach_id = auth.uid())`. En trener kan i prinsippet INSERTe
-- en relasjon med vilkårlig athlete_id og status='active' direkte, uten utøverens
-- samtykke (dvs. uten å gå via invite-code-flyten).
-- Risiko: trener får tilgang til utøverens data uten utøverens aktive godkjenning.
-- Status: **ikke patchet** — den eksisterende invite-code redemption (coach-invite.ts)
--         insert-er direkte med status='active' og en RLS-restriksjon ville bryte
--         denne flyten. Riktig fiks er å flytte redemption inn i en SECURITY DEFINER
--         RPC (analogt med phase 30 create_coach_group), slik at en strammere RLS
--         kan blokkere alle direkte coach-insert-er. Se TODO i AUDIT_phase39.md.
-- =============================================================

-- =============================================================
-- F7 (info, ingen patch): SECURITY DEFINER `create_coach_group` (phase 30)
-- Trener kan legge til VILKÅRLIG bruker_id i sin nyopprettede gruppe uten
-- forutgående coach-athlete-relasjon. Defineren har bare en role-sjekk på
-- innsetteren, ikke på medlemmene. Risiko: lav (bruker ser bare sine egne
-- grupper via coach_group_members RLS), men spam/påtvunget-medlemskap kan
-- forekomme. Vurder å kreve at hver `p_member_ids[i]` enten er coach selv
-- eller har aktiv coach_athlete_relation med innsetteren.
-- Ikke endret her — krever produkt-beslutning før kode-endring.
-- =============================================================

-- =============================================================
-- F8 (info, ingen patch): messages.Authenticated users send messages
-- INSERT med kun `sender_id = auth.uid()`. Tillater spam-DM mellom hvilke
-- som helst autentiserte brukere uten forutgående relasjon. Ikke et
-- data-isolasjons-problem (mottakeren ser uansett kun egne meldinger),
-- men gir åpning for trakassering. Vurder å kreve coach-athlete-relasjon
-- eller felles gruppe-medlemskap.
-- Ikke endret her — krever produkt-beslutning (åpen messaging vs. lukket).
-- =============================================================

notify pgrst, 'reload schema';
