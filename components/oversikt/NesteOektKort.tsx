import Link from 'next/link'
import type { OversiktNextWorkout, OversiktWorkoutCard } from '@/app/actions/oversikt'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'

function sportLabel(v: string): string {
  return SPORTS.find(s => s.value === v)?.label ?? v
}

function workoutTypeLabel(v: string): string {
  return WORKOUT_TYPES_BASE.find(t => t.value === v)?.label ?? v
}

function fmtDuration(mins: number | null): string {
  if (!mins || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m} min`
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function Label({ text }: { text: string }) {
  return (
    <span className="text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
      {text}
    </span>
  )
}

function CardShell({
  accent, kicker, children, ctaHref, ctaLabel,
}: {
  accent: string
  kicker: string
  children: React.ReactNode
  ctaHref?: string
  ctaLabel?: string
}) {
  return (
    <div className="p-5 h-full" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: accent, display: 'inline-block' }} />
        <Label text={kicker} />
      </div>
      {children}
      {ctaHref && ctaLabel && (
        <div className="mt-4">
          <Link href={ctaHref}
            className="inline-block px-3 py-1 text-xs tracking-widest uppercase hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: accent, color: '#F0F0F2', textDecoration: 'none',
            }}>
            {ctaLabel}
          </Link>
        </div>
      )}
    </div>
  )
}

function WorkoutBody({ w }: { w: OversiktWorkoutCard }) {
  return (
    <>
      <h2 style={{
        fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
        fontSize: '26px', letterSpacing: '0.04em', lineHeight: 1.1,
      }}>
        {w.title}
      </h2>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        <span><span style={{ color: '#8A8A96' }}>Sport: </span>{sportLabel(w.sport)}</span>
        <span><span style={{ color: '#8A8A96' }}>Type: </span>{workoutTypeLabel(w.workout_type)}</span>
        <span><span style={{ color: '#8A8A96' }}>Varighet: </span>{fmtDuration(w.duration_minutes)}</span>
        {w.distance_km !== null && w.distance_km > 0 && (
          <span><span style={{ color: '#8A8A96' }}>Distanse: </span>{w.distance_km.toFixed(1)} km</span>
        )}
        {w.time_of_day && (
          <span><span style={{ color: '#8A8A96' }}>Tid: </span>{w.time_of_day.slice(0, 5)}</span>
        )}
        {w.primary_intensity_zone && (
          <span><span style={{ color: '#8A8A96' }}>Hovedsone: </span>{w.primary_intensity_zone}</span>
        )}
      </div>
    </>
  )
}

export function NesteOektKort({
  next,
}: {
  next: OversiktNextWorkout
}) {
  const today = new Date().toISOString().slice(0, 10)

  if (next.kind === 'none') {
    return (
      <CardShell
        accent="#8A8A96"
        kicker="I dag"
        ctaHref={`/app/plan?new=${today}`}
        ctaLabel="+ Planlegg økt"
      >
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
          fontSize: '26px', letterSpacing: '0.04em',
        }}>
          Ingen planlagt økt
        </h2>
        <p className="mt-1 text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Legg inn en økt eller marker dagen som hviledag.
        </p>
      </CardShell>
    )
  }

  if (next.kind === 'today_completed') {
    return (
      <CardShell
        accent="#28A86E"
        kicker="Gjennomført i dag"
        ctaHref={`/app/dagbok?edit=${next.workout.id}`}
        ctaLabel="Åpne i dagbok"
      >
        <WorkoutBody w={next.workout} />
      </CardShell>
    )
  }

  if (next.kind === 'today_planned') {
    return (
      <CardShell
        accent="#FF4500"
        kicker="Dagens økt"
        ctaHref={`/app/dagbok?edit=${next.workout.id}`}
        ctaLabel="Logg gjennomføring"
      >
        <WorkoutBody w={next.workout} />
      </CardShell>
    )
  }

  // future_planned
  return (
    <CardShell
      accent="#F5C542"
      kicker={`Neste økt · ${fmtDate(next.workout.date)}`}
      ctaHref={`/app/plan?edit=${next.workout.id}`}
      ctaLabel="Se detaljer"
    >
      <WorkoutBody w={next.workout} />
    </CardShell>
  )
}
