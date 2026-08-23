'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HelseLoggKnapp } from './HelseLoggKnapp'
import type {
  OversiktWorkoutCard, OversiktMainGoal, OversiktPhase, OversiktPhaseStatus, OversiktHealthSummary,
} from '@/app/actions/oversikt'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'
import { ZoneBar, ShotLine, Spacer, VisMer, KortFot, fmtHM } from './kort-deler'
import { HardoktPopup, HelsePopup } from './kort-popups'
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
    return <Link href={href} className={cls + ' hover:border-[#2A2A30] transition-colors'} style={style}>{body}</Link>
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
              color: ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] ?? '#8B8B95',
              border: `1px solid ${ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] ?? '#2A2A33'}`,
              borderRadius: 999, padding: '1px 7px',
            }}>{sone}</span>
          )}
        </span>
      </CardMeta>

      {/* Tid + snittpuls. «—» der noe ikke er foert, aldri 0. */}
      <p className="mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: '#8B8B95' }}>
        {w.effective_duration_minutes != null ? fmtHM(w.effective_duration_minutes * 60) : '—'}
        {' · '}
        {w.avg_heart_rate != null ? `${w.avg_heart_rate} bpm snitt` : '— puls ikke ført'}
      </p>

      <ZoneBar zones={w.zones} legend={false} />
      <ShotLine shots={w.shots} />

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
          <p className="mt-1 text-xs tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}>
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

// Liten grønn logg-knapp + dim analyse-lenke — brukes i begge helse-tilstander.
function HealthCardActions({ today, onVisMer }: { today: string; onVisMer?: () => void }) {
  const linkBase: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11,
    letterSpacing: '0.13em', textTransform: 'uppercase', textDecoration: 'none',
    borderRadius: 9, padding: '7px 12px', display: 'inline-block',
  }
  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      <HelseLoggKnapp date={today}
        style={{ ...linkBase, backgroundColor: '#28A86E', color: '#fff', border: '1px solid #28A86E' }} />
      <Link href="/app/analyse?tab=helse"
        style={{ ...linkBase, color: '#8A8A96', border: '1px solid var(--line2)' }}>
        Analyse →
      </Link>
      {onVisMer && <VisMer onClick={onVisMer} />}
    </div>
  )
}

function todayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Ett helsetall maalt mot brukerens EGET 30-dagers snitt (notat pkt 8).
 * «42 bpm» sier ingenting alene — «1 under ditt eget snitt» sier alt.
 *
 * Retningen staar i ORD, ikke bare fortegn: HRV over snittet er bra,
 * hvilepuls over snittet er det ikke, og «+5» uten kontekst leses feil
 * begge veier. Fargene er varsomme: groent naar det peker riktig vei, gult
 * naar det er verdt et blikk, ALDRI roedt. Dette er veiledningstall.
 */
function HelseTall({ label, verdi, enhet, snitt, hoyereErBra, farge }: {
  label: string
  verdi: number | null
  enhet: string
  snitt: number | null
  hoyereErBra: boolean
  farge: string
}) {
  const diff = verdi != null && snitt != null ? Math.round((verdi - snitt) * 10) / 10 : null
  let retning: string | null = null
  let retningsfarge = '#8B8B95'
  if (diff != null && Math.abs(diff) >= 0.1) {
    const over = diff > 0
    retning = `${Math.abs(diff)} ${over ? 'over' : 'under'} snitt`
    const bra = over === hoyereErBra
    retningsfarge = bra ? '#28A86E' : '#E8B93C'
  } else if (diff != null) {
    retning = 'som snitt'
  }
  return (
    <div className="flex flex-col" style={{ minWidth: 0 }}>
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif", color: verdi != null ? farge : '#55555F',
        fontSize: '22px', letterSpacing: '0.04em', lineHeight: 1.1,
      }}>
        {/* «—» naar ikke foert i dag — 30-dagers snittet blir staaende. */}
        {verdi != null ? `${verdi}` : '—'}
        {verdi != null && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8B8B95', marginLeft: 3 }}>{enhet}</span>}
      </span>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10.5, color: retningsfarge, marginTop: 2 }}>
        {retning ?? (snitt != null ? `snitt ${snitt}${enhet ? ' ' + enhet : ''}` : '—')}
      </span>
    </div>
  )
}

function HealthCard({ h }: { h: OversiktHealthSummary }) {
  const [apen, setApen] = useState(false)
  const hasAny = h.last_entry_date !== null
  const today = todayLocalISO()
  if (!hasAny) {
    return (
      <Card kicker="Helse" accent="#28A86E">
        <CardTitle>Ingen data</CardTitle>
        <CardMeta>Logg hvilepuls, HRV og søvn for å følge form.</CardMeta>
        <HealthCardActions today={today} />
      </Card>
    )
  }
  return (
    <Card kicker="Helse" accent="#28A86E">
      {/* Fargene er de samme som «Helse over tid» brukte: hvilepuls roed,
          HRV lilla, soevn blaa (notat pkt 10). */}
      <div className="grid grid-cols-3 gap-3">
        <HelseTall label="Hvilepuls" verdi={h.resting_hr} enhet="bpm"
          snitt={h.avg_resting_hr_30d} hoyereErBra={false} farge="#E23A5A" />
        <HelseTall label="HRV" verdi={h.hrv_ms} enhet="ms"
          snitt={h.avg_hrv_30d} hoyereErBra={true} farge="#8B5CF6" />
        <HelseTall label="Søvn" verdi={h.sleep_hours} enhet="t"
          snitt={h.avg_sleep_30d} hoyereErBra={true} farge="#1A6FD4" />
      </div>
      <CardMeta>Sist ført: {fmtDate(h.last_entry_date!)}</CardMeta>
      <Spacer />
      <HealthCardActions today={today} onVisMer={() => setApen(true)} />
      {apen && <HelsePopup h={h} onClose={() => setApen(false)} />}
    </Card>
  )
}

export function NoekkelkortGrid({
  lastHardWorkout, mainGoal, phase, phaseStatus, health,
}: {
  lastHardWorkout: OversiktWorkoutCard | null
  mainGoal: OversiktMainGoal | null
  phase: OversiktPhase | null
  phaseStatus: OversiktPhaseStatus
  health: OversiktHealthSummary
}) {
  return (
    <section className="mb-6 grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      <HardWorkoutCard w={lastHardWorkout} />
      <MainGoalCard goal={mainGoal} />
      <PhaseCard phase={phase} phaseStatus={phaseStatus} />
      <HealthCard h={health} />
    </section>
  )
}
