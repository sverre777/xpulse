import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsCategoryCard } from '@/components/settings/SettingsCategoryCard'

export default async function InnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Innstillinger
          </h1>
        </div>

        <div className="space-y-3">
          <SettingsCategoryCard
            href="/app/innstillinger/profil"
            glyph="◉"
            title="Profil"
            description="Navn, fødselsår, sport, bilde og land"
          />
          <SettingsCategoryCard
            href="/app/innstillinger/sikkerhet"
            glyph="✱"
            title="Sikkerhet"
            description="E-post og passord"
          />
          <SettingsCategoryCard
            href="/app/innstillinger/maleenheter"
            glyph="≡"
            title="Måleenheter"
            description="Pace, distanse, vekt og temperatur"
          />
          <SettingsCategoryCard
            href="/app/innstillinger/helse"
            glyph="♥"
            title="Helse og soner"
            description="HFmaks, terskel, hvilepuls og pulssoner"
          />
          <SettingsCategoryCard
            href="/app/innstillinger/trener"
            glyph="◆"
            title="Trener"
            description="Generer kobling-kode og administrer trenere"
          />
          <SettingsCategoryCard
            href="/app/innstillinger/varsler"
            glyph="✉"
            title="Varsler"
            description="E-post-varsler for kommentarer, meldinger og plan"
          />
          <SettingsCategoryCard
            href="/app/innstillinger/bevegelsesformer"
            glyph="↯"
            title="Bevegelsesformer"
            description="Egne bevegelsesformer i tillegg til standardlisten"
          />
          <SettingsCategoryCard
            href="/app/innstillinger/personvern"
            glyph="⊘"
            title="Personvern og data"
            description="Eksporter data eller slett kontoen"
          />
          <SettingsCategoryCard
            href="/app/innstillinger/abonnement"
            glyph="₪"
            title="Abonnement"
            description="Plan og fakturering"
          />
        </div>
      </div>
    </div>
  )
}
