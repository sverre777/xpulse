import { getOversiktDashboard } from '@/app/actions/oversikt'
import { OversiktHero } from '@/components/oversikt/OversiktHero'
import { NesteOektKort } from '@/components/oversikt/NesteOektKort'
import { UkensTotaler } from '@/components/oversikt/UkensTotaler'
import { KonkurranseNedtelling } from '@/components/oversikt/KonkurranseNedtelling'
import { NoekkelkortGrid } from '@/components/oversikt/NoekkelkortGrid'
import { AktivitetsFeed } from '@/components/oversikt/AktivitetsFeed'
import { CustomBreakdownChart } from '@/components/analysis/CustomBreakdownChart'
import type { DateRange } from '@/components/analysis/date-range'

function rangeLast12Weeks(): DateRange {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 7 * 12 + 1)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: fmt(from), to: fmt(today), preset: 'custom' }
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 mb-6"
      style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        Kunne ikke laste oversikt
      </p>
      <pre className="whitespace-pre-wrap break-words"
        style={{ fontFamily: 'ui-monospace, monospace', color: '#F0F0F2', fontSize: '13px' }}>
        {message}
      </pre>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
      <span className="text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </span>
    </div>
  )
}

function AiCoachTeaser() {
  return (
    <section className="p-5 mb-6"
      style={{
        backgroundColor: '#0F121A',
        border: '1px solid #1E1E22',
        backgroundImage: 'linear-gradient(135deg, rgba(26,111,212,0.08), transparent 60%)',
      }}>
      <SectionHeader label="AI Coach" />
      <p style={{
        fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
        fontSize: '22px', letterSpacing: '0.04em', lineHeight: 1.1,
      }}>
        Dagens anbefaling kommer her
      </p>
      <p className="mt-2 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {/* TODO: kobles mot ai-coach når endpoint er klart. */}
        AI Coach henter kontekst fra plan, siste økter og helse og foreslår dagens retning.
        Integrasjon er ikke aktiv enda.
      </p>
    </section>
  )
}

function WeekFocusBox({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="p-5 mb-6" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <SectionHeader label="Fokus denne uken" />
      <ul className="list-disc pl-5 text-sm"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        {items.map((p, i) => <li key={i}>{p}</li>)}
      </ul>
    </section>
  )
}

export default async function OversiktPage() {
  const res = await getOversiktDashboard()

  if ('error' in res) {
    return (
      <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
          <ErrorBox message={res.error} />
        </div>
      </div>
    )
  }

  const range = rangeLast12Weeks()

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">

        <OversiktHero hero={res.hero} todayState={res.todayState} />

        <NesteOektKort next={res.nextWorkout} focusPoints={res.focusPoints} />

        {res.competition && <KonkurranseNedtelling comp={res.competition} />}

        <UkensTotaler
          totals={res.weekTotals}
          reflection={res.weeklyReflection}
          weekNumber={res.hero.weekNumber}
        />

        <WeekFocusBox items={res.focusPoints.week} />

        <NoekkelkortGrid
          lastHardWorkout={res.lastHardWorkout}
          mainGoal={res.mainGoal}
          phase={res.phase}
          health={res.health}
        />

        <section className="p-5 mb-6" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
          <SectionHeader label="Volum siste 12 uker" />
          <CustomBreakdownChart analysisRange={range} />
        </section>

        <AktivitetsFeed feed={res.feed} />

        <AiCoachTeaser />

      </div>
    </div>
  )
}
