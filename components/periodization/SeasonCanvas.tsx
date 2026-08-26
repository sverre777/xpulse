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
  type Season, type SeasonPeriod, type SeasonMarking, type SeasonKeyDate,
  type KeyEventType, type Intensity, type PeriodInput,
} from '@/app/actions/seasons'
import { INTENSITY_COLOR, weekIntensityGradient } from '@/lib/periodization-overlay'
import { xpConfirm } from '@/components/ui/ConfirmDialog'

const INTENSITY_LABEL: Record<Intensity, string> = {
  rolig: 'Rolig', medium: 'Medium', hard: 'Hard',
}

type StampBrush = 'stamp_a' | 'stamp_b' | 'stamp_c' | 'stamp_testlop' | 'stamp_test' | 'stamp_peak'
type Brush = 'pick' | 'erase' | 'samling' | StampBrush | Intensity
type Granularity = 'uke' | 'dag'

// G2: stempel → nøkkeldato-type (⭐ peak = A-konkurranse m/ form-topp-flagg).
const STAMPS: { brush: StampBrush; icon: string; label: string; eventType: KeyEventType; peak: boolean }[] = [
  { brush: 'stamp_a',    icon: '🏆', label: 'A',    eventType: 'competition_a', peak: false },
  { brush: 'stamp_b',    icon: '🏅', label: 'B',    eventType: 'competition_b', peak: false },
  { brush: 'stamp_c',    icon: '📊', label: 'C',    eventType: 'competition_c', peak: false },
  { brush: 'stamp_testlop', icon: '⏱', label: 'Testløp', eventType: 'testlop', peak: false },
  { brush: 'stamp_test', icon: '🧪', label: 'Test', eventType: 'test',          peak: false },
  { brush: 'stamp_peak', icon: '⭐', label: 'Peak', eventType: 'competition_a', peak: true },
]
const KEY_ICON: Record<string, string> = {
  competition_a: '🏆', competition_b: '🏅', competition_c: '📊',
  testlop: '⏱', test: '🧪', camp: '📍', other: '⚑',
}
const PEAK_CELL_GLOW = '0 0 8px rgba(212, 160, 23, 0.6)'

// Del B: markeringsbånd (📍 samling / 🏔 høyde) — gull-aktig overlay OVER
// cellene, aldri cellebakgrunn. Egen farge-identitet, skilles fra medium-
// belastning ved posisjon (tynt bånd) + ramme.
const MARKING_BAND_BG = 'rgba(212, 160, 23, 0.30)'
const MARKING_BAND_BORDER = 'rgba(212, 160, 23, 0.8)'

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
    targetUserId,
    ...overrides,
  }
}

// Del F: injiserbare mutasjoner — samme lerret/logikk (maling, trim/splitt/
// merge, kant-dra) kan operere på server-actions (sesong) ELLER lokal
// mal-tilstand (relativ modus i mal-byggeren). Én kodebane.
export interface CanvasPeriodMutators {
  create: (input: PeriodInput) => Promise<{ id?: string; error?: string }>
  update: (id: string, input: PeriodInput) => Promise<{ error?: string }>
  remove: (id: string) => Promise<{ error?: string }>
}

const REL_DAYS = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn']

