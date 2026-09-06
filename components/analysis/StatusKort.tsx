'use client'

// BOLK A (Trenerside v2 + statuskort, Sverre 6. sep) — «STATUS NÅ» øverst i
// Analyse → Oversikt. Fasit: design/xpulse-analyse-statuskort-design.html.
//
// Kortet ERSTATTER ingenting: alle dagens grafer og MetricCards ligger uendret
// under. Det regner heller ingenting nytt — tallene kommer fra getAnalysisOverview
// (tid/km/økter/soner) og getOversiktStatus (% av plan fra getPlanVsActual,
// skyting fra getShootingDepthAnalysis), hentet i SAMME kallpakke som fanen
// bruker fra før. Ingen boks etterlastes (regel 20).
//
// «Vis mindre ▴» kollapser til bare toppraden. Valget huskes i nettleseren, som
// de andre visningsvalgene i appen (tema, samlet/splittet, graf-visning).

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AnalysisOverview } from '@/app/actions/analysis'
import type { OversiktStatus } from '@/lib/oversikt-status-type'
import type { DateRange } from './date-range'
import { StarButton } from './StarButton'
import { hoyIntensitetSek } from '@/lib/activity-summary'
import { getOversiktStatus } from '@/app/actions/oversikt-status'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'

const FONT = "'Barlow Condensed', sans-serif"
const BEBAS = "'Bebas Neue', sans-serif"
const ORANSJE = '#FF4500'

const VIS_MINDRE_NOKKEL = 'xpulse-statuskort-mindre'
const VIS_MINDRE_HENDELSE = 'xpulse-statuskort-endret'

function lesKollapset(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(VIS_MINDRE_NOKKEL) === 'ja' } catch { return false }
}
function settKollapset(v: boolean): void {
  try { window.localStorage.setItem(VIS_MINDRE_NOKKEL, v ? 'ja' : 'nei') } catch { /* privat modus */ }
  window.dispatchEvent(new Event(VIS_MINDRE_HENDELSE))
}
function abonner(varsle: () => void) {
  window.addEventListener(VIS_MINDRE_HENDELSE, varsle)
  return () => window.removeEventListener(VIS_MINDRE_HENDELSE, varsle)
}

export function fmtTid(sek: number): string {
  const t = Math.floor(sek / 3600), m = Math.round((sek % 3600) / 60)
  return t > 0 ? `${t}:${String(m).padStart(2, '0')}` : `${m} min`
}
function fmtKm(meter: number): string {
  if (meter <= 0) return '—'
  const km = meter / 1000
  return km >= 100 ? String(Math.round(km)) : (Math.round(km * 10) / 10).toFixed(1).replace('.', ',')
}
function fmtEndring(pct: number | null): string | null {
  if (pct == null || !isFinite(pct)) return null
  const rundet = Math.round(pct)
  return `${rundet > 0 ? '+' : ''}${rundet} % mot forrige`
}
function fmtMin(min: number): string {
  const t = Math.floor(min / 60), m = Math.round(min % 60)
  return t > 0 ? `${t}:${String(m).padStart(2, '0')}` : `${m} min`
}

