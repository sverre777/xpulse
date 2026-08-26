'use client'

import type { SeasonPeriod, SeasonKeyDate, PlannedWorkoutDot, SeasonMarking } from '@/app/actions/seasons'
import {
  INTENSITY_TINT, INTENSITY_COLOR, KEY_EVENT_VISUALS,
} from '@/lib/periodization-overlay'
import {
  MONTHS_NO, DAYS_NO_SHORT, buildMonthGrid, toISO,
  isoWeekNum, findPeriod, PEAK_GLOW,
} from '@/lib/season-calendar'

export function MonthMiniCalendar({
  year, month0, periods, keyDatesByDate, workoutsByDate,
  seasonStart, seasonEnd,
  onSelectMonth, onSelectWeek, onSelectDay,
  compact = false,
  markings = [],
}: {
  year: number
  month0: number
  periods: SeasonPeriod[]
  keyDatesByDate: Record<string, SeasonKeyDate[]>
  workoutsByDate: Record<string, PlannedWorkoutDot[]>
  seasonStart: string
  seasonEnd: string
  onSelectMonth?: (year: number, month0: number) => void
  onSelectWeek?: (mondayISO: string) => void
  onSelectDay?: (dateISO: string) => void
  compact?: boolean
  // Kø #39 punkt 8: markeringslaget (📍 samling / 🏔 høyde) som gull-bånd
  // i bunnen av dagcellene — dag-presist, kapsel-innrykk ved start/slutt.
  markings?: SeasonMarking[]
}) {
  const weeks = buildMonthGrid(year, month0)
  const todayISO = toISO(new Date())
  const inSeason = (iso: string) => iso >= seasonStart && iso <= seasonEnd

  const cellSize = compact ? 18 : 22
  const titleSize = compact ? 16 : 20

  return (
    <div className="p-3" style={{ backgroundColor: 'var(--flate-8-alt)', border: '1px solid var(--kant-3)' }}>
      <button
        type="button"
        onClick={() => onSelectMonth?.(year, month0)}
        className="w-full flex items-baseline justify-between mb-2"
        style={{ background: 'none', border: 'none', padding: 0, cursor: onSelectMonth ? 'pointer' : 'default', textAlign: 'left' }}
      >
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: `${titleSize}px`, letterSpacing: '0.06em' }}>
          {MONTHS_NO[month0]}
        </span>
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          {year}
        </span>
      </button>

      {/* Header: week col + 7 day letters */}
      <div className="grid" style={{ gridTemplateColumns: `18px repeat(7, 1fr)`, gap: '2px' }}>
        <div />
        {DAYS_NO_SHORT.map((d, i) => (
          <div key={i} className="text-center text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', lineHeight: 1 }}>
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const mondayISO = toISO(week[0])
        const weekNum = isoWeekNum(week[0])
        return (
          <div key={wi} className="grid mt-[2px]" style={{ gridTemplateColumns: `18px repeat(7, 1fr)`, gap: '2px' }}>
            <button
              type="button"
              onClick={() => onSelectWeek?.(mondayISO)}
              className="text-center text-xs"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: 'var(--tekst-8-app)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: onSelectWeek ? 'pointer' : 'default',
                lineHeight: 1,
                height: cellSize,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={`Uke ${weekNum}`}
            >
              {weekNum}
            </button>

            {week.map((d, di) => {
              const iso = toISO(d)
              const inMonth = d.getMonth() === month0
              const within = inSeason(iso)
              const period = within ? findPeriod(periods, iso) : null
              const events = keyDatesByDate[iso] ?? []
              const workouts = workoutsByDate[iso] ?? []
              const topEvent = events[0] ?? null
              const isToday = iso === todayISO
              const isPeak = events.some(e => e.is_peak_target)

              const bg = period ? INTENSITY_TINT[period.intensity] : 'transparent'
              const accent = period ? INTENSITY_COLOR[period.intensity] : 'transparent'

              const dayMarkings = within ? markings.filter(m => m.start_date <= iso && m.end_date >= iso) : []

              const titleParts: string[] = [iso]
              if (period) titleParts.push(period.name)
              for (const m of dayMarkings) {
                titleParts.push(`${m.is_training_camp ? '📍 ' : ''}${m.is_altitude ? '🏔 ' : ''}${m.name}${m.location ? ` · ${m.location}` : ''}${m.altitude_meters ? ` · ${m.altitude_meters} moh` : ''}`)
              }
              for (const e of events) titleParts.push(`${KEY_EVENT_VISUALS[e.event_type].icon} ${e.name}${e.is_peak_target ? ' ★' : ''}`)
              if (workouts.length) titleParts.push(`${workouts.length} planlagt økt${workouts.length === 1 ? '' : 'er'}`)

              return (
                <button
                  key={di}
                  type="button"
                  onClick={() => inMonth && within && onSelectDay?.(iso)}
                  disabled={!inMonth || !within}
                  title={titleParts.join('\n')}
                  className="relative flex items-start justify-center"
                  style={{
                    height: cellSize,
                    padding: '1px 0 0',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: compact ? '10px' : '11px',
                    lineHeight: 1,
                    color: !inMonth ? 'var(--kant-6)' : !within ? 'var(--kant-6)' : isToday ? '#FF4500' : 'var(--tekst-1-app)',
                    backgroundColor: inMonth && within ? bg : 'transparent',
                    border: 'none',
                    borderLeft: period ? `2px solid ${accent}` : '2px solid transparent',
                    outline: isToday ? '1px solid #FF4500' : 'none',
                    outlineOffset: '-1px',
                    boxShadow: isPeak ? PEAK_GLOW : undefined,
                    cursor: inMonth && within ? 'pointer' : 'default',
                  }}
                >
                  <span>{d.getDate()}</span>
                  {/* Markeringsbånd (samme gull-identitet som lerretet) —
                      kapsel-innrykk på markeringens første/siste dag. */}
                  {inMonth && dayMarkings.length > 0 && (() => {
                    const m = dayMarkings[0]
                    const startsHere = m.start_date === iso
                    const endsHere = m.end_date === iso
                    return (
                      <span aria-hidden style={{
                        position: 'absolute', bottom: 0, height: 2.5,
                        left: startsHere ? 2 : 0, right: endsHere ? 2 : 0,
                        background: 'rgba(212, 160, 23, 0.85)',
                        borderRadius: startsHere || endsHere ? 2 : 0,
                      }} />
                    )
                  })()}
                  {topEvent && (
                    <span aria-hidden
                      style={{ position: 'absolute', bottom: 0, right: 1, fontSize: '8px', lineHeight: 1 }}>
                      {KEY_EVENT_VISUALS[topEvent.event_type].icon}
                    </span>
                  )}
                  {!topEvent && workouts.length > 0 && (
                    <span aria-hidden
                      style={{
                        position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                        width: 3, height: 3, borderRadius: '50%', backgroundColor: '#FF4500',
                      }} />
                  )}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
