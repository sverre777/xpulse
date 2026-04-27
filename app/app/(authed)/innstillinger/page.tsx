import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsCategoryCard } from '@/components/settings/SettingsCategoryCard'
import type { Role } from '@/lib/types'

const ATHLETE_ORANGE = '#FF4500'
const COACH_BLUE = '#1A6FD4'

export default async function InnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_role, role, has_coach_role, has_athlete_role')
    .eq('id', user.id)
    .single()

  const activeRole: Role = (profile?.active_role ?? profile?.role ?? 'athlete') as Role
  const hasCoachRole: boolean = profile?.has_coach_role ?? false
  const isCoachMode = activeRole === 'coach' && hasCoachRole
  const accent = isCoachMode ? COACH_BLUE : ATHLETE_ORANGE

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: accent, display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Innstillinger
          </h1>
        </div>

        {isCoachMode && (
          <p className="text-xs tracking-widest uppercase mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Trener-modus
          </p>
        )}

        <div className="space-y-3">
          <SettingsCategoryCard
            href="/app/innstillinger/profil"
            glyph="◉"
            title="Profil"
            description="Navn, fødselsår, sport, bilde og land"
            accent={accent}
          />
          <SettingsCategoryCard
            href="/app/innstillinger/sikkerhet"
            glyph="✱"
            title="Sikkerhet"
            description="E-post og passord"
            accent={accent}
          />
          <SettingsCategoryCard
            href="/app/innstillinger/maleenheter"
            glyph="≡"
            title="Måleenheter"
            description="Pace, distanse, vekt og temperatur"
            accent={accent}
          />

          {!isCoachMode && (
            <SettingsCategoryCard
              href="/app/innstillinger/helse"
              glyph="♥"
              title="Helse og soner"
              description="HFmaks, terskel, hvilepuls og pulssoner"
              accent={accent}
            />
          )}
          {!isCoachMode && (
            <SettingsCategoryCard
              href="/app/innstillinger/trener"
              glyph="◆"
              title="Trener"
              description="Generer kobling-kode og administrer trenere"
              accent={accent}
            />
          )}

          <SettingsCategoryCard
            href="/app/innstillinger/varsler"
            glyph="✉"
            title="Varsler"
            description="E-post-varsler for kommentarer, meldinger og plan"
            accent={accent}
          />
          <SettingsCategoryCard
            href="/app/innstillinger/bevegelsesformer"
            glyph="↯"
            title="Bevegelsesformer"
            description="Egne bevegelsesformer i tillegg til standardlisten"
            accent={accent}
          />
          <SettingsCategoryCard
            href="/app/innstillinger/personvern"
            glyph="⊘"
            title="Personvern og data"
            description="Eksporter data eller slett kontoen"
            accent={accent}
          />
          <SettingsCategoryCard
            href="/app/innstillinger/abonnement"
            glyph="₪"
            title="Abonnement"
            description="Plan og fakturering"
            accent={accent}
          />

          {isCoachMode && (
            <>
              <div className="pt-6 pb-2 flex items-center gap-3">
                <span style={{ width: '24px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
                <span className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  Trener-spesifikke innstillinger
                </span>
              </div>
              <SettingsCategoryCard
                href="/app/innstillinger/utovere"
                glyph="◐"
                title="Mine utøvere"
                description="Administrer koblinger, rettigheter og status"
                accent={COACH_BLUE}
              />
              <SettingsCategoryCard
                href="/app/innstillinger/grupper"
                glyph="◇"
                title="Grupper"
                description="Opprett og administrer treningsgrupper"
                accent={COACH_BLUE}
              />
              <SettingsCategoryCard
                href="/app/innstillinger/trener-profil"
                glyph="◈"
                title="Trener-profil"
                description="Bio, sertifiseringer, spesialiteter og synlighet"
                accent={COACH_BLUE}
              />
              <SettingsCategoryCard
                href="/app/innstillinger/default-permissions"
                glyph="⚙"
                title="Standard rettigheter"
                description="Forhåndsvalg for nye utøver-koblinger"
                accent={COACH_BLUE}
              />
              <SettingsCategoryCard
                href="/app/innstillinger/paminnelser"
                glyph="⏱"
                title="Påminnelser"
                description="Varsler om utøvere som ikke har logget på X dager"
                accent={COACH_BLUE}
              />
              <SettingsCategoryCard
                href="/app/innstillinger/eksport-utovere"
                glyph="⇩"
                title="Eksport av utøver-data"
                description="Last ned aggregert CSV med trening, tester og konkurranser"
                accent={COACH_BLUE}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
