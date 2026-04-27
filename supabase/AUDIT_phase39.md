# Phase 39 — Sikkerhetsaudit: RLS og data-isolasjon

**Dato:** 2026-04-27
**Scope:** Alle public-tabeller på tvers av migrasjoner phase 2 → phase 38.
**Forrige audit:** Phase 29 (`phase29_rls_coach_writes.sql`) lukket trener-write-hull.

## 1. Inventar (verifisering på Supabase)

Kjør `phase39_rls_audit_inventory.sql` i SQL editor for å bekrefte:

- **Spørring 1:** ingen rader med `rls_enabled = false`
- **Spørring 2:** policy-liste — kontroller manuelt at hver tabell har minst én SELECT-policy og en eier-write-policy
- **Spørring 3:** tabeller uten `user_id`-kolonne — verifiser at delt tilgang er ønsket (workout_*-subtabeller går via parent.user_id, det er forventet)
- **Spørring 4:** SECURITY DEFINER-funksjoner — for tiden kun `public.create_coach_group`
- **Spørring 5:** anon/PUBLIC-skrive-tilgang — skal være tom

## 2. Statisk analyse (gjennomført på migrasjons-filer)

### Tabeller med RLS aktivert (50 stk)
profiles, coach_athlete_relations, workouts, workout_movements, workout_zones,
workout_tags, workout_exercises, workout_lactate_measurements, workout_activities,
workout_activity_exercises, workout_activity_exercise_sets,
workout_activity_lactate_measurements, workout_competition_data, workout_test_data,
workout_shooting_blocks, workout_equipment,
daily_health, recovery_entries, weekly_reflections, focus_points, day_states,
seasons, season_periods, season_key_dates, training_goals, training_phases,
period_notes, monthly_volume_plans,
movement_types, user_movement_types, user_exercises, user_heart_zones,
user_favorite_charts, user_ski_conditions_templates,
workout_templates, plan_templates, periodization_templates, test_templates,
calendar_comments, coach_comments, messages, notifications, coach_audit_log,
coach_groups, coach_group_members, coach_invite_codes,
equipment, equipment_ski_data, ski_tests, ski_test_entries, personal_records.

Ingen tabeller funnet uten RLS aktivert.

## 3. Funn og patcher

Alle patcher i `phase39_rls_audit_patches.sql`. Idempotent migrasjon — kan kjøres flere ganger.

### F1 — `messages` UPDATE manglet `with check` (HØY)
Mottaker eller gruppemedlem kunne endre `content`, `sender_id` eller flytte
meldingen mellom samtaler. **Patchet:** `with check` speiler `using` så raden
forblir i samme samtale.

### F2 — `notifications` UPDATE manglet `with check` (HØY)
Bruker kunne endre `title`, `content`, `link_url`, `type` eller flytte varselet
til annen `user_id`. **Patchet:** `with check (user_id = auth.uid())`.

### F3 — `profiles` UPDATE manglet `with check` (LAV — defensivt)
`id` er FK til auth.users og kan ikke i praksis endres. Patchet for
forsvar-i-dybden.

### F4 — `coach_invite_codes` SELECT var `using (true)` (MEDIUM)
Hvilken som helst autentisert bruker kunne liste samtlige aktive invitasjonskoder
ved å SELECT-e tabellen. Selv om koden er en 8-tegns hemmelighet, betyr dette
at en angriper kunne dumpe alle ubrukte koder i sanntid og kapre dem.
**Patchet:** SELECT begrenset til autentiserte trenere, kun ubrukte/ikke-utløpte
koder.

### F5 — `coach_invite_codes` UPDATE-with_check stramt nok? (LAV)
Eksisterende `with check (used_by_coach_id = auth.uid())` lot trener i prinsippet
oppdatere koden uten å sette `used_at`. **Patchet:** krever
`used_by_coach_id = auth.uid() and used_at is not null`.

