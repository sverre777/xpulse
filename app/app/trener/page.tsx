import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/dashboard/NavBar'
import { StatCard } from '@/components/dashboard/StatCard'
import { PlaceholderPanel } from '@/components/dashboard/PlaceholderPanel'

const COACH_BLUE = '#1A6FD4'

export default async function CoachDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/app')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Rolle-guard: kun brukere i trener-modus får se trenerpanelet.
  const activeRole = profile?.active_role ?? profile?.role
  if (activeRole !== 'coach') {
    redirect('/app/dagbok')
  }
  if (!(profile?.has_coach_role ?? profile?.role === 'coach')) {
    redirect('/app/dagbok')
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Trener'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
      <NavBar
        role="coach"
        userName={profile?.full_name}
        hasAthleteRole={profile?.has_athlete_role ?? false}
        hasCoachRole={profile?.has_coach_role ?? true}
      />

      <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">

        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-5xl md:text-6xl"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.05em' }}
          >
            Trenerpanel
          </h1>
          <p
            className="text-base tracking-wide mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            Hei, {firstName} — oversikt over utøverne dine
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Aktive utøvere" value="0" unit="stk" accentColor={COACH_BLUE} />
          <StatCard label="Treninger i uka" value="0" unit="totalt" accentColor={COACH_BLUE} />
          <StatCard label="Ventende forespørsler" value="0" accentColor={COACH_BLUE} />
          <StatCard label="Planer aktive" value="0" unit="stk" accentColor={COACH_BLUE} />
        </div>

        {/* Main panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PlaceholderPanel
            title="Mine utøvere"
            description="Se og administrer alle utøverne du er tilknyttet."
            comingSoon={['Utøverliste', 'Legg til utøver', 'Aktiver / deaktiver relasjon']}
            accentColor={COACH_BLUE}
          />
          <PlaceholderPanel
            title="Treningsplanlegger"
            description="Lag og tildel treningsplaner direkte til dine utøvere."
            comingSoon={['Opprett plan', 'Tildel til utøver', 'Periodisering']}
            accentColor={COACH_BLUE}
          />
          <PlaceholderPanel
            title="Aktivitetsoversikt"
            description="Se alle utøvernes treningsaktivitet samlet i ett panel."
            comingSoon={['Ukentlig oversikt', 'Sammenligningsvisning', 'Avviksvarslinger']}
            accentColor={COACH_BLUE}
          />
          <PlaceholderPanel
            title="Analyse & Puls"
            description="Dybdeanalyse av enkeltutøveres pulsdata, HRV og belastning."
            comingSoon={['Pulsgrafer per utøver', 'HRV-trending', 'Sammenlikning']}
            accentColor={COACH_BLUE}
          />
          <PlaceholderPanel
            title="Meldinger"
            description="Send tilbakemeldinger og kommuniser med utøverne dine direkte."
            comingSoon={['Direkte meldinger', 'Gruppemeldinger', 'Treningsfeedback']}
            accentColor={COACH_BLUE}
          />
          <PlaceholderPanel
            title="Rapporter"
            description="Generer perioderapporter og eksporter treningsdata."
            comingSoon={['Ukesrapport', 'Sesongrapport', 'PDF-eksport']}
            accentColor={COACH_BLUE}
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
