import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LoadError } from '@/components/ui/LoadError'
import { getOversiktDashboard } from '@/app/actions/oversikt'
import { getAthleteCoachOverview } from '@/app/actions/coach-overview'
import { OversiktHero } from '@/components/oversikt/OversiktHero'
import { NesteOektKort } from '@/components/oversikt/NesteOektKort'
import { UkensTotaler } from '@/components/oversikt/UkensTotaler'
import { KonkurranseNedtelling } from '@/components/oversikt/KonkurranseNedtelling'
import { NoekkelkortGrid } from '@/components/oversikt/NoekkelkortGrid'
import { AktivitetsFeed } from '@/components/oversikt/AktivitetsFeed'
import { TrenerKort } from '@/components/oversikt/TrenerKort'
import { KlokkesyncMiniKort } from '@/components/oversikt/KlokkesyncMiniKort'
import { getKlokkesyncBadge } from '@/app/actions/klokkesync-status'
import { CustomBreakdownChart } from '@/components/analysis/CustomBreakdownChart'
import { FeedbackCard } from '@/components/feedback/FeedbackCard'
import type { DateRange } from '@/components/analysis/date-range'

function rangeLast12Weeks(): DateRange {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 7 * 12 + 1)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: fmt(from), to: fmt(today), preset: 'custom' }
}


function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        {label}
      </span>
    </div>
  )
}

function AiCoachTeaser() {
  return (
    <section className="p-5 mb-6"
      style={{
        backgroundColor: 'var(--tonet-bla-1)',
        border: '1px solid var(--kant-3)',
        backgroundImage: 'linear-gradient(135deg, rgba(26,111,212,0.08), transparent 60%)',
      }}>
      <SectionHeader label="AI Coach" />
      <p style={{
        fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)',
        fontSize: '22px', letterSpacing: '0.04em', lineHeight: 1.1,
      }}>
        Dagens anbefaling kommer her
      </p>
      <p className="mt-2 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        {/* TODO: kobles mot ai-coach når endpoint er klart. */}
        AI Coach henter kontekst fra plan, siste økter og helse og foreslår dagens retning.
        Integrasjon er ikke aktiv enda.
      </p>
    </section>
  )
}

export default async function OversiktPage() {
  const [res, coachOverviewRaw, klokkesyncBadge] = await Promise.all([
    getOversiktDashboard(),
    getAthleteCoachOverview(),
    getKlokkesyncBadge(),
  ])

  if ('error' in res) {
    // Død/utløpt sesjon: send til innlogging i stedet for feilboks.
    if (res.error === 'Ikke innlogget') redirect('/app')
    return (
      <div style={{ backgroundColor: 'var(--flate-3)', minHeight: '100vh' }}>
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
          <LoadError what="oversikten" detail={res.error} />
        </div>
      </div>
    )
  }

  const range = rangeLast12Weeks()
  const coachOverview = 'error' in coachOverviewRaw
    ? { hasCoach: false as const, coach: null, lastActivity: null }
    : coachOverviewRaw

  return (
    <div style={{ backgroundColor: 'var(--flate-3)', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">

        <OversiktHero hero={res.hero} todayState={res.todayState} />

        {/* Tre-kort-rad øverst: Neste økt · Ukens totaler · Neste konkurranse.
            Stables på <lg. Konkurranse-kortet faller ut hvis ingen er planlagt. */}
        <div className="grid gap-4 lg:grid-cols-3 mb-6">
          <NesteOektKort next={res.nextWorkout} />
          <UkensTotaler totals={res.weekTotals} weekNumber={res.hero.weekNumber} />
          {res.competition && <KonkurranseNedtelling comp={res.competition} />}
        </div>

        <NoekkelkortGrid
          lastHardWorkout={res.lastHardWorkout}
          mainGoal={res.mainGoal}
          phase={res.phase}
          phaseStatus={res.phaseStatus}
        />

        {/* Trener-kort + klokkesync side om side. Om utøver ikke har trener
            vises trener-kortet som koble-knapp (ingen full bredde-fallback —
            grid-klassen gir naturlig 50/50 i begge tilfellene).
            «Helse over tid» laa her tidligere; helse dekkes av helse-kortet
            i noekkelkort-raden over. */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <TrenerKort overview={coachOverview} />
          {/* Kort liten klokkesync-boks: koble / synk nå + sist synket. */}
          <KlokkesyncMiniKort badge={klokkesyncBadge} />
        </div>

        <section className="p-5 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }}>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <SectionHeader label="Volum siste 12 uker" />
            <Link href="/app/analyse"
              className="text-xs tracking-widest uppercase px-3 py-2 transition-colors hover:bg-[rgba(255,69,0,0.1)]"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#FF4500',
                border: '1px solid #FF4500',
                textDecoration: 'none',
              }}>
              Se full analyse →
            </Link>
          </div>
          <CustomBreakdownChart analysisRange={range} />
        </section>

        <AktivitetsFeed feed={res.feed} />

        <AiCoachTeaser />

        <FeedbackCard accent="#FF4500" />

      </div>
    </div>
  )
}
