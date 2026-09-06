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

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import type { AnalysisOverview, MovementBreakdownRow } from '@/app/actions/analysis'
import type { OversiktStatus } from '@/lib/oversikt-status-type'
import type { DateRange } from './date-range'
import { StarButton } from './StarButton'
import { XpTooltip, CHART_LINE_WIDTH, movementColor } from './chart-theme'
import { ZoneBar } from '@/components/oversikt/kort-deler'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ALL_ZONE_NAMES } from '@/lib/heart-zones'
import { STATUS_GRONN, STATUS_ROD, KONKURRANSE_GULL, TRENER_BLAA, planPctFarge, PLAN_SKALA_MAKS } from '@/lib/status-farger'
import type { OversiktZoneSeconds } from '@/app/actions/oversikt'
import type { StatusOkt } from '@/lib/oversikt-status-type'
import { hoyIntensitetSek } from '@/lib/activity-summary'
import { getOversiktStatus } from '@/app/actions/oversikt-status'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'

const FONT = "'Barlow Condensed', sans-serif"
const BEBAS = "'Bebas Neue', sans-serif"
const ORANSJE = '#FF4500'
// Statusfargene ligger i lib/status-farger (én kilde — samme skala i trenerlista).
const GRONN = STATUS_GRONN
const BLAA = TRENER_BLAA
const GULL = KONKURRANSE_GULL
const ROD = STATUS_ROD

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

// Stjernene hører til analysens favoritter. I trenerens detaljpanel (bolk B1) er
// boksene en visning av UTØVERENS tall — der skal ingen stjerne kunne trykkes.
const StjerneKontekst = createContext(true)

/** Boks med overskrift, stjerne og nøkkel — som i fasiten. */
function Boks({ tittel, nokkel, undertittel, children }: {
  tittel: string; nokkel: string; undertittel?: string; children: React.ReactNode
}) {
  const visStjerne = useContext(StjerneKontekst)
  return (
    <div data-status-boks={nokkel} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', minWidth: 0 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>{tittel}</span>
        {visStjerne && <span style={{ marginLeft: 'auto' }}><StarButton chartKey={nokkel} size={16} title={tittel} /></span>}
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

function fmtDato(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  return dt.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Metalinja under en økttittel: dato · varighet · sone · km · treff. */
function OktMeta({ o }: { o: StatusOkt }) {
  const deler: React.ReactNode[] = [
    <span key="d">{fmtDato(o.dato)}{o.klokkeslett ? ` · ${o.klokkeslett.slice(0, 5)}` : ''}</span>,
    <b key="v" style={{ color: 'var(--tekst-1-app)', fontWeight: 500 }}>{fmtTid(o.varighetSek)}</b>,
  ]
  if (o.hovedsone) deler.push(
    <span key="s" style={{ display: 'inline-block', padding: '0 6px', borderRadius: 999, border: `1px solid ${ZONE_COLORS_V2[o.hovedsone as keyof typeof ZONE_COLORS_V2] ?? 'var(--line2)'}`, color: ZONE_COLORS_V2[o.hovedsone as keyof typeof ZONE_COLORS_V2] ?? 'var(--tekst-5-app)', fontFamily: FONT, fontWeight: 700, fontSize: 11, lineHeight: '17px' }}>{o.hovedsone}</span>,
  )
  if (o.meter > 0) deler.push(<span key="km">{fmtKm(o.meter)} km</span>)
  if (o.treffPct != null) deler.push(<span key="t">🎯 {o.treffPct} %</span>)
  return (
    <div style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-5-app)', display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center' }}>
      {deler.map((d, i) => <span key={i} style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>{i > 0 && <span style={{ opacity: 0.5 }}>·</span>}{d}</span>)}
    </div>
  )
}

function OktTittel({ tekst }: { tekst: string }) {
  return <div style={{ fontFamily: BEBAS, fontSize: 24, lineHeight: 1, letterSpacing: '0.03em', margin: '2px 0 5px', color: 'var(--tekst-1-app)' }}>{tekst}</div>
}

