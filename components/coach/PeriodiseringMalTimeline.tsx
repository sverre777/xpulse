'use client'

import type {
  PeriodizationTemplatePeriod, PeriodizationTemplateKeyDate,
} from '@/lib/template-types'
import { INTENSITY_COLOR, INTENSITY_LABEL, KEY_EVENT_VISUALS } from '@/lib/periodization-overlay'
import type { Intensity, KeyEventType } from '@/app/actions/seasons'
import { addDays, formatNorskKortDato } from '@/lib/template-dates'

const GOLD = '#D4A017'

interface Props {
  durationDays: number
  startDate: string | null
  periods: PeriodizationTemplatePeriod[]
  keyDates: PeriodizationTemplateKeyDate[]
}

export function PeriodiseringMalTimeline({
  durationDays, startDate, periods, keyDates,
}: Props) {
  const totalWeeks = Math.max(1, Math.ceil(durationDays / 7))

  const sortedPeriods = periods
    .slice()
    .sort((a, b) => a.start_offset - b.start_offset || a.sort_order - b.sort_order)

  return (
    <div style={{ border: '1px solid #1E1E22', backgroundColor: '#0D0D11' }}>
      <div className="px-3 py-2 flex items-center justify-between text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#8A8A96',
          borderBottom: '1px solid #1E1E22',
        }}>
        <span>Tidslinje</span>
        <span style={{ color: '#555560' }}>
          {totalWeeks} uke{totalWeeks === 1 ? '' : 'r'} · {durationDays} dag{durationDays === 1 ? '' : 'er'}
        </span>
      </div>

      <div className="px-3 py-3">
        <Legend />

        <div className="mt-3" style={{ position: 'relative' }}>
          {/* Week ruler */}
          <div className="flex" style={{ borderBottom: '1px solid #1E1E22' }}>
            {Array.from({ length: totalWeeks }, (_, i) => (
              <div key={i}
                className="flex items-center justify-center text-xs"
                style={{
                  flex: '1 0 0',
                  minWidth: '12px',
                  height: '20px',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: i % 4 === 0 ? '#C0C0CC' : '#3A3A44',
                  borderRight: i < totalWeeks - 1 ? '1px solid #1A1A1E' : 'none',
                }}>
                {i % 4 === 0 || totalWeeks <= 12 ? `U${i + 1}` : ''}
              </div>
            ))}
          </div>

          {/* Period bars (stacked vertically — sortert etter start) */}
          <div className="flex flex-col gap-1 mt-2">
            {sortedPeriods.length === 0 ? (
              <p className="text-xs py-3 text-center"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Ingen perioder ennå. Legg til perioder under for å bygge sesongstruktur.
              </p>
            ) : (
              sortedPeriods.map((p, i) => (
                <PeriodBar
                  key={i}
                  period={p}
                  durationDays={durationDays}
                  startDate={startDate}
                />
              ))
            )}
          </div>

          {/* Key dates row */}
          {keyDates.length > 0 && (
            <div className="mt-3 pt-2" style={{ borderTop: '1px solid #1E1E22' }}>
              <p className="text-xs tracking-widest uppercase mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Nøkkel-datoer
              </p>
              <div className="flex flex-wrap gap-2">
                {keyDates
                  .slice()
                  .sort((a, b) => a.day_offset - b.day_offset)
                  .map((k, i) => (
                    <KeyDateChip key={i} keyDate={k} startDate={startDate} />
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PeriodBar({
  period, durationDays, startDate,
}: {
  period: PeriodizationTemplatePeriod
  durationDays: number
  startDate: string | null
}) {
  const start = Math.max(0, period.start_offset)
  const end = Math.min(durationDays - 1, period.end_offset)
  const leftPct = (start / durationDays) * 100
  const widthPct = ((end - start + 1) / durationDays) * 100

  const intensity = (['rolig', 'medium', 'hard'].includes(period.intensity)
    ? period.intensity
    : 'medium') as Intensity
  const color = INTENSITY_COLOR[intensity]

  const startLabel = startDate ? formatNorskKortDato(addDays(startDate, start)) : `Dag ${start + 1}`
  const endLabel = startDate ? formatNorskKortDato(addDays(startDate, end)) : `Dag ${end + 1}`

  return (
    <div style={{ position: 'relative', height: '28px' }}
      title={`${period.name} · ${startLabel}–${endLabel} · ${INTENSITY_LABEL[intensity]}`}>
      <div style={{
        position: 'absolute',
        left: `${leftPct}%`,
        width: `${Math.max(widthPct, 1)}%`,
        height: '100%',
        backgroundColor: `${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRight: `1px solid ${color}66`,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '6px',
        overflow: 'hidden',
      }}>
        <span className="truncate text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#F0F0F2',
            letterSpacing: '0.05em',
          }}>
          {period.name}
        </span>
      </div>
    </div>
  )
}

function KeyDateChip({
  keyDate, startDate,
}: {
  keyDate: PeriodizationTemplateKeyDate
  startDate: string | null
}) {
  const visual = KEY_EVENT_VISUALS[keyDate.date_type as KeyEventType] ?? KEY_EVENT_VISUALS.other
  const dayLabel = startDate
    ? formatNorskKortDato(addDays(startDate, keyDate.day_offset))
    : `Dag ${keyDate.day_offset + 1}`
  const isPeak = !!keyDate.is_peak_target
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: '#F0F0F2',
        backgroundColor: '#111113',
        border: `${visual.borderWidth}px solid ${visual.color}`,
        boxShadow: isPeak ? `0 0 6px ${GOLD}AA` : undefined,
      }}>
      <span aria-hidden>{visual.icon}</span>
      <span>{keyDate.title}</span>
      <span style={{ color: '#8A8A96' }}>· {dayLabel}</span>
    </span>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
      {(['rolig', 'medium', 'hard'] as const).map(k => (
        <span key={k} className="flex items-center gap-1">
          <span style={{ width: 10, height: 10, backgroundColor: INTENSITY_COLOR[k], display: 'inline-block' }} />
          {INTENSITY_LABEL[k]}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span aria-hidden>{KEY_EVENT_VISUALS.competition_a.icon}</span> A-konk
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden>{KEY_EVENT_VISUALS.competition_b.icon}</span> B-konk
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden>{KEY_EVENT_VISUALS.competition_c.icon}</span> C/test
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden>{KEY_EVENT_VISUALS.camp.icon}</span> Samling
      </span>
      <span className="flex items-center gap-1">
        <span style={{
          width: 8, height: 8, display: 'inline-block',
          boxShadow: `0 0 4px ${GOLD}CC`,
          backgroundColor: GOLD,
        }} />
        Form-topp
      </span>
    </div>
  )
}
