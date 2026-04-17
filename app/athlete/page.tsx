import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/dashboard/NavBar'
import { StatCard } from '@/components/dashboard/StatCard'
import { PlaceholderPanel } from '@/components/dashboard/PlaceholderPanel'

export default async function AthleteDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'coach') {
    redirect('/coach')
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Utøver'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
      <NavBar role="athlete" userName={profile?.full_name} />

      <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-5xl md:text-6xl"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.05em' }}
          >
            Hei, {firstName}
          </h1>
          <p
            className="text-base tracking-wide mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            Her er din treningsoversikt
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Treninger denne uka" value="0" unit="økter" />
          <StatCard label="Distanse denne uka" value="0" unit="km" />
          <StatCard label="Timer trent" value="0" unit="t" />
          <StatCard label="Snitt puls" value="—" unit="bpm" />
        </div>

        {/* Main panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PlaceholderPanel
            title="Treningsdagbok"
            description="Logg og se gjennom alle dine treningsøkter med detaljer, puls og notater."
            comingSoon={['Logg ny økt', 'Oversikt over siste 30 dager', 'Eksport til CSV']}
          />
          <PlaceholderPanel
            title="Treningsplanlegger"
            description="Se treningsplanen din fremover, planlagt av deg selv eller treneren din."
            comingSoon={['Ukentlig oversikt', 'Periodisering', 'Trenerintegrasjon']}
          />
          <PlaceholderPanel
            title="Analyse & Puls"
            description="Dybdeanalyse av treningsdata med pulsgrafer, HRV og belastningsstyring."
            comingSoon={['Pulsgrafer', 'HRV-trending', 'Treningsbelastning']}
          />
          <PlaceholderPanel
            title="Klokkesynk"
            description="Synkroniser data direkte fra Garmin-klokke eller Apple Health."
            comingSoon={['Garmin Connect', 'Apple Health', 'Auto-import']}
          />
          <PlaceholderPanel
            title="AI-Coach"
            description="Intelligente anbefalinger basert på din treningshistorikk og mål."
            comingSoon={['Personlig AI-coach', 'Øktforslag', 'Restitusjonsvurdering']}
          />
          <PlaceholderPanel
            title="Din trener"
            description="Kommuniser med treneren din og motta tilbakemeldinger direkte i appen."
            comingSoon={['Meldinger', 'Treningsfeedback', 'Målsetting']}
          />
        </div>

      </main>

      <footer
        className="px-6 py-4 text-center"
        style={{ borderTop: '1px solid #111113' }}
      >
        <p
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
        >
          X-PULSE Fase 1 — Fundament
        </p>
      </footer>
    </div>
  )
}
