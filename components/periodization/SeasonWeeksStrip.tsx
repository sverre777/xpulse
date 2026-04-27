'use client'

import type { Season, SeasonPeriod, SeasonKeyDate } from '@/app/actions/seasons'
import {
  INTENSITY_TINT, INTENSITY_COLOR, INTENSITY_LABEL,
  KEY_EVENT_VISUALS, periodForDate, keyDatesForDate,
} from '@/lib/periodization-overlay'

function isoWeekNum(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil((((t.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mondayOf(d: Date): Date {
  const r = new Date(d)
  const day = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - day)
  r.setHours(0, 0, 0, 0)
  return r
}

// Bygg liste over ISO-uker (mandag-datoer) fra sesong-start til sesong-slutt.
function buildWeeks(season: Season): { monday: string; weekNum: number }[] {
  const start = mondayOf(new Date(season.start_date + 'T00:00:00'))
  const endDate = new Date(season.end_date + 'T00:00:00')
  const weeks: { monday: string; weekNum: number }[] = []
  const cursor = new Date(start)
  while (cursor <= endDate) {
    weeks.push({ monday: toISO(cursor), weekNum: isoWeekNum(cursor) })
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

export function SeasonWeeksStrip({
  season, periods, keyDates,
}: {
  season: Season
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
}) {
  const weeks = buildWeeks(season)

  // Indekser key_dates på ukestart (mandag som key_date faller i).
  const eventsByWeekStart: Record<string, SeasonKeyDate[]> = {}
  for (const k of keyDates) {
    const ev = new Date(k.event_date + 'T00:00:00')
    const mon = toISO(mondayOf(ev))
    if (!eventsByWeekStart[mon]) eventsByWeekStart[mon] = []
    eventsByWeekStart[mon].push(k)
  }

  const todayISO = toISO(new Date())

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Årsoversikt
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {(['rolig', 'medium', 'hard'] as const).map(k => (
            <span key={k} className="flex items-center gap-1">
              <span style={{ width: 10, height: 10, backgroundColor: INTENSITY_COLOR[k], display: 'inline-block' }} />
              {INTENSITY_LABEL[k]}
            </span>
          ))}
        </div>
      </div>

      <div className="p-4 overflow-x-auto" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <div className="flex items-stretch gap-[2px]" style={{ minWidth: `${weeks.length * 20}px` }}>
          {weeks.map(w => {
            const p = periodForDate(periods, w.monday)
            const bg = p ? INTENSITY_TINT[p.intensity] : 'transparent'
            const accent = p ? INTENSITY_COLOR[p.intensity] : '#1E1E22'
            const events = eventsByWeekStart[w.monday] ?? []
            // Inneværende uke: tykk aksent-ramme.
            const isCurrent = w.monday <= todayISO && todayISO < (weeks.find((_, i) => weeks[i].monday > w.monday)?.monday ?? season.end_date)
            const labelParts: string[] = [`Uke ${w.weekNum}`, w.monday]
            if (p) labelParts.push(`${p.name} · ${INTENSITY_LABEL[p.intensity]}`)
            for (const ev of events) labelParts.push(`${KEY_EVENT_VISUALS[ev.event_type].icon} ${ev.name}`)

            return (
              <div
                key={w.monday}
                title={labelParts.join('\n')}
                className="flex flex-col items-center justify-between"
                style={{
                  minWidth: '18px',
                  padding: '4px 0',
                  backgroundColor: bg,
                  borderLeft: `2px solid ${accent}`,
                  outline: isCurrent ? '1px solid #FF4500' : 'none',
                  outlineOffset: '-1px',
                }}
              >
                <span className="text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1 }}>
                  {w.weekNum}
                </span>
                <div className="flex flex-col items-center gap-[1px] mt-1">
                  {events.slice(0, 3).map(ev => (
                    <span key={ev.id} style={{ fontSize: '13px', lineHeight: 1 }} aria-hidden>
                      {KEY_EVENT_VISUALS[ev.event_type].icon}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