/** Siste hardøkt: tittel, nøkkeltall og sonestripa — samme tall som øktkortene på Hjem. */
function SisteHardBoks({ status }: { status: OversiktStatus | null }) {
  const o = status?.okter?.sisteHard ?? null
  const siste = status?.okter?.sisteOkt ?? null
  return (
    <Boks tittel="Siste hardøkt" nokkel="oversikt_status_siste_hard">
      {!o ? (
        <Tom tekst={siste ? `Ingen hardøkt de siste 14 dagene. Siste økt: ${siste.tittel} (${fmtDato(siste.dato)}).` : 'Ingen økter ført de siste 14 dagene.'} />
      ) : (
        <>
          <OktTittel tekst={o.tittel} />
          <OktMeta o={o} />
          <div style={{ margin: '8px 0 2px' }}><ZoneBar zones={o.soner as unknown as OversiktZoneSeconds} legend={false} /></div>
          <Smaatall celler={[
            { etikett: 'Snittpuls', verdi: o.snittpuls != null ? String(o.snittpuls) : '—' },
            { etikett: 'Maks', verdi: o.makspuls != null ? String(o.makspuls) : '—' },
            { etikett: 'Laktat maks', verdi: o.laktatMaks != null ? String(o.laktatMaks).replace('.', ',') : '—' },
            { etikett: 'Opplevd', verdi: o.opplevd != null ? `${o.opplevd}` : '—', under: o.opplevd != null ? '/10' : null },
          ]} />
          <a href={`/app/okt/${o.id}`} style={{ display: 'inline-block', marginTop: 8, fontFamily: FONT, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANSJE, textDecoration: 'none' }}>
            Åpne økta →
          </a>
        </>
      )}
    </Boks>
  )
}

/** Neste hardøkt + neste økt + resten av uka. */
function NesteBoks({ status }: { status: OversiktStatus | null }) {
  const ok = status?.okter ?? null
  const skille = <div style={{ height: 1, background: 'var(--line)', margin: '11px 0 9px' }} />
  if (!ok || (!ok.nesteHard && !ok.nesteOkt)) {
    return (
      <Boks tittel="Neste hardøkt" nokkel="oversikt_status_neste">
        <Tom tekst="Ingen planlagte økter." lenke="/app/plan" lenkeTekst="Planlegg uka →" />
      </Boks>
    )
  }
  return (
    <Boks tittel="Neste hardøkt" nokkel="oversikt_status_neste">
      {ok.nesteHard ? <><OktTittel tekst={ok.nesteHard.tittel} /><OktMeta o={ok.nesteHard} /></>
        : <div style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-5-app)' }}>Ingen hard økt planlagt.</div>}
      {ok.nesteOkt && (
        <>
          {skille}
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>Neste økt</span>
          <OktTittel tekst={ok.nesteOkt.tittel} />
          <OktMeta o={ok.nesteOkt} />
        </>
      )}
      {ok.restenAvUka.length > 0 && (
        <>
          {skille}
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>Resten av uka</span>
          {ok.restenAvUka.map(r => (
            <div key={r.dato + r.tittel} data-status-ukerad style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: FONT, fontSize: 12.5, padding: '3px 0', borderBottom: '1px solid var(--line)' }}>
              <b style={{ fontWeight: 500, color: 'var(--tekst-1-app)' }}>{fmtDato(r.dato)} · {r.tittel}</b>
              {r.hovedsone && <span style={{ color: ZONE_COLORS_V2[r.hovedsone as keyof typeof ZONE_COLORS_V2] ?? 'var(--tekst-8-app)' }}>{r.hovedsone}</span>}
            </div>
          ))}
        </>
      )}
    </Boks>
  )
}

/** Plan vs gjennomført: bar med hvit strek på 100 %, skala til 130 %.
 *  Fargeskalaen er den samme som trenerlista skal bruke (fasit): under 60 rød,
 *  60–84 gul, 85–105 grønn, over 105 oransje. */