### F6 — `coach_athlete_relations` direkte INSERT med status='active' (HØY — IKKE PATCHET)
`Coach can manage own relations` er `for all using (coach_id = auth.uid())`. En
trener kan i prinsippet INSERT-e en relasjon mot vilkårlig utøver med
status='active' uten utøverens samtykke.

**Hvorfor ikke patchet:** invite-code redemption (`app/actions/coach-invite.ts:259`)
bruker akkurat denne pathen — direkte INSERT med status='active'. En naiv
RLS-restriksjon (kun status='pending' for coach-INSERT) ville bryte den
fungerende invite-flyten.

**Anbefalt fiks (oppfølgings-fase):**
1. Flytt invite-redemption-logikken inn i en SECURITY DEFINER RPC
   (`public.redeem_coach_invite(p_code text)`) som verifiserer kode + utløp
   før den setter inn relasjon.
2. Stram RLS slik at coach-INSERT kun tillater status='pending'
   (alle andre coach-add-flyter går da via RPC).
3. Aktiver-handlinger fra utøveren godkjenner pending-relasjoner.

### F7 — `create_coach_group` RPC mangler medlems-validering (LAV — IKKE PATCHET)
SECURITY DEFINER-funksjonen i phase 30 tar et `p_member_ids[]` og legger
hvilken som helst bruker_id inn i gruppen. Defineren sjekker bare innsetterens
coach-rolle, ikke om medlemmene har en aktiv relasjon med coach.

**Risiko:** trener kan tvinge en bruker inn i en gruppe uten samtykke.
Synligheten er begrenset (offer ser bare grupper de er medlem i), så
data-lekkasje er minimal — men ikke god UX.

**Anbefalt fiks:** legg til validering i RPC: hver `p_member_ids[i]` må
enten ha `has_coach_role = true` eller en aktiv `coach_athlete_relations`
med innsetteren.

### F9 — anon-rollen har INSERT/UPDATE/DELETE-grants på alle public-tabeller (MEDIUM)
**Funnet via spørring 5 i `phase39_rls_audit_inventory.sql`.** Supabase oppretter
`public.*`-tabeller med automatiske GRANTs til både `anon` og `authenticated`.
I praksis hindrer RLS anon fra å gjøre noe (alle policies krever `auth.uid()`),
men brutt mot defense-in-depth.

**Patchet:** `phase39b_revoke_anon_dml.sql` tilbakekaller INSERT/UPDATE/DELETE og
sequence-usage fra anon, og setter default privileges slik at fremtidige
CREATE TABLE-er heller ikke gir disse grants. SELECT beholdes (Supabase trenger
det for PostgREST-feilhåndtering).

### F8 — `messages` INSERT tillater spam-DM (LAV — IKKE PATCHET)
`Authenticated users send messages` har kun `with check (sender_id = auth.uid())`.
Hvilken som helst autentisert bruker kan sende DM til hvilken som helst annen
bruker uten forutgående relasjon eller felles gruppe.

**Risiko:** trakassering / spam. Ikke et data-isolasjons-problem (mottaker
kan blokkere/slette).

**Anbefalt fiks:** krev coach-athlete-relasjon eller felles gruppe-medlemskap
i `with check`. Krever produkt-beslutning (åpen vs lukket meldingsmodell).

## 4. Coverage-tabell

