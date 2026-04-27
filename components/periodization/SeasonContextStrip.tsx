import type { SeasonPeriod, SeasonKeyDate } from '@/app/actions/seasons'
import {
  INTENSITY_COLOR, INTENSITY_LABEL, KEY_EVENT_VISUALS,
  periodForDate, nextKeyDate, daysBetween,
} from '@/lib/periodization-overlay'

// Liten informasjonsstripe som vises øverst på /app/plan og gir kontekst
// fra periodiseringen: gjeldende periode, fokus, nest neste A-konkurranse,
// og en belastnings-badge for perioden vi er inne i.
export function SeasonContextStrip({
  periods, keyDates, todayISO,
}: {
  periods: SeasonPeriod[]
  keyDates: SeasonKeyDate[]
  todayISO: string
}) {
  if (periods.length === 0 && keyDates.length === 0) return null

  const currentPeriod = periodForDate(periods, todayISO)
  const nextA = nextKeyDate(keyDates, todayISO, k => k.event_type === 'competition_a')

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-3"
      style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>

      <div className="flex items-center gap-2">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Periode
        </span>
        {currentPeriod ? (
          <>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
              {currentPeriod.name}
            </span>
            <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: INTENSITY_COLOR[currentPeriod.intensity],
                border: `1px solid ${INTENSITY_COLOR[currentPeriod.intensity]}`,
              }}>
              {INTENSITY_LABEL[currentPeriod.intensity]}
            </span>
          </>
        ) : (
          <span className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            —
          </span>
        )}
      </div>

      {currentPeriod?.focus && (
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Fokus
          </span>
          <span className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {currentPeriod.focus}
          </span>
        </div>
      )}

      {nextA && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Neste A
          </span>
          <span aria-hidden>{KEY_EVENT_VISUALS[nextA.event_type].icon}</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
            {nextA.name}
          </span>
          <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            om {daysBetween(todayISO, nextA.event_date)} dager ({nextA.event_date})
          </span>
        </div>
      )}
    </div>
  )
}