function PlanRad({ etikett, faktisk, plan, format }: { etikett: string; faktisk: number; plan: number; format: (v: number) => string }) {
  const pct = plan > 0 ? (faktisk / plan) * 100 : null
  const bredde = pct == null ? 0 : Math.min(pct, PLAN_SKALA_MAKS) / PLAN_SKALA_MAKS * 100
  return (
    <div data-status-planrad={etikett} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 96px', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line)' }}>
      <small style={{ fontFamily: FONT, fontWeight: 600, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-app)' }}>{etikett}</small>
      <div style={{ height: 8, background: 'var(--line2)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
        {pct != null && <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bredde}%`, borderRadius: 4, background: planPctFarge(pct, ORANSJE) }} />}
        {/* hvit strek på 100 % — 100/130 av bredden */}
        <i style={{ position: 'absolute', left: `${100 / PLAN_SKALA_MAKS * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--tekst-1-app)', opacity: 0.75 }} />
      </div>
      <span style={{ fontFamily: BEBAS, fontSize: 18, letterSpacing: '0.03em', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--tekst-1-app)' }}>
        {format(faktisk)}
        <em style={{ fontStyle: 'normal', fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-app)' }}> / {plan > 0 ? format(plan) : '—'}</em>
      </span>
    </div>
  )
}

function PlanBoks({ status }: { status: OversiktStatus | null }) {
  const p = status?.plan ?? null
  return (
    <Boks tittel="Timer · plan vs gjennomført" nokkel="oversikt_status_plan" undertittel={p?.harPlan ? 'Valgt periode' : undefined}>
      {!p || !p.harPlan ? <Tom tekst="Ingen plan i perioden." lenke="/app/plan" lenkeTekst="Planlegg →" /> : (
        <>
          <PlanRad etikett="Timer" faktisk={p.faktiskTimerMin} plan={p.planTimerMin} format={fmtMin} />
          <PlanRad etikett="Hard I3+I4" faktisk={p.faktiskHardMin} plan={p.planHardMin} format={fmtMin} />
          <PlanRad etikett="Økter" faktisk={p.faktiskOkter} plan={p.planOkter} format={v => String(Math.round(v))} />
          <div style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)', marginTop: 6 }}>Hvit strek = 100 % · skalaen går til 130 %</div>
        </>
      )}
    </Boks>
  )
}

/** Bevegelsesformer i perioden — samme tall og palett som Oversikt-fanens kort. */
function BevformBoks({ rader }: { rader: MovementBreakdownRow[] }) {
  const topp = [...rader].sort((a, b) => b.seconds - a.seconds).slice(0, 6)
  const maks = topp[0]?.seconds ?? 0
  return (
    <Boks tittel="Bevegelsesformer" nokkel="oversikt_status_bevform">
      {topp.length === 0 ? <Tom tekst="Ingen bevegelsesformer ført i perioden." /> : topp.map((r, i) => (
        <div key={r.movement_name} data-status-bevform={r.movement_name} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 62px', gap: 10, alignItems: 'center', padding: '5px 0' }}>
          <span className="truncate" style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-1-app)', minWidth: 0 }}>{r.movement_name}</span>
          <div style={{ height: 8, background: 'var(--line2)', borderRadius: 4, overflow: 'hidden' }}>
            <i style={{ display: 'block', height: '100%', borderRadius: 4, width: maks > 0 ? `${Math.round((r.seconds / maks) * 100)}%` : '0%', background: movementColor(i) }} />
          </div>
          <b style={{ fontFamily: BEBAS, fontSize: 18, textAlign: 'right', letterSpacing: '0.03em', color: 'var(--tekst-1-app)' }}>{fmtTid(r.seconds)}</b>
        </div>
      ))}
    </Boks>
  )
}

/** Soner og volum: uke · måned · år. Samme tall som Hovedtall, bare fordelt. */
function SonerBoks({ status }: { status: OversiktStatus | null }) {
  const rader = status?.soner ?? []
  const harData = rader.some(r => r.tidSek > 0)
  const soner = ALL_ZONE_NAMES.filter(k => rader.some(r => (r.soner[k] ?? 0) > 0))
  return (
    <Boks tittel="Soner og volum" nokkel="oversikt_status_soner" undertittel={harData ? 'Uke · måned · år' : undefined}>
      {!harData ? <Tom tekst="Ingen førte økter hittil i år." /> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table data-status-sonetabell style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: 'var(--tekst-8-app)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 6px 4px 0', fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Periode</th>
                  <th style={{ padding: '4px 6px', fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'right' }}>Tid</th>
                  <th style={{ padding: '4px 6px', fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'right' }}>km</th>
                  {soner.map(k => <th key={k} style={{ padding: '4px 6px', fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textAlign: 'right', color: ZONE_COLORS_V2[k] }}>{k}</th>)}
                  <th style={{ padding: '4px 0 4px 6px', fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'right' }}>Hard I3+</th>
                </tr>
              </thead>
              <tbody>
                {rader.map(r => {
                  const sum = soner.reduce((s2, k) => s2 + (r.soner[k] ?? 0), 0)
                  return (
                    <tr key={r.navn} data-status-sonerad={r.navn} style={{ borderTop: '1px solid var(--line)', color: 'var(--tekst-1-app)' }}>
                      <td style={{ padding: '5px 6px 5px 0', whiteSpace: 'nowrap' }}>{r.navn}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtTid(r.tidSek)}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.meter > 0 ? fmtKm(r.meter) : '—'}</td>
                      {soner.map(k => <td key={k} style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--tekst-5-app)' }}>{sum > 0 && (r.soner[k] ?? 0) > 0 ? `${Math.round(((r.soner[k] ?? 0) / sum) * 100)} %` : '—'}</td>)}
                      <td style={{ padding: '5px 0 5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.hardSek > 0 ? fmtTid(r.hardSek) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)', marginTop: 6 }}>Samme tall som Hovedtall over — bare fordelt på uke, måned og år.</div>
        </>
      )}
    </Boks>
  )
}

/** Skyting — kun for skiskyttere. Treff regnes alltid av FØRTE skudd. */
function SkytingBoks({ status }: { status: OversiktStatus | null }) {
  const sk = status?.skyting ?? null
  const aar = status?.skytingAar ?? null
  const farge = (t: number, s2: number) => { const p = s2 > 0 ? t / s2 : 0; return p >= 0.8 ? GRONN : p >= 0.6 ? GULL : ROD }
  return (
    <Boks tittel="Skyting" nokkel="oversikt_status_skyting">
      {!sk && !aar ? <Tom tekst="Ingen skyting ført." /> : (
        <>
          <Smaatall celler={[
            { etikett: 'Skudd i perioden', verdi: sk ? String(sk.skudd) : '—' },
            { etikett: 'Treff liggende', verdi: sk?.treffLiggPct != null ? `${sk.treffLiggPct} %` : '—', farge: '#38BDF8' },
            { etikett: 'Treff stående', verdi: sk?.treffStaaPct != null ? `${sk.treffStaaPct} %` : '—', farge: ORANSJE },
          ]} />
          <div style={{ height: 8 }} />
          <Smaatall celler={[
            { etikett: 'Skudd i år', verdi: aar ? String(aar.skudd) : '—' },
            { etikett: 'Treff totalt', verdi: aar?.treffPct != null ? `${aar.treffPct} %` : '—' },
            { etikett: 'Skytetid snitt', verdi: sk?.skytetidSnitt != null ? String(sk.skytetidSnitt).replace('.', ',') : '—', under: sk?.skytetidSnitt != null ? 's' : null },
          ]} />
          {sk && sk.siste10.length > 0 && (
            <>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--tekst-8-app)', margin: '11px 0 3px' }}>Treff siste {sk.siste10.length} serier</div>
              <div data-status-serier style={{ display: 'flex', gap: 5 }}>
                {sk.siste10.map((s2, i) => (
                  <i key={i} style={{ flex: 1, textAlign: 'center', fontFamily: BEBAS, fontSize: 17, lineHeight: '26px', borderRadius: 6, border: `1px solid ${farge(s2.treff, s2.skudd)}`, color: farge(s2.treff, s2.skudd), fontStyle: 'normal' }}>{s2.treff}</i>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Boks>
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
        <StatusBokser status={status} harSkiskyting={harSkiskyting} canSeeHealthData={canSeeHealthData}
          bevform={overview.current.movement_breakdown} konkurranser={konkurranser} />
      )}
    </section>
  )
}

/** De åtte boksene alene. Trenerens detaljpanel under en utøverrad (bolk B1)
 *  bruker NØYAKTIG de samme boksene — ingen egen variant (regel 11). */
export function StatusBokser({ status, harSkiskyting, canSeeHealthData = true, bevform = [], konkurranser = [], visStjerner = true }: {
  status: OversiktStatus | null
  harSkiskyting: boolean
  canSeeHealthData?: boolean
  bevform?: MovementBreakdownRow[]
  konkurranser?: string[]
  /** Trenerens detaljpanel: boksene er utøverens tall — ingen stjerne der. */
  visStjerner?: boolean
}) {
  return (
    <StjerneKontekst.Provider value={visStjerner}>
    <div data-status-bokser className="xp-status-bokser" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <SisteHardBoks status={status} />
      <NesteBoks status={status} />
      <BelastningBoks status={status} konkurranser={konkurranser} />
      <HelseBoks status={status} canSeeHealthData={canSeeHealthData} />
      <PlanBoks status={status} />
      <SonerBoks status={status} />
      {harSkiskyting && <SkytingBoks status={status} />}
      {bevform.length > 0 && <BevformBoks rader={bevform} />}
    </div>
    </StjerneKontekst.Provider>
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
