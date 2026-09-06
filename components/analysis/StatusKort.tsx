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
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import type { AnalysisOverview } from '@/app/actions/analysis'
import type { OversiktStatus } from '@/lib/oversikt-status-type'
import type { DateRange } from './date-range'
import { StarButton } from './StarButton'
import { XpTooltip, CHART_LINE_WIDTH } from './chart-theme'
import { hoyIntensitetSek } from '@/lib/activity-summary'
import { getOversiktStatus } from '@/app/actions/oversikt-status'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'

const FONT = "'Barlow Condensed', sans-serif"
const BEBAS = "'Bebas Neue', sans-serif"
const ORANSJE = '#FF4500'
const GRONN = '#28A86E'
const BLAA = '#1A6FD4'
const GULL = '#D4A017'
const ROD = '#E11D48'

/** Formsone-tekstene er de samme som i Belastning-fanen. */
const FORM_TEKST: Record<string, string> = {
  detrained: 'Uthvilt / lite belastning',
  optimal: 'Optimal form',
  neutral: 'Nøytral',
  hoy_belastning: 'Høy belastning',
  overtrent: 'Svært høy belastning',
}
const FORM_FARGE: Record<string, string> = {
  detrained: BLAA, optimal: GRONN, neutral: 'var(--tekst-1-app)', hoy_belastning: GULL, overtrent: ROD,
}

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

