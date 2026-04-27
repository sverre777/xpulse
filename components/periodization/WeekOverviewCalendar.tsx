'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type {
  Season, SeasonPeriod, SeasonKeyDate, PlannedWorkoutDot,
} from '@/app/actions/seasons'
import {
  INTENSITY_TINT, INTENSITY_COLOR, INTENSITY_LABEL, KEY_EVENT_VISUALS,
} from '@/lib/periodization-overlay'
import {
  DAYS_NO_LONG, toISO, parseISO, mondayOf, isoWeekNum, addDays,
  findPeriod, indexByDate, PEAK_GLOW, MONTHS_NO,
} from '@/lib/season-calendar'

export function WeekOverviewCalendar({
  season, periods, keyDates, plannedWorkouts,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  plannedWorkouts: PlannedWorkoutDot[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = new Date()
  const todayISO = toISO(today)

  const wParam = searchParams.get('w')
  const fallbackMonday = (() => {
    const ref = todayISO >= season.start_date && todayISO <= season.end_date
      ? today
      : parseISO(season.start_date)
    return toISO(mondayOf(ref))
  })()
  const mondayISO = wParam && /^\d{4}-\d{2}-\d{2}$/.test(wParam) ? wParam : fallbackMonday

  const monday = parseISO(mondayISO)
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  const keyDatesByDate = indexByDate(keyDates, 'event_date')
  const workoutsByDate = indexByDate(plannedWorkouts, 'date')

  const navigateWeek = (delta: number) => {
    const next = addDays(mondayISO, delta * 7)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'uke')
    params.set('w', next)
    router.push(`/app/periodisering?${params.toString()}`)
  }

  const goToDay = (iso: string) => router.push(`/app/plan?d=${iso}`)

  const prevAllowed = addDays(mondayISO, -7) >= toISO(mondayOf(parseISO(season.start_date)))
  const nextAllowed = addDays(mondayISO, 7) <= season.end_date

  const wn = isoWeekNum(monday)
  const weekPeriod = findPeriod(periods, mondayISO) ?? findPeriod(periods, addDays(mondayISO, 6))

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '26px', letterSpacing: '0.06em' }}>
            Uke {wn}
          </h2>
          <p className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {monday.getDate()}. {MONTHS_NO[monday.getMonth()]} → {days[6].getDate()}. {MONTHS_NO[days[6].getMonth()]} {days[6].getFullYear()}
            {weekPeriod && ` · ${weekPeriod.name} (${INTENSITY_LABEL[weekPeriod.intensity]})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigateWeek(-1)} disabled={!prevAllowed}
            className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
              color: prevAllowed ? '#F0F0F2' : '#2A2A30',
              cursor: prevAllowed ? 'pointer' : 'not-allowed',
            }}>
            ← Forrige
          </button>
          <button type="button" onClick={() => navigateWeek(1)} disabled={!nextAllowed}
            className="px-3 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
              color: nextAllowed ? '#F0F0F2' : '#2A2A30',
              cursor: nextAllowed ? 'pointer' : 'not-allowed',
            }}>
            Neste →
          </button>
        </div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((d, i) => {
          const iso = toISO(d)
          const within = iso >= season.start_date && iso <= season.end_date
          const period = within ? findPeriod(periods, iso) : null
          const events = keyDatesByDate[iso] ?? []
          const workouts = workoutsByDate[iso] ?? []
          const isToday = iso === todayISO
          const isPeak = events.some(e => e.is_peak_target)
          const bg = period ? INTENSITY_TINT[period.intensity] : 'transparent'
          const accent = period ? INTENSITY_COLOR[period.intensity] : '#1E1E22'

          return (
            <button key={iso}
              type="button"
              onClick={() => within && goToDay(iso)}
              disabled={!within}
              className="text-left"
              style={{
                minHeight: '180px',
                padding: '10px',
                backgroundColor: isToday ? '#0D0D14' : bg,
                border: '1px solid #1E1E22',
                borderLeft: `3px solid ${accent}`,
                boxShadow: isPeak ? PEAK_GLOW : undefined,
                cursor: within ? 'pointer' : 'default',
              }}>
              <div className="flex items-baseline justify-between mb-2">
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {DAYS_NO_LONG[i]}
                </span>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', lineHeight: 1,
                  color: isToday ? '#FF4500' : '#F0F0F2',
                }}>
                  {d.getDate()}
                </span>
              </div>

              {events.map(e => (
                <div key={e.id} className="mb-1 text-[12px] truncate"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: KEY_EVENT_VISUALS[e.event_type].color,
                    fontWeight: e.is_peak_target ? 600 : 400,
                  }}
                  title={e.name}>
                  <span aria-hidden className="mr-1">{KEY_EVENT_VISUALS[e.event_type].icon}</span>
                  {e.name}
                </div>
              ))}

              {workouts.map(w => (
                <div key={w.id} className="text-xs truncate"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}
                  title={w.title}>
                  • {w.title || 'Planlagt økt'}
                </div>
              ))}

              {events.length === 0 && workouts.length === 0 && within && (
                <span className="text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340' }}>
                  —
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
