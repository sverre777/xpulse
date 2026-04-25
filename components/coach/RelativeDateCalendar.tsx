'use client'

import type { PlanTemplateWorkout, PlanTemplateDayState } from '@/lib/template-types'
import { addDays, formatNorskKortDato } from '@/lib/template-dates'

const COACH_BLUE = '#1A6FD4'

interface Props {
  durationDays: number
  workouts: PlanTemplateWorkout[]
  dayStates: PlanTemplateDayState[]
  // Hvis satt, viser cellene konkrete kalenderdatoer i tillegg til "Dag N".
  // Ukene merkes også med dato-spennet i stedet for kun "Uke 1".
  startDate?: string | null
  onDayClick: (dayOffset: number) => void
}

// Relativ kalender for plan-mal-bygging. Viser dag-celler merket som
// "Dag N / Uke W, Dag D" — ingen faktiske datoer. Klikk på en celle
// åpner dagens editor i parent.
export function RelativeDateCalendar({ durationDays, workouts, dayStates, startDate, onDayClick }: Props) {
  const workoutsByDay = new Map<number, PlanTemplateWorkout[]>()
  for (const w of workouts) {
    const list = workoutsByDay.get(w.day_offset) ?? []
    list.push(w)
    workoutsByDay.set(w.day_offset, list)
  }
  const stateByDay = new Map<number, PlanTemplateDayState>()
  for (const s of dayStates) stateByDay.set(s.day_offset, s)

  const totalWeeks = Math.ceil(durationDays / 7)
  const weeks: number[][] = []
  for (let w = 0; w < totalWeeks; w++) {
    const row: number[] = []
    for (let d = 0; d < 7; d++) {
      const day = w * 7 + d
      if (day < durationDays) row.push(day)
    }
    weeks.push(row)
  }

  const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

  return (
    <div>
      <div className="grid grid-cols-7 gap-px mb-1" style={{ backgroundColor: '#1E1E22' }}>
        {dayNames.map(n => (
          <div key={n} className="px-2 py-1 text-center text-[10px] tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
              backgroundColor: '#0A0A0B',
            }}>
            {n}
          </div>
        ))}
      </div>

      {weeks.map((row, wi) => {
        const firstDay = row[0]
        const lastDay = row[row.length - 1]
        const weekRangeLabel = startDate && firstDay !== undefined && lastDay !== undefined
          ? `Uke ${wi + 1} · ${formatNorskKortDato(addDays(startDate, firstDay))}–${formatNorskKortDato(addDays(startDate, lastDay))}`
          : `Uke ${wi + 1}`
        return (
          <div key={wi} className="mb-2">
            <div className="text-[10px] tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {weekRangeLabel}
            </div>
            <div className="grid grid-cols-7 gap-px" style={{ backgroundColor: '#1E1E22' }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const day = row[di]
                if (day === undefined) {
                  return <div key={di} style={{ minHeight: '88px', backgroundColor: '#09090B' }} />
                }
                return (
                  <DayCell
                    key={di}
                    day={day}
                    dateLabel={startDate ? formatNorskKortDato(addDays(startDate, day)) : null}
                    workouts={workoutsByDay.get(day) ?? []}
                    state={stateByDay.get(day) ?? null}
                    onClick={() => onDayClick(day)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DayCell({
  day, dateLabel, workouts, state, onClick,
}: {
  day: number
  dateLabel: string | null
  workouts: PlanTemplateWorkout[]
  state: PlanTemplateDayState | null
  onClick: () => void
}) {
  const isRest = state?.state_type === 'hviledag'
  const hasContent = workouts.length > 0 || state != null
  return (
    <button type="button" onClick={onClick}
      className="text-left px-2 py-1.5 transition-colors hover:bg-[#16161A]"
      style={{
        minHeight: '88px',
        backgroundColor: hasContent ? '#111113' : '#0D0D11',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}>
      <div className="flex items-center justify-between mb-1 gap-1">
        <span className="text-[10px] tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Dag {day + 1}
        </span>
        {dateLabel && (
          <span className="text-[10px] tracking-widest uppercase truncate"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {dateLabel}
          </span>
        )}
      </div>
      {isRest && (
        <span className="text-[11px]"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          · Hviledag
        </span>
      )}
      {workouts.slice(0, 2).map((w, i) => (
        <span key={i}
          className="text-[11px] truncate"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: COACH_BLUE,
            borderLeft: `2px solid ${COACH_BLUE}`,
            paddingLeft: '4px',
            marginTop: '2px',
          }}>
          {w.title || '(uten tittel)'}
        </span>
      ))}
      {workouts.length > 2 && (
        <span className="text-[10px] mt-0.5"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          +{workouts.length - 2} flere
        </span>
      )}
    </button>
  )
}
