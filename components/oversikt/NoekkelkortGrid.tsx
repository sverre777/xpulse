import Link from 'next/link'
import type {
  OversiktWorkoutCard, OversiktMainGoal, OversiktPhase, OversiktHealthSummary,
} from '@/app/actions/oversikt'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'

function sportLabel(v: string): string {
  return SPORTS.find(s => s.value === v)?.label ?? v
}
function workoutTypeLabel(v: string): string {
  return WORKOUT_TYPES_BASE.find(t => t.value === v)?.label ?? v
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

function Card({
  kicker, accent, href, children,
}: {
  kicker: string
  accent: string
  href?: string
  children: React.ReactNode
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ width: '14px', height: '2px', backgroundColor: accent, display: 'inline-block' }} />
        <span className="text-[10px] tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {kicker}
        </span>
      </div>
      {children}
    </>
  )
  const cls = 'p-4 h-full'
  const style: React.CSSProperties = {
    backgroundColor: '#111113', border: '1px solid #1E1E22',
    textDecoration: 'none', display: 'block',
  }
  if (href) {
    return <Link href={href} className={cls + ' hover:border-[#2A2A30] transition-colors'} style={style}>{body}</Link>
  }
  return <div className={cls} style={style}>{body}</div>
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
      fontSize: '22px', letterSpacing: '0.04em', lineHeight: 1.1,
    }}>
      {children}
    </p>
  )
}

function CardMeta({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-xs"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
      {children}
    </p>
  )
}

function HardWorkoutCard({ w }: { w: OversiktWorkoutCard | null }) {
  if (!w) {
    return (
      <Card kicker="Siste hardøkt" accent="#E11D48">
        <CardTitle>Ingen registrert</CardTitle>
        <CardMeta>Logg en økt med intensitet I3+ eller en konkurranse.</CardMeta>
      </Card>
    )
  }
  return (
    <Card kicker="Siste hardøkt" accent="#E11D48" href={`/app/dagbok?edit=${w.id}`}>
      <CardTitle>{w.title}</CardTitle>
      <CardMeta>
        {fmtDate(w.date)} · {sportLabel(w.sport)} · {workoutTypeLabel(w.workout_type)}
        {w.primary_intensity_zone ? ` · ${w.primary_intensity_zone}` : ''}
      </CardMeta>
    </Card>
  )
}

function MainGoalCard({ goal }: { goal: OversiktMainGoal | null }) {
  if (!goal) {
    return (
      <Card kicker="Hovedmål" accent="#FF4500" href="/app/periodisering">
        <CardTitle>Ingen aktiv sesong</CardTitle>
        <CardMeta>Opprett en sesong og sett hovedmål i periodisering.</CardMeta>
      </Card>
    )
  }

  const progress = (goal.planned_hours_total && goal.actual_hours_to_date !== null)
    ? Math.round((goal.actual_hours_to_date / goal.planned_hours_total) * 100)
    : null

  return (
    <Card kicker="Hovedmål" accent="#FF4500" href="/app/periodisering">
      <CardTitle>{goal.goal_main}</CardTitle>
      <CardMeta>
        {goal.season_name} · {goal.days_until_end} dager til sesongslutt
      </CardMeta>
      {progress !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            <span>Volum hittil</span>
            <span style={{ color: '#F0F0F2' }}>{progress}%</span>
          </div>
          <div className="h-1.5" style={{ backgroundColor: '#1E1E22' }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: '100%',
              backgroundColor: progress >= 80 ? '#28A86E' : progress >= 50 ? '#D4A017' : '#FF4500',
            }} />
          </div>
          <p className="mt-1 text-[10px] tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}>
            {goal.actual_hours_to_date!.toFixed(0)}t av {goal.planned_hours_total!.toFixed(0)}t
          </p>
        </div>
      )}
    </Card>
  )
}

function PhaseCard({ phase }: { phase: OversiktPhase | null }) {
  if (!phase) {
    return (
      <Card kicker="Periode" accent="#1A6FD4" href="/app/periodisering">
        <CardTitle>Ingen aktiv fase</CardTitle>
        <CardMeta>Definer perioder i årsplanen.</CardMeta>
      </Card>
    )
  }
  const intensityLabel: Record<OversiktPhase['intensity'], string> = {
    rolig: 'Rolig', medium: 'Medium', hard: 'Hard',
  }
  const intensityColor: Record<OversiktPhase['intensity'], string> = {
    rolig: '#28A86E', medium: '#D4A017', hard: '#E11D48',
  }
  return (
    <Card kicker="Periode" accent="#1A6FD4" href="/app/periodisering">
      <CardTitle>{phase.name}</CardTitle>
      <CardMeta>
        Uke {phase.week_in_phase}/{phase.phase_weeks_total} · {fmtDate(phase.start_date)}–{fmtDate(phase.end_date)}
      </CardMeta>
      <div className="mt-3 inline-block px-2 py-0.5 text-[10px] tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: intensityColor[phase.intensity],
          border: `1px solid ${intensityColor[phase.intensity]}`,
        }}>
        {intensityLabel[phase.intensity]}
      </div>
    </Card>
  )
}

function HealthCard({ h }: { h: OversiktHealthSummary }) {
  const hasAny = h.last_entry_date !== null
  if (!hasAny) {
    return (
      <Card kicker="Helse" accent="#28A86E" href="/app/health">
        <CardTitle>Ingen data</CardTitle>
        <CardMeta>Logg hvilepuls, HRV og søvn for å følge form.</CardMeta>
      </Card>
    )
  }
  const pairs: { label: string; value: string }[] = []
  if (h.resting_hr !== null) pairs.push({ label: 'Hvilepuls', value: `${h.resting_hr}` })
  if (h.hrv_ms !== null) pairs.push({ label: 'HRV', value: `${h.hrv_ms} ms` })
  if (h.sleep_hours !== null) pairs.push({ label: 'Søvn', value: `${h.sleep_hours.toFixed(1)} t` })

  return (
    <Card kicker="Helse" accent="#28A86E" href="/app/health">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {pairs.map(p => (
          <div key={p.label} className="flex flex-col">
            <span className="text-[10px] tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              {p.label}
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
              fontSize: '20px', letterSpacing: '0.04em', lineHeight: 1.1,
            }}>
              {p.value}
            </span>
          </div>
        ))}
      </div>
      <CardMeta>
        Sist: {fmtDate(h.last_entry_date!)}
        {h.avg_resting_hr_7d !== null ? ` · 7d snitt HR ${h.avg_resting_hr_7d}` : ''}
      </CardMeta>
    </Card>
  )
}

export function NoekkelkortGrid({
  lastHardWorkout, mainGoal, phase, health,
}: {
  lastHardWorkout: OversiktWorkoutCard | null
  mainGoal: OversiktMainGoal | null
  phase: OversiktPhase | null
  health: OversiktHealthSummary
}) {
  return (
    <section className="mb-6 grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      <HardWorkoutCard w={lastHardWorkout} />
      <MainGoalCard goal={mainGoal} />
      <PhaseCard phase={phase} />
      <HealthCard h={health} />
    </section>
  )
}
