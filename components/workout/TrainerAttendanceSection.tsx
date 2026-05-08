'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  toggleAttendanceForWorkout,
  isTrainerAttendingWorkout,
  getAttendingTrainersForWorkout,
} from '@/app/actions/trainer-calendar'

const COACH_BLUE = '#1A6FD4'

interface Props {
  workoutId: string
  // 'coach' = trener-drilldown viser Delta/Deltar-toggle
  // 'athlete' = utøvers egen visning, viser "Trener X skal delta"-badge
  viewerRole: 'coach' | 'athlete'
}

export function TrainerAttendanceSection({ workoutId, viewerRole }: Props) {
  if (viewerRole === 'coach') {
    return <CoachToggle workoutId={workoutId} />
  }
  return <AthleteBadge workoutId={workoutId} />
}

function CoachToggle({ workoutId }: { workoutId: string }) {
  const [attending, setAttending] = useState<boolean | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    isTrainerAttendingWorkout(workoutId).then(v => {
      if (!cancelled) setAttending(v)
    }).catch(() => {
      if (!cancelled) setAttending(false)
    })
    return () => { cancelled = true }
  }, [workoutId])

  const handleToggle = () => {
    setError(null)
    startTransition(async () => {
      const res = await toggleAttendanceForWorkout(workoutId)
      if (res.error) {
        setError(res.error)
        return
      }
      setAttending(res.attending ?? false)
    })
  }

  if (attending === null) {
    return (
      <div className="px-4 py-3"
        style={{ borderTop: '1px solid #1E1E22' }}>
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Sjekker deltakelse…
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3"
      style={{ borderTop: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Skal delta
          </p>
          <p className="text-xs mt-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {attending
              ? 'Økten ligger i din trener-kalender. Utøveren ser badge på sin plan.'
              : 'Mark deltakelse for å legge økten i din trener-kalender.'}
          </p>
        </div>
        <button type="button" onClick={handleToggle} disabled={pending}
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: attending ? '#F0F0F2' : COACH_BLUE,
            background: attending ? COACH_BLUE : 'transparent',
            border: `1px solid ${COACH_BLUE}`,
            padding: '8px 16px',
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.7 : 1,
          }}>
          {pending ? '…' : attending ? '✓ Deltar' : 'Delta'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function AthleteBadge({ workoutId }: { workoutId: string }) {
  const [trainers, setTrainers] = useState<{ trainerName: string | null }[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getAttendingTrainersForWorkout(workoutId).then(rows => {
      if (!cancelled) setTrainers(rows)
    }).catch(() => {
      if (!cancelled) setTrainers([])
    })
    return () => { cancelled = true }
  }, [workoutId])

  if (!trainers || trainers.length === 0) return null

  const names = trainers
    .map(t => t.trainerName)
    .filter((n): n is string => !!n)
  const label = names.length === 0
    ? 'Treneren skal delta'
    : names.length === 1
      ? `Trener ${names[0]} skal delta`
      : `Trenere ${names.join(', ')} skal delta`

  return (
    <div className="px-4 py-3"
      style={{ borderTop: '1px solid #1E1E22' }}>
      <span className="inline-flex items-center gap-2 px-3 py-1"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: COACH_BLUE,
          background: 'rgba(26,111,212,0.12)',
          border: `1px solid ${COACH_BLUE}`,
          fontSize: '12px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
        👥 {label}
      </span>
    </div>
  )
}
