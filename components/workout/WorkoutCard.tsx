import Link from 'next/link'
import { Workout, SPORTS, WORKOUT_TYPES_BIATHLON as WORKOUT_TYPES } from '@/lib/types'

interface WorkoutCardProps {
  workout: Workout
  compact?: boolean
}

const TYPE_COLORS: Record<string, string> = {
  endurance:   '#2A5A8A',
  strength:    '#5A2A8A',
  technical:   '#2A7A4A',
  competition: '#8A2A2A',
  recovery:    '#3A3A6A',
}

export function WorkoutCard({ workout, compact = false }: WorkoutCardProps) {
  const sportLabel = SPORTS.find(s => s.value === workout.sport)?.label ?? workout.sport
  const typeLabel  = WORKOUT_TYPES.find(t => t.value === workout.workout_type)?.label ?? ''
  const typeColor  = TYPE_COLORS[workout.workout_type] ?? '#333'
  const totalMin   = workout.duration_minutes ?? 0
  const hours      = Math.floor(totalMin / 60)
  const mins       = totalMin % 60
  const durationStr = totalMin > 0 ? (hours > 0 ? `${hours}t ${mins > 0 ? mins + 'min' : ''}` : `${mins}min`) : null

  const borderColor = workout.is_planned && !workout.is_completed ? '#444' : '#1E1E22'
  const borderStyle = workout.is_planned && !workout.is_completed ? 'dashed' : 'solid'

  return (
    <Link
      href={`/athlete/log/${workout.id}`}
      className="block group transition-colors"
      style={{ textDecoration: 'none' }}
    >
      <div
        className="p-3 transition-colors"
        style={{
          backgroundColor: '#16161A',
          border: `1px ${borderStyle} ${borderColor}`,
          borderLeft: `3px solid ${workout.is_important ? '#FF4500' : typeColor}`,
        }}
      >
        {/* Type badge + time */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs px-1.5 py-0.5 tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: typeColor, color: '#F0F0F2', fontSize: '11px' }}>
            {typeLabel}
          </span>
          <div className="flex items-center gap-2">
            {workout.is_important && <span style={{ color: '#FF4500', fontSize: '12px' }}>★</span>}
            {workout.is_planned && !workout.is_completed && (
              <span className="text-xs tracking-widest uppercase" style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px' }}>
                Planlagt
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold leading-tight mt-1.5"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: compact ? '13px' : '14px' }}>
          {workout.title}
        </h4>

        {/* Stats row */}
        {!compact && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs tracking-wide" style={{ color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif" }}>
              {sportLabel}
            </span>
            {durationStr && (
              <span className="text-xs font-semibold" style={{ color: '#FF4500', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {durationStr}
              </span>
            )}
            {workout.distance_km && (
              <span className="text-xs" style={{ color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {workout.distance_km.toFixed(1)} km
              </span>
            )}
            {workout.rpe && (
              <span className="text-xs" style={{ color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif" }}>
                RPE {workout.rpe}
              </span>
            )}
          </div>
        )}

        {/* Movements mini */}
        {!compact && workout.workout_movements && workout.workout_movements.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {workout.workout_movements.map((m) => (
              <span key={m.id} className="text-xs px-1.5 py-0.5"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: '#111115', color: '#8A8A96',
                  border: '1px solid #1E1E22', fontSize: '11px',
                }}>
                {m.movement_name}{m.minutes ? ` ${m.minutes}min` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Coach comment indicator */}
        {workout.coach_comment && (
          <div className="mt-2 flex items-center gap-1">
            <span style={{ color: '#1A6FD4', fontSize: '10px' }}>▌</span>
            <span className="text-xs" style={{ color: '#1A6FD4', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px' }}>
              Trenerkommentar
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
