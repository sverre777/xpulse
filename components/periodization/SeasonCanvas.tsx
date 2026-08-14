'use client'

// «Mal sesongen»-lerret (kø #39, fase 1 — design/xpulse-aarsplan-design.html).
// Belastningspensler males med dra over uke-celler; sammenhengende uker blir
// én periode (mandag første uke → søndag siste uke) via EKSISTERENDE
// createPeriod/updatePeriod/deletePeriod. Maling over eksisterende perioder
// trimmer/splitter — aldri stille datatap: sletting/splitt bekreftes.
// ✋ Velg åpner eksisterende PeriodModal (detaljpanel m/ ALLE felter).
// Lerretet genereres fra sesongens faktiske lengde. Server-respons er
// sannhet: router.refresh() etter lagring.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPeriod, updatePeriod, deletePeriod,
  type Season, type SeasonPeriod, type Intensity, type PeriodInput,
} from '@/app/actions/seasons'
import { INTENSITY_COLOR } from '@/lib/periodization-overlay'
import { xpConfirm } from '@/components/ui/ConfirmDialog'

const INTENSITY_LABEL: Record<Intensity, string> = {
  rolig: 'Rolig', medium: 'Medium', hard: 'Hard',
}

type Brush = 'pick' | 'erase' | Intensity

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES']

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseISO(iso: string): Date {
  return new Date(iso + 'T12:00:00')
}
function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}
function isoWeekNo(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil((((t.getTime() - ys.getTime()) / 86400000) + 1) / 7)
}

interface WeekCell {
  idx: number
  mondayISO: string
  sundayISO: string
  weekNo: number
  monthIdx: number // måned for mandagen — brukes til rad-gruppering
}

function buildWeeks(startISO: string, endISO: string): WeekCell[] {
  const start = parseISO(startISO)
  const monday = new Date(start)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const out: WeekCell[] = []
  let i = 0
  while (toISO(monday) <= endISO && i < 106) {
    out.push({
      idx: i,
      mondayISO: toISO(monday),
      sundayISO: addDaysISO(toISO(monday), 6),
      weekNo: isoWeekNo(monday),
      monthIdx: monday.getMonth(),
    })
    monday.setDate(monday.getDate() + 7)
    i++
  }
  return out
}

// Perioden som dekker flest dager av uka (uker kan straddle to perioder).
function periodForWeek(w: WeekCell, periods: SeasonPeriod[]): SeasonPeriod | null {
  let best: SeasonPeriod | null = null
  let bestDays = 0
  for (const p of periods) {
    const s = p.start_date > w.mondayISO ? p.start_date : w.mondayISO
    const e = p.end_date < w.sundayISO ? p.end_date : w.sundayISO
    if (s > e) continue
    const days = (parseISO(e).getTime() - parseISO(s).getTime()) / 86400000 + 1
    if (days > bestDays) { best = p; bestDays = days }
  }
  return best
}

function periodToInput(p: SeasonPeriod, overrides: Partial<PeriodInput>, targetUserId?: string): PeriodInput {
  return {
    season_id: p.season_id,
    name: p.name,
    focus: p.focus,
    start_date: p.start_date,
    end_date: p.end_date,
    intensity: p.intensity,
    notes: p.notes,
    sort_order: p.sort_order,
    is_altitude_period: p.is_altitude_period ?? false,
    altitude_meters: p.altitude_meters ?? null,
    is_training_camp: p.is_training_camp ?? false,
    location: p.location ?? null,
    targetUserId,
    ...overrides,
  }
}