/** Boks med overskrift, stjerne og nøkkel — som i fasiten. */
function Boks({ tittel, nokkel, undertittel, children }: {
  tittel: string; nokkel: string; undertittel?: string; children: React.ReactNode
}) {
  return (
    <div data-status-boks={nokkel} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', minWidth: 0 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>{tittel}</span>
        <span style={{ marginLeft: 'auto' }}><StarButton chartKey={nokkel} size={16} title={tittel} /></span>
      </div>
      {undertittel && <div style={{ fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-8-app)', margin: '-4px 0 8px' }}>{undertittel}</div>}
      {children}
    </div>
  )
}

/** Tom tilstand: sier hva som mangler, aldri 0 (fasitens variant 2). */
function Tom({ tekst, lenke, lenkeTekst }: { tekst: string; lenke?: string; lenkeTekst?: string }) {
  return (
    <div data-status-tom style={{ padding: '14px 0 6px', color: 'var(--tekst-5-app)', fontFamily: FONT, fontSize: 13.5 }}>
      {tekst}
      {lenke && (
        <a href={lenke} style={{ display: 'inline-block', marginLeft: 6, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANSJE, textDecoration: 'none' }}>
          {lenkeTekst ?? 'Åpne →'}
        </a>
      )}
    </div>
  )
}

/** Liten tallrad inne i en boks (3 kolonner). */
function Smaatall({ celler }: { celler: { etikett: string; verdi: string; under?: string | null; farge?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${celler.length}, minmax(0, 1fr))`, gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      {celler.map(c => (
        <div key={c.etikett} data-status-smaatall={c.etikett} style={{ background: 'var(--card)', padding: '8px 10px', minWidth: 0 }}>
          <small style={{ display: 'block', fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>{c.etikett}</small>
          <strong style={{ display: 'block', whiteSpace: 'nowrap', fontFamily: BEBAS, fontSize: 21, lineHeight: 1.1, letterSpacing: '0.02em', marginTop: 2, color: c.farge ?? 'var(--tekst-1-app)' }}>{c.verdi}</strong>
          {c.under && <span style={{ display: 'block', fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-app)' }}>{c.under}</span>}
        </div>
      ))}
    </div>
  )
}

/** Belastning: CTL/ATL/TSB + 12-ukers kurve. Samme tall og farger som Belastning-fanen. */
function BelastningBoks({ status, konkurranser }: { status: OversiktStatus | null; konkurranser: string[] }) {
  const b = status?.belastning ?? null
  return (
    <Boks tittel="Belastning" nokkel="oversikt_status_belastning" undertittel={b ? 'CTL · ATL · TSB — 12 uker' : undefined}>
      {!b ? <Tom tekst="For lite data — belastning krever minst 14 dager med førte økter." /> : (
        <>
          <Smaatall celler={[
            { etikett: 'CTL · form', verdi: String(b.ctl), under: b.ctlEndring != null ? `${b.ctlEndring > 0 ? '+' : ''}${b.ctlEndring} siste uke` : null },
            { etikett: 'ATL · trøtthet', verdi: String(b.atl), under: b.atlEndring != null ? `${b.atlEndring > 0 ? '+' : ''}${b.atlEndring}` : null },
            { etikett: 'TSB · overskudd', verdi: `${b.tsb > 0 ? '+' : ''}${b.tsb}`, under: FORM_TEKST[b.formStatus] ?? null, farge: FORM_FARGE[b.formStatus] ?? undefined },
          ]} />
          <div data-status-belastningskurve style={{ height: 96, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={b.daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip content={<XpTooltip />} />
                <ReferenceLine y={0} stroke="var(--line2)" />
                {konkurranser.map(d => <ReferenceLine key={d} x={d} stroke={GULL} strokeDasharray="3 3" />)}
                <Line type="monotone" dataKey="ctl" name="CTL" stroke={BLAA} strokeWidth={CHART_LINE_WIDTH} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="atl" name="ATL" stroke={ORANSJE} strokeWidth={CHART_LINE_WIDTH} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="tsb" name="TSB" stroke={GRONN} strokeWidth={CHART_LINE_WIDTH} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6, fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-8-app)' }}>
            <span><b style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: BLAA, marginRight: 5 }} />CTL</span>
            <span><b style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ORANSJE, marginRight: 5 }} />ATL</span>
            <span><b style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: GRONN, marginRight: 5 }} />TSB</span>
            {konkurranser.length > 0 && <span><b style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: GULL, marginRight: 5 }} />konkurranse</span>}
          </div>
        </>
      )}
    </Boks>
  )
}

/** Helse 30 dager. Egen delingsregel: uten samtykke sier boksen «ikke delt». */
function HelseBoks({ status, canSeeHealthData }: { status: OversiktStatus | null; canSeeHealthData: boolean }) {
  const h = status?.helse ?? null
  const diff = (naa: number | null, forrige: number | null, enhet = '') => (
    naa != null && forrige != null ? `${naa - forrige > 0 ? '+' : ''}${Math.round((naa - forrige) * 10) / 10}${enhet} mot forrige` : null
  )
  const sovn = (min: number | null) => (min == null ? '—' : `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`)
  return (
    <Boks tittel="Helse · 30 dager" nokkel="oversikt_status_helse" undertittel={h && h.dagerMedData > 0 ? `${h.dagerMedData} dager med data` : undefined}>
      {!canSeeHealthData ? <Tom tekst="Helsedata er ikke delt med deg." />
        : !h || h.dagerMedData === 0 ? <Tom tekst="Ingen helsedata ført." lenke="/app/health/hrv" lenkeTekst="Logg helse →" /> : (
        <>
          <Smaatall celler={[
            { etikett: 'HRV snitt', verdi: h.hrvSnitt != null ? String(h.hrvSnitt) : '—', under: diff(h.hrvSnitt, h.hrvForrige, ' ms') },
            { etikett: 'Hvilepuls', verdi: h.hvilepulsSnitt != null ? String(h.hvilepulsSnitt) : '—', under: diff(h.hvilepulsSnitt, h.hvilepulsForrige) },
            { etikett: 'Søvn', verdi: sovn(h.sovnMinSnitt), under: h.sovnMinForrige != null ? `forrige ${sovn(h.sovnMinForrige)}` : null },
          ]} />
          <div data-status-helsekurve style={{ height: 96, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={h.serie} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['dataMin - 4', 'dataMax + 4']} />
                <Tooltip content={<XpTooltip />} />
                {h.hrvSnitt != null && <ReferenceLine y={h.hrvSnitt} stroke="var(--line2)" strokeDasharray="4 4" />}
                <Line type="monotone" dataKey="hrv" name="HRV" stroke={GRONN} strokeWidth={CHART_LINE_WIDTH} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="hvilepuls" name="Hvilepuls" stroke="#E23A5A" strokeWidth={CHART_LINE_WIDTH} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6, fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-8-app)' }}>
            <span><b style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: GRONN, marginRight: 5 }} />HRV</span>
            <span><b style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#E23A5A', marginRight: 5 }} />Hvilepuls</span>
            <span>stiplet = snitt</span>
          </div>
        </>
      )}
    </Boks>
  )
}

export interface StatusKortProps {
  overview: AnalysisOverview
  status: OversiktStatus | null
  range: DateRange
  harSkiskyting: boolean
  canSeeHealthData?: boolean
  targetUserId?: string
}

export function StatusKort({ overview, status, range, harSkiskyting, canSeeHealthData = true }: StatusKortProps) {
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
  // Gule merker på belastningskurven: konkurransene i perioden (samme liste som fanen viser).
  // Ingen useMemo — react-compileren memoiserer selv, og en manuell wrapper her
  // brøt kompileringen («Existing memoization could not be preserved»).
  const konkurranser = overview.current.competitions.map(k => k.date)

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

      {!kollapset && (
        <div data-status-bokser className="xp-status-bokser" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <BelastningBoks status={status} konkurranser={konkurranser} />
          <HelseBoks status={status} canSeeHealthData={canSeeHealthData} />
        </div>
      )}
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
