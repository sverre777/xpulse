'use client'

// «Mal sesongen»-lerret (kø #39 — design/xpulse-aarsplan-design.html).
// A1: DAG-PRESIS maling. Granularitets-velger UKE/DAG i verktøykassa:
//  - UKE: rask maling som snapper man–søn (fase 1-oppførsel).
//  - DAG: ukecellene viser 7 dag-ticks og penselen maler enkeltdager.
// ÉN kodebane: all mutasjon går via applyPaint(rangeStartISO, rangeEndISO)
// på DAGSgrenser — uke-modus er kun snapping av seleksjonen.
// Trim/splitt/merge som før (dag-presis); destruktivt bekreftes alltid.
// ✋ i dag-modus: dra start-/sluttkant av en periode dag-for-dag (håndtak);
// klikk uten dra åpner detaljpanelet (eksisterende PeriodModal).
// Server er sannhet: router.refresh() etter hver operasjon.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPeriod, updatePeriod, deletePeriod,
  type Season, type SeasonPeriod, type Intensity, type PeriodInput,
} from '@/app/actions/seasons'
import { INTENSITY_COLOR, weekIntensityGradient } from '@/lib/periodization-overlay'
import { xpConfirm } from '@/components/ui/ConfirmDialog'

const INTENSITY_LABEL: Record<Intensity, string> = {
  rolig: 'Rolig', medium: 'Medium', hard: 'Hard',
}

type Brush = 'pick' | 'erase' | Intensity
type Granularity = 'uke' | 'dag'

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
function minISO(a: string, b: string): string { return a < b ? a : b }
function maxISO(a: string, b: string): string { return a > b ? a : b }