export function SeasonCanvas({ season, periods, markings, targetUserId, canEdit, onPickPeriod, onPickMarking, onDrawMarking, relative = false, mutators, keyDates = [], onStampDay, onPickKeyDate }: {
  season: Season
  periods: SeasonPeriod[]
  markings: SeasonMarking[]
  targetUserId?: string
  canEdit: boolean
  onPickPeriod: (p: SeasonPeriod) => void
  // ✋ på et markeringsbånd → detaljpanel (rediger/slett).
  onPickMarking: (m: SeasonMarking) => void
  // Samling-verktøy: dra grovt spenn → forhåndsutfylt modal.
  onDrawMarking: (startISO: string, endISO: string) => void
  // Del F: relativ modus (mal) — U1..UN i stedet for ISO-uker/månedsnavn,
  // ingen «i dag»-markering; datoene er syntetiske (anker-mandag).
  relative?: boolean
  mutators?: CanvasPeriodMutators
  // G2: nøkkeldato-stempler. Vises/aktiveres kun når onStampDay er satt —
  // mal-lerretet (relativ) sender den ikke (nøkkeldatoer redigeres der som
  // relative rader; KeyDateModal er dato-bundet/server-koblet).
  keyDates?: SeasonKeyDate[]
  onStampDay?: (dateISO: string, eventType: KeyEventType, peak: boolean) => void
  onPickKeyDate?: (k: SeasonKeyDate) => void
}) {
  const router = useRouter()
  const createP = mutators
    ? mutators.create
    : (input: PeriodInput) => createPeriod(input)
  const updateP = mutators
    ? mutators.update
    : (id: string, input: PeriodInput) => updatePeriod(id, input)
  const removeP = mutators
    ? mutators.remove
    : (id: string) => deletePeriod(id, targetUserId)
  // Server er sannhet i sesong-modus; mal-modus eier egen tilstand.
  const commit = () => { if (!mutators) router.refresh() }
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
  // Relativ modus: ingen «i dag» (syntetisk tidslinje).
  const todayISO = relative ? '0000-00-00' : toISO(new Date())

  const rows: { label: string; cells: WeekCell[] }[] = []
  if (relative) {
    // U1..UN i kvartalsrader (13 uker per rad) i stedet for månedsnavn.
    for (const w of weeks) {
      const last = rows[rows.length - 1]
      if (last && last.cells.length < 13) {
        last.cells.push(w)
        last.label = `U${last.cells[0].idx + 1}–${w.idx + 1}`
      } else {
        rows.push({ label: `U${w.idx + 1}`, cells: [w] })
      }
    }
  } else {
    for (const w of weeks) {
      const last = rows[rows.length - 1]
      if (last && last.cells[0].monthIdx === w.monthIdx) last.cells.push(w)
      else rows.push({ label: MONTHS_SHORT[w.monthIdx], cells: [w] })
    }
  }
  const weekLabel = (w: WeekCell) => relative ? w.idx + 1 : w.weekNo
  // Relativ dag-etikett («U3 ons») — ankeret er mandag, så offset%7 = ukedag.
  const dayLabel = (iso: string) => {
    if (!relative) return iso
    const o = Math.round((parseISO(iso).getTime() - parseISO(season.start_date).getTime()) / 86400000)
    return `U${Math.floor(o / 7) + 1} ${REL_DAYS[((o % 7) + 7) % 7]}`
  }
  const spanLabel = (a: string, b: string) => relative ? `${dayLabel(a)} – ${dayLabel(b)}` : `${a} → ${b}`

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
        const res = await removeP(p.id)
        if (res.error) throw new Error(res.error)
      }
      for (const p of splits) {
        const origEnd = p.end_date
        const resA = await updateP(p.id, periodToInput(p, { end_date: addDaysISO(rangeStart, -1) }, targetUserId))
        if (resA.error) throw new Error(resA.error)
        const resB = await createP(periodToInput(p, {
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
          const res = await updateP(p.id, periodToInput(p, { end_date: addDaysISO(rangeStart, -1) }, targetUserId))
          if (res.error) throw new Error(res.error)
          leftNeighbor = p
        } else {
          const res = await updateP(p.id, periodToInput(p, { start_date: addDaysISO(rangeEnd, 1) }, targetUserId))
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
          const res = await updateP(leftAdj.id, periodToInput(leftAdj, { end_date: newEnd }, targetUserId))
          if (res.error) throw new Error(res.error)
          if (rightAdj) {
            const res2 = await removeP(rightAdj.id)
            if (res2.error) throw new Error(res2.error)
          }
        } else if (rightAdj) {
          const res = await updateP(rightAdj.id, periodToInput(rightAdj, { start_date: rangeStart }, targetUserId))
          if (res.error) throw new Error(res.error)
        } else {
          const wLo = weeks.find(w => rangeStart >= w.mondayISO && rangeStart <= w.sundayISO)
          const wHi = weeks.find(w => rangeEnd >= w.mondayISO && rangeEnd <= w.sundayISO)
          const res = await createP({
            season_id: season.id,
            name: wLo && wHi
              ? (weekLabel(wLo) === weekLabel(wHi) ? `${INTENSITY_LABEL[paint]} uke ${weekLabel(wLo)}` : `${INTENSITY_LABEL[paint]} uke ${weekLabel(wLo)}–${weekLabel(wHi)}`)
              : INTENSITY_LABEL[paint],
            start_date: rangeStart,
            end_date: rangeEnd,
            intensity: paint,
            targetUserId,
          })
          if (res.error) throw new Error(res.error)
        }
      }
      commit()
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
    const res = await updateP(p.id, periodToInput(p, override, targetUserId))
    if (res.error) setError(res.error)
    else commit()
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
    // ✋ på stempel/markeringsbånd åpner rediger — sjekkes FØR celle-logikk
    // (elementene har pointer-events kun i ✋-modus).
    if (brush === 'pick') {
      const kEl = (e.target as HTMLElement).closest?.('[data-keydate]')
      if (kEl && onPickKeyDate) {
        const k = keyDates.find(x => x.id === (kEl as HTMLElement).dataset.keydate)
        if (k) { onPickKeyDate(k); return }
      }
      const mEl = (e.target as HTMLElement).closest?.('[data-marking]')
      if (mEl) {
        const m = markings.find(x => x.id === (mEl as HTMLElement).dataset.marking)
        if (m) { onPickMarking(m); return }
      }
    }
    const iso = pointToISO(e.clientX, e.clientY)
    if (!iso) return
    // G2: stempel-pensel — ett klikk på dag/uke → KeyDateModal forhåndsutfylt
    // (uke-modus bruker mandagen; datoen justeres i modalen).
    const stamp = STAMPS.find(s => s.brush === brush)
    if (stamp) {
      onStampDay?.(iso, stamp.eventType, stamp.peak)
      return
    }
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
    if (brush === 'samling') {
      // Grovt spenn tegnet → forhåndsutfylt modal (dag-presis finjustering der).
      onDrawMarking(lo, hi)
      return
    }
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
        minHeight: 40,
        border: '1px solid var(--line2)',
        color: brush === b ? 'var(--tekst-1-ren)' : 'var(--mut)',
        background: brush === b ? (sw ?? 'var(--flate-17)') : 'none',
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
        minHeight: 40,
        color: granularity === g ? 'var(--tekst-1-ren)' : 'var(--mut)',
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
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.09em', color: 'var(--ink)', fontWeight: 400 }}>
            Mal sesongen
          </h2>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14.5px', color: 'var(--tekst-8-alt)', marginTop: 2 }}>
            {canEdit
              ? granularity === 'uke'
                ? 'Velg pensel → dra over ukene (snapper man–søn). 📍 tegner samling/høyde-bånd over lagene. ✋ Velg åpner detaljer (også på bånd). Bytt til Dag for enkeltdager.'
                : 'Dag-modus: mal enkeltdager. 📍 tegner samling/høyde-bånd. ✋ på en periodekant = dra start/slutt dag for dag; klikk = detaljer (også på bånd).'
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
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.16em', color: 'var(--tekst-8-alt)', textTransform: 'uppercase' }}>Belastning</span>
            {toolBtn('rolig', 'Rolig', INTENSITY_COLOR.rolig)}
            {toolBtn('medium', 'Medium', INTENSITY_COLOR.medium)}
            {toolBtn('hard', 'Hard', INTENSITY_COLOR.hard)}
          </div>
          <div className="flex gap-2 items-center p-2" style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card2)' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.16em', color: 'var(--tekst-8-alt)', textTransform: 'uppercase' }}>Markering</span>
            {toolBtn('samling', '📍 Samling/høyde', '#D4A017')}
          </div>
          {onStampDay && (
            <div className="flex gap-2 items-center p-2 flex-wrap" style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card2)' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.16em', color: 'var(--tekst-8-alt)', textTransform: 'uppercase' }}>Nøkkeldato</span>
              {STAMPS.map(s => toolBtn(s.brush, `${s.icon} ${s.label}`))}
            </div>
          )}
          <div className="flex gap-2 items-center p-2" style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card2)' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.16em', color: 'var(--tekst-8-alt)', textTransform: 'uppercase' }}>Presisjon</span>
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
        {/* G1 (mobil): celler har MINSTE bredde (44px i dag-modus for
            treffbare ticks, 30px i uke) — rader bredere enn skjermen
            scroller horisontalt (relativ modus: 13 celler/rad). paddingTop
            hindrer at pname-badges (top:-9) klippes av scroll-containeren;
            radetiketten er sticky venstre. Maling låser scroll via
            touchAction:none over. */}
        <div style={{ overflowX: 'auto', paddingTop: 12 }}>
        {rows.map((row, ri) => (
          <div key={ri} className="flex items-stretch gap-2 mb-1.5">
            <div style={{
              flex: '0 0 40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Bebas Neue', sans-serif", fontSize: relative ? 12 : 14, letterSpacing: '0.06em',
              color: 'var(--tekst-8-alt)', borderRight: '1px solid var(--line)',
              position: 'sticky', left: 0, zIndex: 3, background: 'var(--card)',
            }}>
              {row.label}
            </div>
            <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.cells.length}, minmax(${granularity === 'dag' ? 44 : 30}px, 1fr))` }}>
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
                // G2: nøkkeldato-stempler i uka + gull-glød ved form-topp-mål.
                const weekKeyDates = keyDates.filter(k => k.event_date >= w.mondayISO && k.event_date <= w.sundayISO)
                const hasPeak = weekKeyDates.some(k => k.is_peak_target)
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
                      boxShadow: hasPeak ? PEAK_CELL_GLOW : undefined,
                    }}>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11.5px',
                      letterSpacing: '0.06em', color: isToday ? 'var(--accent)' : 'var(--tekst-8-alt)',
                      fontWeight: isToday ? 700 : 400,
                    }}>
                      U{weekLabel(w)}
                    </span>
                    {/* G2: stempler (🏆/🏅/📊/🧪, ⭐ = peak) — ✋ åpner
                        KeyDateModal for redigering. */}
                    {weekKeyDates.length > 0 && (
                      <span style={{ position: 'absolute', top: 2, right: 4, display: 'flex', gap: 1, zIndex: 2, fontSize: 10, lineHeight: 1 }}>
                        {weekKeyDates.slice(0, 3).map(k => (
                          <span key={k.id} data-keydate={k.id}
                            title={`${k.is_peak_target ? '⭐ ' : ''}${KEY_ICON[k.event_type] ?? '⚑'} ${k.name} · ${k.event_date}`}
                            style={{
                              cursor: canEdit && brush === 'pick' ? 'pointer' : undefined,
                              pointerEvents: canEdit && brush === 'pick' ? 'auto' : 'none',
                              filter: k.is_peak_target ? 'drop-shadow(0 0 3px rgba(212,160,23,0.9))' : undefined,
                            }}>
                            {k.is_peak_target ? '⭐' : (KEY_ICON[k.event_type] ?? '⚑')}
                          </span>
                        ))}
                        {weekKeyDates.length > 3 && (
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)', fontSize: 9 }}>
                            +{weekKeyDates.length - 3}
                          </span>
                        )}
                      </span>
                    )}
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
                              title={`${relative ? `U${weekLabel(w)} ${REL_DAYS[di]}` : iso}${dp ? ` · ${dp.name}` : ''}`}
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
                    {/* Del B: markeringsbånd (📍/🏔) — overlay OVER cellen,
                        dag-presis bredde (delvis uke = delvis bånd), kapsel-
                        avrunding der markeringen starter/slutter. ✋ = rediger. */}
                    {markings
                      .filter(m => m.start_date <= w.sundayISO && m.end_date >= w.mondayISO)
                      .map((m, mi) => {
                        const s = maxISO(m.start_date, w.mondayISO)
                        const e = minISO(m.end_date, w.sundayISO)
                        const startIdx = Math.round((parseISO(s).getTime() - parseISO(w.mondayISO).getTime()) / 86400000)
                        const len = Math.round((parseISO(e).getTime() - parseISO(s).getTime()) / 86400000) + 1
                        const startsHere = m.start_date >= w.mondayISO
                        const endsHere = m.end_date <= w.sundayISO
                        const pickable = canEdit && brush === 'pick'
                        return (
                          <span key={m.id} data-marking={m.id}
                            title={`${m.is_training_camp ? '📍 ' : ''}${m.is_altitude ? '🏔 ' : ''}${m.name}${m.location ? ` · ${m.location}` : ''}${m.altitude_meters ? ` · ${m.altitude_meters} moh` : ''} (${spanLabel(m.start_date, m.end_date)})`}
                            style={{
                              position: 'absolute', bottom: 2 + mi * 9, height: 7, zIndex: 2,
                              left: `${(startIdx / 7) * 100}%`, width: `${(len / 7) * 100}%`,
                              background: MARKING_BAND_BG,
                              border: `1px solid ${MARKING_BAND_BORDER}`,
                              borderRadius: startsHere && endsHere ? 4 : startsHere ? '4px 0 0 4px' : endsHere ? '0 4px 4px 0' : 0,
                              pointerEvents: pickable ? 'auto' : 'none',
                              cursor: pickable ? 'pointer' : undefined,
                            }} />
                        )
                      })}
                    {isStartWeek && p && (
                      <span style={{
                        position: 'absolute', top: -9, left: 5, zIndex: 2,
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10.5, fontWeight: 700,
                        letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                        background: 'var(--flate-3, var(--flate-3))', borderRadius: 5, padding: '1px 6px',
                        color: color ?? 'var(--mut)', border: `1px solid ${color ? `${color}80` : 'var(--line2)'}`,
                        maxWidth: '160%', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.name}
                      </span>
                    )}
                    {/* B2: 📍/🏔 vises av markeringsbåndene — periode-flaggene
                        leses ikke lenger i lerretet. */}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        </div>
      </div>

      {edgeDrag && (
        <p className="mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--accent)' }}>
          {edgeDrag.edge === 'start' ? 'Ny start' : 'Ny slutt'}: {dayLabel(edgeDrag.dateISO)} — slipp for å lagre
        </p>
      )}
    </div>
  )
}