| Tabell | RLS | Eier-RW | Trener-R | Trener-W | Notat |
|---|---|---|---|---|---|
| profiles | ✓ | ✓ (F3 patch) | ✓ | – | id immutable via FK |
| coach_athlete_relations | ✓ | ✓ | ✓ | ✓ | F6 åpent |
| workouts | ✓ | ✓ | ✓ | ✓ (can_edit_plan) | phase 29 |
| workout_activities | ✓ | ✓ | ✓ | ✓ | phase 29 |
| workout_movements/zones/tags/exercises/lactate | ✓ | ✓ | ✓ | ✓ | phase 29 |
| workout_competition_data | ✓ | ✓ | ✓ | – | trener kun les |
| workout_test_data | ✓ | ✓ | ✓ | ✓ | phase 31 |
| workout_shooting_blocks | ✓ | ✓ | ✓ | – | trener kun les |
| workout_equipment | ✓ | ✓ (via parent) | ✓ | – | phase 36 |
| daily_health | ✓ | ✓ | ✓ | – | helse-data, kun les |
| recovery_entries | ✓ | ✓ | ✓ | – | helse-data, kun les |
| weekly_reflections | ✓ | ✓ | ✓ | – | helse-data, kun les |
| focus_points | ✓ | ✓ | ✓ | ✓ (plan) | phase 29 |
| day_states | ✓ | ✓ | ✓ | ✓ (plan) | phase 29 |
| seasons / season_periods / season_key_dates | ✓ | ✓ | ✓ | ✓ (periodisering) | phase 29 |
| training_goals / training_phases | ✓ | ✓ | – | – | egen kun |
| period_notes | ✓ | ✓ | ✓ | ✓ (plan only) | phase 29 |
| monthly_volume_plans | ✓ | ✓ | ✓ | – | phase 25 |
| movement_types (system) | ✓ | system + own | – | – | system-rader er felles |
| user_movement_types/exercises | ✓ | ✓ | – | – | egen kun |
| user_heart_zones | ✓ | ✓ | ✓ | – | trener kun les |
| user_favorite_charts | ✓ | ✓ | – | – | egen UI-state |
| workout_templates | ✓ | ✓ | – | – | egen mal-bibliotek |
| plan_templates | ✓ | ✓ | – | – | egen mal-bibliotek |
| periodization_templates | ✓ | ✓ | – | – | egen mal-bibliotek |
| test_templates | ✓ | ✓ + delte coach-mal | – | – | phase 31 |
| calendar_comments | ✓ | ✓ | – | – | egen kun |
| coach_comments | ✓ | ✓ | ✓ | ✓ | phase 26 |
| messages | ✓ | sender/recipient/group | – | – | F1 patch, F8 åpent |
| notifications | ✓ | ✓ | – | trener kan opprette | F2 patch |
| coach_audit_log | ✓ | les: coach + athlete | les | insert (coach) | phase 26 |
| coach_groups / coach_group_members | ✓ | medlemmer | medlemmer | admin | phase 26, F7 åpent |
| coach_invite_codes | ✓ | athlete eier | trener slår opp (F4 patch) | trener marker brukt (F5) | |
| equipment / equipment_ski_data | ✓ | ✓ | ✓ | – | phase 36/37 |
| ski_tests / ski_test_entries / user_ski_conditions_templates | ✓ | ✓ | ✓ | – | phase 38 |
| personal_records | ✓ | ✓ | ✓ | ✓ | phase 31 |

## 5. Oppsummering

- **6 patcher landet** (F1–F5 + F9) — lukker konkrete data-isolasjons-hull, enumeration-leak og fjerner anon DML-grants.
- **3 funn dokumentert** (F6–F8) — krever produkt-beslutning + større refaktor før de kan patches uten å bryte fungerende flyter.
- **Ingen tabeller uten RLS** — fjern bekymring om åpne tabeller.
- **anon DML-grants funnet og tilbakekalt** — defense-in-depth gjenopprettet.
- **Én SECURITY DEFINER-funksjon** (`create_coach_group`) — trygg gitt rolle-sjekk, men medlems-validering bør strammes (F7).

## 6. Neste-steg-anbefalinger (ikke i denne migrasjonen)

1. **F6:** flytt invite-redemption inn i SECURITY DEFINER RPC, deretter stram coach-INSERT.
2. **F7:** legg medlems-validering i `create_coach_group`.
3. **F8:** produkt-beslutning på meldingsmodell. Hvis lukket: legg relasjons-gate i INSERT.
4. **Smoke-test etter migrasjon:** kjør hovedflyter (logg økt, send melding, marker varsel lest, redeem invite-code) for å bekrefte at patchene ikke har bivirkninger.