export function SeasonCanvas({ season, periods, targetUserId, canEdit, onPickPeriod }: {
  season: Season
  periods: SeasonPeriod[]
  targetUserId?: string
  canEdit: boolean
  // ✋ Velg: åpner eksisterende PeriodModal i PeriodsSection (detaljpanelet).
  onPickPeriod: (p: SeasonPeriod) => void
}) {
  const router = useRouter()
  const [brush, setBrush] = useState<Brush>('pick')
  const [drag, setDrag] = useState<{ start: number; end: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const weeks = buildWeeks(season.start_date, season.end_date)
  const todayISO = toISO(new Date())

  // Rad-gruppering: uker samlet per måned (mandagens måned), som i utkastet.
  const rows: { label: string; cells: WeekCell[] }[] = []
  for (const w of weeks) {
    const last = rows[rows.length - 1]
    if (last && last.cells[0].monthIdx === w.monthIdx) last.cells.push(w)
    else rows.push({ label: MONTHS_SHORT[w.monthIdx], cells: [w] })
  }

  const selMin = drag ? Math.min(drag.start, drag.end) : -1
  const selMax = drag ? Math.max(drag.start, drag.end) : -1

  // ── Maling: sammenhengende uker → én periode. Overlapp trimmes/splittes. ──
  const applyPaint = async (startIdx: number, endIdx: number, paint: Intensity | 'erase') => {
    if (busy) return
    const lo = Math.min(startIdx, endIdx)
    const hi = Math.max(startIdx, endIdx)
    // Mandag første uke → søndag siste uke, klemt til sesongen.
    let rangeStart = weeks[lo].mondayISO
    let rangeEnd = weeks[hi].sundayISO
    if (rangeStart < season.start_date) rangeStart = season.start_date
    if (rangeEnd > season.end_date) rangeEnd = season.end_date
    if (rangeStart > rangeEnd) return

    const overlaps = periods
      .filter(p => p.start_date <= rangeEnd && p.end_date >= rangeStart)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))

    const fullyCovered = overlaps.filter(p => p.start_date >= rangeStart && p.end_date <= rangeEnd)
    const splits = overlaps.filter(p => p.start_date < rangeStart && p.end_date > rangeEnd)
    // Samme intensitet som penselen absorberes uten videre (blir del av ny/utvidet).
    const deletions = paint === 'erase'
      ? fullyCovered
      : fullyCovered.filter(p => p.intensity !== paint || p.name || p.notes)

    if (splits.length > 0 || deletions.length > 0) {
      const parts: string[] = []
      if (splits.length > 0) parts.push(`«${splits.map(p => p.name).join('», «')}» deles i to`)
      if (deletions.length > 0) parts.push(`${deletions.length === 1 ? `«${deletions[0].name}» slettes` : `${deletions.length} perioder slettes`}`)
      const ok = await xpConfirm(`Maling over eksisterende: ${parts.join(' og ')}. Fortsette?`)
      if (!ok) return
    }

    setBusy(true)
    setError(null)
    try {
      // 1) Fjern helt dekkede perioder.
      for (const p of fullyCovered) {
        const res = await deletePeriod(p.id, targetUserId)
        if (res.error) throw new Error(res.error)
      }
      // 2) Splitt perioder som omslutter hele spennet.
      for (const p of splits) {
        const origEnd = p.end_date
        const resA = await updatePeriod(p.id, periodToInput(p, { end_date: addDaysISO(rangeStart, -1) }, targetUserId))
        if (resA.error) throw new Error(resA.error)
        const resB = await createPeriod(periodToInput(p, {
          name: `${p.name} (forts.)`,
          start_date: addDaysISO(rangeEnd, 1),
          end_date: origEnd,
        }, targetUserId))
        if (resB.error) throw new Error(resB.error)
      }
      // 3) Trim delvis overlapp (venstre/høyre).
      let leftNeighbor: SeasonPeriod | null = null
      let rightNeighbor: SeasonPeriod | null = null
      for (const p of overlaps) {
        if (fullyCovered.includes(p) || splits.includes(p)) continue
        if (p.start_date < rangeStart) {
          const res = await updatePeriod(p.id, periodToInput(p, { end_date: addDaysISO(rangeStart, -1) }, targetUserId))
          if (res.error) throw new Error(res.error)
          leftNeighbor = p
        } else {
          const res = await updatePeriod(p.id, periodToInput(p, { start_date: addDaysISO(rangeEnd, 1) }, targetUserId))
          if (res.error) throw new Error(res.error)
          rightNeighbor = p
        }
      }
      if (paint !== 'erase') {
        // 4) Nabo-sammenslåing: tilstøtende periode med SAMME belastning
        //    utvides i stedet for å opprette ny (sammenhengende = én periode).
        const leftAdj = leftNeighbor && leftNeighbor.intensity === paint
          ? leftNeighbor
          : periods.find(p => p.intensity === paint && p.end_date === addDaysISO(rangeStart, -1) && !fullyCovered.includes(p) && !splits.includes(p)) ?? null
        const rightAdj = rightNeighbor && rightNeighbor.intensity === paint
          ? rightNeighbor
          : periods.find(p => p.intensity === paint && p.start_date === addDaysISO(rangeEnd, 1) && !fullyCovered.includes(p) && !splits.includes(p)) ?? null
        if (leftAdj) {
          const newEnd = rightAdj ? rightAdj.end_date : rangeEnd
          const res = await updatePeriod(leftAdj.id, periodToInput(leftAdj, { end_date: newEnd }, targetUserId))
          if (res.error) throw new Error(res.error)
          if (rightAdj) {
            const res2 = await deletePeriod(rightAdj.id, targetUserId)
            if (res2.error) throw new Error(res2.error)
          }
        } else if (rightAdj) {
          const res = await updatePeriod(rightAdj.id, periodToInput(rightAdj, { start_date: rangeStart }, targetUserId))
          if (res.error) throw new Error(res.error)
        } else {
          const res = await createPeriod({
            season_id: season.id,
            name: `${INTENSITY_LABEL[paint]} uke ${weeks[lo].weekNo}–${weeks[hi].weekNo}`,
            start_date: rangeStart,
            end_date: rangeEnd,
            intensity: paint,
            targetUserId,
          })
          if (res.error) throw new Error(res.error)
        }
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // ── Pointer-håndtering (pointerdown/move/up — fungerer på touch) ──
  const cellFromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-wk]')
    if (!el) return null
    const v = Number((el as HTMLElement).dataset.wk)
    return Number.isFinite(v) ? v : null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canEdit || busy) return
    const idx = cellFromPoint(e.clientX, e.clientY)
    if (idx == null) return
    if (brush === 'pick') {
      const p = periodForWeek(weeks[idx], periods)
      if (p) onPickPeriod(p)
      return
    }
    e.preventDefault()
    containerRef.current?.setPointerCapture(e.pointerId)
    setDrag({ start: idx, end: idx })
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    const idx = cellFromPoint(e.clientX, e.clientY)
    if (idx != null && idx !== drag.end) setDrag(d => d ? { ...d, end: idx } : d)
  }
  const handlePointerUp = () => {
    if (!drag) return
    const { start, end } = drag
    setDrag(null)
    if (brush === 'rolig' || brush === 'medium' || brush === 'hard' || brush === 'erase') {
      void applyPaint(start, end, brush === 'erase' ? 'erase' : brush)
    }
  }

  const toolBtn = (b: Brush, label: string, sw?: string): React.ReactNode => (
    <button key={b} type="button" onClick={() => setBrush(b)}
      className="inline-flex items-center gap-1.5 transition-colors"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14,
        letterSpacing: '0.06em', borderRadius: 9, padding: '8px 13px', cursor: 'pointer',
        border: '1px solid var(--line2)',
        color: brush === b ? '#fff' : '#8B8B95',
        background: brush === b ? (sw ?? '#26262E') : 'none',
        boxShadow: brush === b ? '0 0 0 2px var(--accent), 0 4px 16px rgba(255,69,0,.2)' : 'none',
      }}>
      {sw && <span style={{ width: 11, height: 11, borderRadius: 3, background: sw }} />}
      {label}
    </button>
  )

  return (
    <div className="mb-6 p-5" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }}>
      <div className="flex items-start gap-3 mb-2">
        <span style={{ width: 22, height: 4, borderRadius: 2, background: 'var(--accent)', marginTop: 8 }} />
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.09em', color: '#F2F2F0', fontWeight: 400 }}>
            Mal sesongen
          </h2>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14.5px', color: '#55555F', marginTop: 2 }}>
            {canEdit
              ? 'Velg pensel → dra over ukene. Sammenhengende uker blir én periode. ✋ Velg åpner detaljer.'
              : 'Sesongens belastningsprofil uke for uke.'}
          </p>
        </div>
        {busy && (
          <span className="ml-auto" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--accent)' }}>
            Lagrer…
          </span>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex gap-2 items-center p-2" style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card2)' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.16em', color: '#55555F', textTransform: 'uppercase' }}>Belastning</span>
            {toolBtn('rolig', 'Rolig', INTENSITY_COLOR.rolig)}
            {toolBtn('medium', 'Medium', INTENSITY_COLOR.medium)}
            {toolBtn('hard', 'Hard', INTENSITY_COLOR.hard)}
          </div>
          <div className="flex gap-2 items-center p-2" style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card2)' }}>
            {toolBtn('pick', '✋ Velg')}
            {toolBtn('erase', '⌫ Visk')}
          </div>
        </div>
      )}

      {error && (
        <p className="mb-2 px-3 py-2 text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E23A5A', backgroundColor: 'rgba(226,58,90,0.08)', border: '1px solid rgba(226,58,90,0.3)', borderRadius: 8 }}>
          {error}
        </p>
      )}

      <div ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDrag(null)}
        style={{ touchAction: canEdit && brush !== 'pick' ? 'none' : 'auto', opacity: busy ? 0.6 : 1, userSelect: 'none' }}>
        {rows.map((row, ri) => (
          <div key={ri} className="flex items-stretch gap-2 mb-1.5">
            <div style={{
              flex: '0 0 40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: '0.1em',
              color: '#55555F', borderRight: '1px solid var(--line)',
            }}>
              {row.label}
            </div>
            <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.cells.length}, 1fr)` }}>
              {row.cells.map(w => {
                const p = periodForWeek(w, periods)
                const color = p ? INTENSITY_COLOR[p.intensity] : null
                const isStartWeek = p != null && p.start_date >= w.mondayISO && p.start_date <= w.sundayISO
                const isToday = todayISO >= w.mondayISO && todayISO <= w.sundayISO
                const selected = drag != null && w.idx >= selMin && w.idx <= selMax
                return (
                  <div key={w.idx} data-wk={w.idx}
                    style={{
                      position: 'relative', minHeight: 46, borderRadius: 9,
                      border: `1px solid ${color ? `${color}8C` : 'var(--line)'}`,
                      background: color ? `${color}42` : 'var(--card2)',
                      cursor: canEdit ? 'pointer' : 'default',
                      outline: selected ? '2px solid var(--accent)' : (isToday ? '2px solid var(--accent)' : 'none'),
                      outlineOffset: 1,
                      opacity: selected ? 0.85 : 1,
                      padding: '4px 6px', overflow: 'visible',
                    }}>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11.5px',
                      letterSpacing: '0.06em', color: isToday ? 'var(--accent)' : '#55555F',
                      fontWeight: isToday ? 700 : 400,
                    }}>
                      U{w.weekNo}
                    </span>
                    {isStartWeek && p && (
                      <span style={{
                        position: 'absolute', top: -9, left: 5, zIndex: 2,
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10.5, fontWeight: 700,
                        letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                        background: 'var(--bg-primary, #0A0A0B)', borderRadius: 5, padding: '1px 6px',
                        color: color ?? '#8B8B95', border: `1px solid ${color ? `${color}80` : 'var(--line2)'}`,
                        maxWidth: '160%', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.name}
                      </span>
                    )}
                    {(p?.is_training_camp || p?.is_altitude_period) && isStartWeek && (
                      <span style={{ position: 'absolute', top: 3, right: 5, fontSize: 10 }}>
                        {p?.is_training_camp ? '📍' : ''}{p?.is_altitude_period ? '🏔' : ''}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
