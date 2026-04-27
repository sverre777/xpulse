import { WORKOUT_TYPES_BIATHLON, TYPE_COLORS } from '@/lib/types'
import type { AthleteWorkoutRow, AthleteDayStateRow } from '@/app/actions/coach-athlete'
import { CoachChangeIndicator } from './CoachChangeIndicator'

const ATHLETE_ORANGE = '#FF4500'
const COACH_BLUE = '#1A6FD4'

interface Props {
  workouts: AthleteWorkoutRow[]
  dayStates: AthleteDayStateRow[]
  emptyLabel?: string
  mode: 'dagbok' | 'plan' | 'historikk'
}

function workoutTypeLabel(v: string): string {
  return WORKOUT_TYPES_BIATHLON.find(t => t.value === v)?.label ?? v
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('nb-NO', { weekday: 'short', day: '2-digit', month: 'short' })
}

function formatDuration(min: number | null): string {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}

export function AthleteWorkoutsList({ workouts, dayStates, emptyLabel, mode }: Props) {
  type Row =
    | { kind: 'workout'; date: string; key: string; w: AthleteWorkoutRow }
    | { kind: 'day_state'; date: string; key: string; d: AthleteDayStateRow }
  const rows: Row[] = [
    ...workouts.map(w => ({ kind: 'workout' as const, date: w.date, key: 'w:' + w.id, w })),
    ...dayStates.map(d => ({ kind: 'day_state' as const, date: d.date, key: 'd:' + d.id, d })),
  ].sort((a, b) => (mode === 'plan' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))

  if (rows.length === 0) {
    return (
      <p
        className="text-xs py-6"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}
      >
        {emptyLabel ?? 'Ingen data i perioden.'}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map(r => {
        if (r.kind === 'day_state') {
          const d = r.d
          const color = d.stateType === 'sykdom' ? '#E11D48' : '#D4A017'
          const label = d.stateType === 'sykdom' ? 'Sykdom' : 'Hviledag'
          return (
            <li
              key={r.key}
              className="p-3 flex items-center gap-3"
              style={{
                backgroundColor: '#16161A',
                border: `1px dashed ${color}`,
                opacity: 0.85,
              }}
            >
              <span
                className="text-xs tracking-widest uppercase px-2 py-0.5"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: 'transparent',
                  color,
                  border: `1px solid ${color}`,
                }}
              >
                {label}
              </span>
              <span
                className="text-xs tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
              >
                {formatDate(d.date)}{d.subType ? ` · ${d.subType}` : ''}
              </span>
              {d.notes && (
                <span
                  className="text-xs flex-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
                >
                  {d.notes}
                </span>
              )}
            </li>
          )
        }
        const w = r.w
        const byCoach = w.createdByCoachId !== null
        const isPlannedOnly = w.isPlanned && !w.isCompleted
        return (
          <li
            key={r.key}
            className="p-3"
            style={{
              backgroundColor: '#16161A',
              border: '1px solid #1E1E22',
              borderTop: byCoach ? `3px solid ${COACH_BLUE}` : '1px solid #1E1E22',
              borderStyle: isPlannedOnly ? 'dashed' : 'solid',
              borderColor: isPlannedOnly ? '#D4A017' : (byCoach ? '#1E1E22' : '#1E1E22'),
            }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="text-xs tracking-widest uppercase px-2 py-0.5"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: TYPE_COLORS[w.workoutType] ?? '#4A4A4A',
                  color: '#F0F0F2',
                }}
              >
                {workoutTypeLabel(w.workoutType)}
              </span>
              <span
                className="text-sm"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  color: '#F0F0F2', letterSpacing: '0.03em',
                }}
              >
                {w.title}
              </span>
              {w.isImportant && (
                <span
                  className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}
                >
                  ★ Viktig
                </span>
              )}
              {isPlannedOnly && (
                <span
                  className="text-xs tracking-widest uppercase px-1.5 py-0.5"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    backgroundColor: 'transparent',
                    color: '#D4A017',
                    border: '1px solid #D4A017',
                  }}
                >
                  Planlagt
                </span>
              )}
              {w.isCompleted && w.isPlanned && (
                <span
                  className="text-xs tracking-widest uppercase px-1.5 py-0.5"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    backgroundColor: 'transparent',
                    color: '#28A86E',
                    border: '1px solid #28A86E',
                  }}
                >
                  Gjennomført plan
                </span>
              )}
              {byCoach && (
                <CoachChangeIndicator coachName={w.createdByCoachName} updatedAt={w.updatedAt} />
              )}
              <div className="flex-1" />
              <span
                className="text-xs tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
              >
                {formatDate(w.date)}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
            >
              <span>Varighet: <span style={{ color: '#F0F0F2' }}>{formatDuration(w.durationMinutes)}</span></span>
              {w.distanceKm !== null && (
                <span>Distanse: <span style={{ color: '#F0F0F2' }}>{w.distanceKm} km</span></span>
              )}
              {!byCoach && w.isCompleted && (
                <span style={{ color: ATHLETE_ORANGE }}>Utøver</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