/** Én celle i toppraden. */
function Tall({ etikett, verdi, enhet, under, farge }: {
  etikett: string; verdi: string; enhet?: string; under?: string | null; farge?: string
}) {
  return (
    <div data-status-tall={etikett} style={{ background: 'var(--card)', padding: '11px 13px', minWidth: 0 }}>
      <small style={{ display: 'block', fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>{etikett}</small>
      <strong style={{ display: 'block', whiteSpace: 'nowrap', fontFamily: BEBAS, fontSize: 30, lineHeight: 1.1, letterSpacing: '0.02em', marginTop: 2, color: farge ?? 'var(--tekst-1-app)' }}>
        {verdi}
        {enhet && <em style={{ fontStyle: 'normal', fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-app)', letterSpacing: '0.08em', marginLeft: 3 }}>{enhet}</em>}
      </strong>
      {under && <span style={{ display: 'block', fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-app)', marginTop: 2 }}>{under}</span>}
    </div>
  )
}

export interface StatusKortProps {
  overview: AnalysisOverview
  status: OversiktStatus | null
  range: DateRange
  harSkiskyting: boolean
  targetUserId?: string
}

export function StatusKort({ overview, status, range, harSkiskyting }: StatusKortProps) {
  const kollapset = useSyncExternalStore(abonner, lesKollapset, () => false)
  const n = overview.current

  const hardSek = (n.zone_seconds.I3 ?? 0) + hoyIntensitetSek(n.zone_seconds)
  const hardAndel = n.total_seconds > 0 ? Math.round((hardSek / n.total_seconds) * 100) : null

  const plan = status?.plan ?? null
  const planPct = plan && plan.harPlan && plan.planTimerMin > 0
    ? Math.round((plan.faktiskTimerMin / plan.planTimerMin) * 100)
    : null

  const skyting = harSkiskyting ? status?.skyting ?? null : null
  const dager = overview.rangeDays

  return (
    <section data-status-kort data-status-kollapset={kollapset ? '1' : undefined}
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '20px 22px 18px' }}>
      <div className="flex items-start gap-4 flex-wrap" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>
            Analyse · Oversikt
          </span>
          <h2 data-status-tittel style={{ fontFamily: BEBAS, fontSize: 40, lineHeight: 1, letterSpacing: '0.03em', margin: '4px 0', color: 'var(--tekst-1-app)' }}>
            STATUS NÅ
          </h2>
          <div style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-5-app)', display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
            <span>{range.from} – {range.to}</span>
            <span>·</span>
            <span>{dager} dager</span>
          </div>
        </div>
        <div className="flex items-center gap-3" style={{ marginLeft: 'auto' }}>
          <StarButton chartKey="oversikt_status_kort" title="Statuskortet" />
          <button type="button" data-status-bryter onClick={() => settKollapset(!kollapset)}
            style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANSJE, background: 'none', border: 'none', cursor: 'pointer', minHeight: 36 }}>
            {kollapset ? 'Vis mer ▾' : 'Vis mindre ▴'}
          </button>
        </div>
      </div>

      <div data-status-topprad className="xp-status-kpi"
        style={{ display: 'grid', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        <Tall etikett="Tid" verdi={fmtTid(n.total_seconds)} under={fmtEndring(overview.percent_changes.total_seconds)} />
        <Tall etikett="Distanse" verdi={fmtKm(n.total_meters)} enhet={n.total_meters > 0 ? 'km' : undefined} under={fmtEndring(overview.percent_changes.total_meters)} />
        <Tall etikett="Økter" verdi={String(n.workout_count)} under={n.planned_count > 0 ? `${n.planned_count} planlagt` : null} />
        <Tall etikett="Hard I3+" verdi={hardSek > 0 ? fmtTid(hardSek) : '—'} under={hardAndel != null && hardSek > 0 ? `${hardAndel} % av tida` : null} />
        <Tall etikett="% av plan" verdi={planPct != null ? String(planPct) : '—'} enhet={planPct != null ? '%' : undefined}
          under={plan && plan.harPlan ? `${fmtMin(plan.faktiskTimerMin)} av ${fmtMin(plan.planTimerMin)}` : 'Ingen plan i perioden'} />
        {harSkiskyting && (
          <Tall etikett="Skudd · treff" verdi={skyting ? String(skyting.skudd) : '—'}
            under={skyting?.treffPct != null ? `${skyting.treffPct} % treff` : skyting ? 'Treff ikke ført' : 'Ingen skyting i perioden'} />
        )}
      </div>
    </section>
  )
}

/** Favoritter-fanen: kortet alene. Der finnes ikke fanens kallpakke, så det ene
 *  statuskallet gjøres her — fortsatt ÉN henting for hele kortet, aldri per boks. */
export function StatusKortSelvhentende({ overview, range, targetUserId }: {
  overview: AnalysisOverview
  range: DateRange
  targetUserId?: string
}) {
  const [status, setStatus] = useState<OversiktStatus | null>(null)
  const harSkiskyting = useHarSkiskyting()
  useEffect(() => {
    let live = true
    getOversiktStatus(range.from, range.to, null, targetUserId).then(r => {
      if (live && !('error' in r)) setStatus(r)
    }).catch(() => {})
    return () => { live = false }
  }, [range.from, range.to, targetUserId])
  return <StatusKort overview={overview} status={status} range={range} harSkiskyting={harSkiskyting} targetUserId={targetUserId} />
}