interface WeekCell {
  idx: number
  mondayISO: string
  sundayISO: string
  weekNo: number
  monthIdx: number
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

function periodForDay(iso: string, periods: SeasonPeriod[]): SeasonPeriod | null {
  return periods.find(p => p.start_date <= iso && p.end_date >= iso) ?? null
}

// Perioden som dekker flest dager av uka (til uke-modusens celle-farge).
function periodForWeek(w: WeekCell, periods: SeasonPeriod[]): SeasonPeriod | null {
  let best: SeasonPeriod | null = null
  let bestDays = 0
  for (const p of periods) {
    const s = maxISO(p.start_date, w.mondayISO)
    const e = minISO(p.end_date, w.sundayISO)
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
  onPickPeriod: (p: SeasonPeriod) => void
}) {
  const router = useRouter()
  const [brush, setBrush] = useState<Brush>('pick')
  const [granularity, setGranularity] = useState<Granularity>('uke')
  // Seleksjon under maling — alltid som dag-spenn (uke-modus snapper).
  const [sel, setSel] = useState<{ anchorISO: string; headISO: string } | null>(null)
  // ✋ + dag-modus: kant-dra av eksisterende periode.
  const [edgeDrag, setEdgeDrag] = useState<{
    period: SeasonPeriod; edge: 'start' | 'end'; dateISO: string; moved: boolean
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const weeks = buildWeeks(season.start_date, season.end_date)
  const todayISO = toISO(new Date())

  const rows: { label: string; cells: WeekCell[] }[] = []
  for (const w of weeks) {
    const last = rows[rows.length - 1]
    if (last && last.cells[0].monthIdx === w.monthIdx) last.cells.push(w)
    else rows.push({ label: MONTHS_SHORT[w.monthIdx], cells: [w] })
  }

  // Effektivt seleksjonsspenn (ISO), snapper til man–søn i uke-modus.
  const selRange = (() => {
    if (!sel) return null
    let lo = minISO(sel.anchorISO, sel.headISO)
    let hi = maxISO(sel.anchorISO, sel.headISO)
    if (granularity === 'uke') {
      const loWeek = weeks.find(w => lo >= w.mondayISO && lo <= w.sundayISO)
      const hiWeek = weeks.find(w => hi >= w.mondayISO && hi <= w.sundayISO)
      if (loWeek) lo = loWeek.mondayISO
      if (hiWeek) hi = hiWeek.sundayISO
    }
    return { lo: maxISO(lo, season.start_date), hi: minISO(hi, season.end_date) }
  })()

  // Perioder m/ kant-dra-preview lagt oppå (kun visning under drag).
  const effectivePeriods = edgeDrag
    ? periods.map(p => p.id === edgeDrag.period.id
        ? { ...p, [edgeDrag.edge === 'start' ? 'start_date' : 'end_date']: edgeDrag.dateISO }
        : p)
    : periods

  // ── ÉN kodebane: all maling på dag-presise ISO-spenn. ──
  const applyPaint = async (rangeStart: string, rangeEnd: string, paint: Intensity | 'erase') => {
    if (busy || rangeStart > rangeEnd) return

    const overlaps = periods
      .filter(p => p.start_date <= rangeEnd && p.end_date >= rangeStart)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))

    const fullyCovered = overlaps.filter(p => p.start_date >= rangeStart && p.end_date <= rangeEnd)
    const splits = overlaps.filter(p => p.start_date < rangeStart && p.end_date > rangeEnd)
    const deletions = paint === 'erase'
      ? fullyCovered
      : fullyCovered.filter(p => p.intensity !== paint || p.name || p.notes)

    if (splits.length > 0 || deletions.length > 0) {
      const parts: string[] = []
      if (splits.length > 0) parts.push(`«${splits.map(p => p.name).join('», «')}» deles i to`)
      if (deletions.length > 0) parts.push(deletions.length === 1 ? `«${deletions[0].name}» slettes` : `${deletions.length} perioder slettes`)
      const ok = await xpConfirm(`Maling over eksisterende: ${parts.join(' og ')}. Fortsette?`)
      if (!ok) return
    }

    setBusy(true)
    setError(null)
    try {
      for (const p of fullyCovered) {
        const res = await deletePeriod(p.id, targetUserId)
        if (res.error) throw new Error(res.error)
      }
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
          const wLo = weeks.find(w => rangeStart >= w.mondayISO && rangeStart <= w.sundayISO)
          const wHi = weeks.find(w => rangeEnd >= w.mondayISO && rangeEnd <= w.sundayISO)
          const res = await createPeriod({
            season_id: season.id,
            name: wLo && wHi
              ? (wLo.weekNo === wHi.weekNo ? `${INTENSITY_LABEL[paint]} uke ${wLo.weekNo}` : `${INTENSITY_LABEL[paint]} uke ${wLo.weekNo}–${wHi.weekNo}`)
              : INTENSITY_LABEL[paint],
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

  // ── Kant-dra (✋ + dag-modus): lagre ny start-/sluttdato. ──
  const applyEdgeDrag = async (drag: NonNullable<typeof edgeDrag>) => {
    const p = drag.period
    const override = drag.edge === 'start'
      ? { start_date: drag.dateISO }
      : { end_date: drag.dateISO }
    setBusy(true)
    setError(null)
    const res = await updatePeriod(p.id, periodToInput(p, override, targetUserId))
    if (res.error) setError(res.error)
    else router.refresh()
    setBusy(false)
  }

  // Klem kant-dra til nabo-grenser og sesongen (aldri sluk naboer via dra).
  const clampEdge = (p: SeasonPeriod, edge: 'start' | 'end', iso: string): string => {
    let lo: string
    let hi: string
    if (edge === 'start') {
      const prev = periods.filter(x => x.id !== p.id && x.end_date < p.end_date && x.end_date < p.start_date)
        .sort((a, b) => b.end_date.localeCompare(a.end_date))[0]
      lo = prev ? addDaysISO(prev.end_date, 1) : season.start_date
      hi = p.end_date
    } else {
      const next = periods.filter(x => x.id !== p.id && x.start_date > p.start_date && x.start_date > p.end_date)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
      lo = p.start_date
      hi = next ? addDaysISO(next.start_date, -1) : season.end_date
    }
    return maxISO(lo, minISO(hi, iso))
  }

  // ── Pointer-håndtering (pointerdown/move/up + elementFromPoint = touch-klar) ──
  const dayFromPoint = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-day]')
    return el ? String((el as HTMLElement).dataset.day) : null
  }
  const weekFromPoint = (x: number, y: number): WeekCell | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-wk]')
    if (!el) return null
    const v = Number((el as HTMLElement).dataset.wk)
    return weeks[v] ?? null
  }
  const pointToISO = (x: number, y: number): string | null => {
    if (granularity === 'dag') return dayFromPoint(x, y)
    const w = weekFromPoint(x, y)
    return w ? w.mondayISO : null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canEdit || busy) return
    const iso = pointToISO(e.clientX, e.clientY)
    if (!iso) return
    if (brush === 'pick') {
      // Dag-modus: pointerdown på en periodekant starter kant-dra;
      // klikk uten bevegelse åpner detaljpanelet (håndteres på pointerup).
      if (granularity === 'dag') {
        const p = periodForDay(iso, periods)
        if (p && (iso === p.start_date || iso === p.end_date)) {
          e.preventDefault()
          containerRef.current?.setPointerCapture(e.pointerId)
          setEdgeDrag({ period: p, edge: iso === p.start_date ? 'start' : 'end', dateISO: iso, moved: false })
          return
        }
        if (p) onPickPeriod(p)
        return
      }
      const w = weekFromPoint(e.clientX, e.clientY)
      const p = w ? periodForWeek(w, periods) : null
      if (p) onPickPeriod(p)
      return
    }
    e.preventDefault()
    containerRef.current?.setPointerCapture(e.pointerId)
    setSel({ anchorISO: iso, headISO: iso })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (edgeDrag) {
      const iso = dayFromPoint(e.clientX, e.clientY)
      if (iso) {
        const clamped = clampEdge(edgeDrag.period, edgeDrag.edge, iso)
        if (clamped !== edgeDrag.dateISO) setEdgeDrag({ ...edgeDrag, dateISO: clamped, moved: true })
        else if (!edgeDrag.moved && clamped !== (edgeDrag.edge === 'start' ? edgeDrag.period.start_date : edgeDrag.period.end_date)) {
          setEdgeDrag({ ...edgeDrag, moved: true })
        }
      }
      return
    }
    if (!sel) return
    const iso = pointToISO(e.clientX, e.clientY)
    if (iso && iso !== sel.headISO) setSel(s => s ? { ...s, headISO: iso } : s)
  }

  const handlePointerUp = () => {
    if (edgeDrag) {
      const drag = edgeDrag
      setEdgeDrag(null)
      const orig = drag.edge === 'start' ? drag.period.start_date : drag.period.end_date
      if (!drag.moved || drag.dateISO === orig) {
        // Klikk uten dra → detaljpanel.
        if (!drag.moved) onPickPeriod(drag.period)
        return
      }
      void applyEdgeDrag(drag)
      return
    }
    if (!sel || !selRange) { setSel(null); return }
    const { lo, hi } = selRange
    setSel(null)
    if (brush === 'rolig' || brush === 'medium' || brush === 'hard' || brush === 'erase') {
      void applyPaint(lo, hi, brush === 'erase' ? 'erase' : brush)
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

  const granBtn = (g: Granularity, label: string): React.ReactNode => (
    <button key={g} type="button" onClick={() => { setGranularity(g); setSel(null); setEdgeDrag(null) }}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '12.5px',
        letterSpacing: '0.12em', textTransform: 'uppercase', borderRadius: 9,
        padding: '8px 13px', cursor: 'pointer', border: '1px solid var(--line2)',
        color: granularity === g ? '#fff' : '#8B8B95',
        background: granularity === g ? 'var(--accent)' : 'none',
      }}>
      {label}
    </button>
  )

  const inSel = (iso: string) => selRange != null && iso >= selRange.lo && iso <= selRange.hi

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
              ? granularity === 'uke'
                ? 'Velg pensel → dra over ukene (snapper man–søn). ✋ Velg åpner detaljer. Bytt til Dag for enkeltdager.'
                : 'Dag-modus: mal enkeltdager. ✋ på en periodekant = dra start/slutt dag for dag; klikk = detaljer.'
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
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.16em', color: '#55555F', textTransform: 'uppercase' }}>Presisjon</span>
            {granBtn('uke', 'Uke')}
            {granBtn('dag', 'Dag')}
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
        onPointerCancel={() => { setSel(null); setEdgeDrag(null) }}
        style={{
          touchAction: canEdit && (brush !== 'pick' || granularity === 'dag') ? 'none' : 'auto',
          opacity: busy ? 0.6 : 1, userSelect: 'none',
        }}>
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
                const p = periodForWeek(w, effectivePeriods)
                const color = p ? INTENSITY_COLOR[p.intensity] : null
                // A2: horisontalt segmentert celle-bakgrunn ved flere
                // belastninger i samme uke (dag-presis, ~26 % dekk).
                const cellGradient = granularity === 'uke'
                  ? weekIntensityGradient(effectivePeriods, w.mondayISO, '90deg', '42')
                  : null
                const isStartWeek = p != null && p.start_date >= w.mondayISO && p.start_date <= w.sundayISO
                const isToday = todayISO >= w.mondayISO && todayISO <= w.sundayISO
                const weekSelected = granularity === 'uke' && inSel(w.mondayISO)
                return (
                  <div key={w.idx} data-wk={w.idx}
                    style={{
                      position: 'relative', minHeight: granularity === 'dag' ? 52 : 46, borderRadius: 9,
                      border: `1px solid ${granularity === 'uke' && color ? `${color}8C` : 'var(--line)'}`,
                      background: cellGradient ?? 'var(--card2)',
                      cursor: canEdit ? 'pointer' : 'default',
                      outline: weekSelected ? '2px solid var(--accent)' : (isToday ? '2px solid var(--accent)' : 'none'),
                      outlineOffset: 1,
                      opacity: weekSelected ? 0.85 : 1,
                      padding: '4px 6px', overflow: 'visible',
                    }}>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11.5px',
                      letterSpacing: '0.06em', color: isToday ? 'var(--accent)' : '#55555F',
                      fontWeight: isToday ? 700 : 400,
                    }}>
                      U{w.weekNo}
                    </span>
                    {/* DAG-modus: 7 dag-ticks — dag-presis farge + kant-håndtak. */}
                    {granularity === 'dag' && (
                      <div className="flex mt-1" style={{ gap: 2 }}>
                        {Array.from({ length: 7 }, (_, di) => {
                          const iso = addDaysISO(w.mondayISO, di)
                          const outside = iso < season.start_date || iso > season.end_date
                          if (outside) {
                            return <span key={di} style={{ flex: 1, height: 16, borderRadius: 3, background: 'var(--line)', opacity: 0.25 }} />
                          }
                          const dp = periodForDay(iso, effectivePeriods)
                          const dc = dp ? INTENSITY_COLOR[dp.intensity] : null
                          const isEdge = dp != null && (iso === dp.start_date || iso === dp.end_date)
                          const daySel = inSel(iso)
                          return (
                            <span key={di} data-day={iso}
                              title={`${iso}${dp ? ` · ${dp.name}` : ''}`}
                              style={{
                                flex: 1, height: 16, borderRadius: 3,
                                background: dc ? `${dc}B3` : 'var(--line)',
                                outline: daySel ? '2px solid var(--accent)' : (iso === todayISO ? '1.5px solid var(--accent)' : 'none'),
                                outlineOffset: 0,
                                // Håndtak-hint: kant-dager markeres i ✋-modus.
                                boxShadow: isEdge && brush === 'pick' && canEdit ? 'inset 0 0 0 1.5px rgba(242,242,240,0.75)' : 'none',
                                cursor: isEdge && brush === 'pick' && canEdit ? 'ew-resize' : undefined,
                              }} />
                          )
                        })}
                      </div>
                    )}
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

      {edgeDrag && (
        <p className="mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--accent)' }}>
          {edgeDrag.edge === 'start' ? 'Ny start' : 'Ny slutt'}: {edgeDrag.dateISO} — slipp for å lagre
        </p>
      )}
    </div>
  )
}
