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
  accent, kicker, tittel, children, ctaHref, ctaLabel,
}: {
  accent: string
  kicker: string
  /**
   * Overskrift. Sto tidligere hardkodet til «I dag» mens pillen kunne si
   * «Neste økt · tor. 27. aug» — kortet ropte «I DAG» over en økt fire
   * dager fram (notat pkt 4). Nå følger den datoen.
   */
  tittel: string
  children: React.ReactNode
  ctaHref?: string
  ctaLabel?: string
}) {
  return (
    <div className="p-5 h-full" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }}>
      <div className="xp-kh">
        <span className="xp-beam" style={{ background: accent }} />
        <h2 className="xp-kh-t">{tittel}</h2>
      </div>
      <span className="xp-status-badge" style={{ color: accent, backgroundColor: `${accent}1f`, borderColor: `${accent}59` }}>
        <span className="xp-pulse-dot" />
        {kicker}
      </span>
      {children}
      {ctaHref && ctaLabel && (
        <div className="mt-4">
          <Link href={ctaHref} className="xp-hbtn"
            style={{ backgroundColor: accent, color: '#fff' }}>
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
        fontSize: '34px', letterSpacing: '0.03em', lineHeight: 1.05,
      }}>
        {w.title}
      </h2>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        <span><span style={{ color: '#8A8A96' }}>Sport: </span>{sportLabel(w.sport)}</span>
        <span><span style={{ color: '#8A8A96' }}>Type: </span>{workoutTypeLabel(w.workout_type)}</span>
        {/* effective_duration_minutes faller tilbake paa summen av
            aktivitetsradene: planlagte oekter har sjelden duration_minutes
            paa selve okta, og det var aarsaken til «Varighet: —». */}
        <span><span style={{ color: '#8A8A96' }}>Varighet: </span>{fmtDuration(w.effective_duration_minutes)}</span>
        {w.shots && w.shots.shots > 0 && (
          <span><span style={{ color: '#8A8A96' }}>Skudd: </span>{w.shots.shots}</span>
        )}
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

  // Dager fram til økta. Regnes på rene datoer (ikke tidspunkt), så en økt
  // i kveld og en økt i morgen tidlig ikke havner i samme bøtte.
  const dagerTil = (dato: string): number => {
    const a = new Date(today + 'T00:00:00').getTime()
    const b = new Date(dato + 'T00:00:00').getTime()
    return Math.round((b - a) / 86400000)
  }
  const naarTekst = (dato: string): string => {
    const n = dagerTil(dato)
    if (n <= 0) return 'I dag'
    if (n === 1) return 'I morgen'
    return `Om ${n} dager`
  }

  if (next.kind === 'none') {
    return (
      <CardShell
        accent="#8A8A96"
        tittel="I dag"
        kicker="Ingenting planlagt"
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
        tittel="I dag"
        kicker="Gjennomført"
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
        tittel="I dag"
        kicker={next.workout.time_of_day ? `Kl. ${next.workout.time_of_day.slice(0, 5)}` : 'Dagens økt'}
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
      tittel="Neste økt"
      kicker={`${naarTekst(next.workout.date)} · ${fmtDate(next.workout.date)}`}
      ctaHref={`/app/plan?edit=${next.workout.id}`}
      ctaLabel="Se detaljer"
    >
      <WorkoutBody w={next.workout} />
    </CardShell>
  )
}
