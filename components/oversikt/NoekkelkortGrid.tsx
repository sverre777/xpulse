'use client'

import { KompaktHelseKort } from '@/components/helse/KompaktHelseKort'
import { useState } from 'react'
import Link from 'next/link'
import type {
  OversiktWorkoutCard, OversiktMainGoal, OversiktPhase, OversiktPhaseStatus,
} from '@/app/actions/oversikt'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'
import { ZoneBar, ShotChip, Spacer, VisMer, KortFot, fmtHM } from './kort-deler'
import { HardoktPopup } from './kort-popups'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'

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
      <div className="xp-kh">
        <span className="xp-beam" style={{ background: accent }} />
        <h2 className="xp-kh-t">{kicker}</h2>
      </div>
      {children}
    </>
  )
  const cls = 'p-4 h-full xp-keycard'
  const style: React.CSSProperties = {
    backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16,
    textDecoration: 'none', display: 'flex',
  }
  if (href) {
    return <Link href={href} className={cls + ' hover:border-[var(--kant-6)] transition-colors'} style={style}>{body}</Link>
  }
  return <div className={cls} style={style}>{body}</div>
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="xp-key-h3">
      {children}
    </p>
  )
}

function CardMeta({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 xp-key-p" style={{ marginBottom: 0 }}>
      {children}
    </p>
  )
}

function HardWorkoutCard({ w }: { w: OversiktWorkoutCard | null }) {
  const [apen, setApen] = useState(false)
  // Tomtilstand (notat pkt 12): kortet skjules ALDRI — et hull ville flyttet
  // paa alt annet i rutenettet. Overskriften staar, og én linje forklarer.
  if (!w) {
    return (
      <Card kicker="Siste hardøkt" accent="#E11D48">
        <CardTitle>Ingen registrert</CardTitle>
        <CardMeta>Ingen økt i I3 eller høyere er ført enda.</CardMeta>
      </Card>
    )
  }
  const sone = w.primary_intensity_zone
  return (
    <Card kicker="Siste hardøkt" accent="#E11D48">
      <CardTitle>{w.title}</CardTitle>
      <CardMeta>
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          {fmtDate(w.date)} · {sportLabel(w.sport)} · {workoutTypeLabel(w.workout_type)}
          {sone && (
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] ?? 'var(--mut)',
              border: `1px solid ${ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] ?? 'var(--line2)'}`,
              borderRadius: 999, padding: '1px 7px',
            }}>{sone}</span>
          )}
        </span>
      </CardMeta>

      {/* Tid + snittpuls. «—» der noe ikke er foert, aldri 0. */}
      <p className="mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--mut)' }}>
        {w.effective_duration_minutes != null ? fmtHM(w.effective_duration_minutes * 60) : '—'}
        {' · '}
        {w.avg_heart_rate != null ? `${w.avg_heart_rate} bpm snitt` : '— puls ikke ført'}
      </p>

      <ZoneBar zones={w.zones} legend={false} />
      <ShotChip shots={w.shots} />

      <Spacer />
      <KortFot>
        <Link href={`/app/dagbok?edit=${w.id}`}
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#E11D48', textDecoration: 'none',
          }}>
          Se detaljer
        </Link>
        <VisMer onClick={() => setApen(true)} />
      </KortFot>
      {apen && <HardoktPopup w={w} onClose={() => setApen(false)} />}
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
          <div className="flex justify-between text-xs tracking-widest uppercase mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            <span>Volum hittil</span>
            <span style={{ color: 'var(--tekst-1-app)' }}>{progress}%</span>
          </div>
          <div className="h-1.5" style={{ backgroundColor: 'var(--kant-3)' }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: '100%',
              backgroundColor: progress >= 80 ? '#28A86E' : progress >= 50 ? '#D4A017' : '#FF4500',
            }} />
          </div>
          <p className="mt-1 text-xs tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)' }}>
            {goal.actual_hours_to_date!.toFixed(0)}t av {goal.planned_hours_total!.toFixed(0)}t
          </p>
        </div>
      )}
    </Card>
  )
}

function PhaseCard({ phase, phaseStatus }: { phase: OversiktPhase | null; phaseStatus: OversiktPhaseStatus }) {
  if (!phase) {
    const meta =
      phaseStatus === 'no_season'   ? 'Opprett en sesong i Årsplan.'
      : phaseStatus === 'no_periods' ? 'Sesong satt, men ingen perioder. Legg til i Årsplan.'
      : phaseStatus === 'gap'        ? 'Du har perioder, men ingen dekker dagens dato.'
      : 'Definer perioder i årsplanen.'
    return (
      <Card kicker="Periode" accent="#1A6FD4" href="/app/periodisering">
        <CardTitle>Ingen aktiv fase</CardTitle>
        <CardMeta>{meta}</CardMeta>
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
      <div className="mt-3 inline-block px-2 py-0.5 text-xs tracking-widest uppercase"
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

// HealthCard/HelseTall/HealthCardActions/HelsePopup ble AVLØST av
// KompaktHelseKort (helse-designet, bolk 2) og er slettet (regel 21).

export function NoekkelkortGrid({
  lastHardWorkout, mainGoal, phase, phaseStatus,
}: {
  lastHardWorkout: OversiktWorkoutCard | null
  mainGoal: OversiktMainGoal | null
  phase: OversiktPhase | null
  phaseStatus: OversiktPhaseStatus
}) {
  return (
    <section className="mb-6 grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      <HardWorkoutCard w={lastHardWorkout} />
      <MainGoalCard goal={mainGoal} />
      <PhaseCard phase={phase} phaseStatus={phaseStatus} />
      {/* Helse: det kompakte kortet fra helseflaten — klikk åpner hele
          oversikten som pop-up (visning C → A i designet). */}
      <KompaktHelseKort tomTekst="Logg hvilepuls, HRV og søvn — eller koble klokka — for å følge formen her." />
    </section>
  )
}
