'use client'

// Analyse v2 bolk 9: STYRKE-fanen — kun for brukere med styrkeøkter.
// All logikk i lib/styrke-pr (Epley, PR-er, uker, fordeling); her bare
// periode-filter, valg og grafer. PR-er er beregning, ingen tabell.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { StyrkeAnalyse } from '@/app/actions/styrke-analyse'
import {
  ovelseOverTid, styrkePerUke, fordeling, periodeTall, PR_TYPE_NAVN, normOvelse,
  type OvelseOktPunkt, type PrHendelse, type PrType,
} from '@/lib/styrke-pr'
import { STANDARD_EXERCISE_CATEGORIES } from '@/lib/standard-exercises'
import { ChartWrapper } from './ChartWrapper'
import { MetricCard } from './MetricCard'
import { KortGruppe } from './KortGruppe'
import { Chip, Gruppe } from '@/components/workout/WorkoutDetailChart'
import type { DateRange } from './date-range'
import { XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE, CHART_CURSOR, BAR_RADIUS } from './chart-theme'

const FONT = "'Barlow Condensed', sans-serif"
const GULL = '#E8B93C'
const fmtDato = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
const fmtTid = (min: number) => min >= 60 ? `${Math.floor(min / 60)} t ${Math.round(min % 60)} min` : `${Math.round(min)} min`

type Variabel = 'maksVekt' | 'vektXReps' | 'tonnasje' | 'sett' | 'reps' | 'snittRpe' | 'holdSek' | 'est1RM'
const VARIABLER: { id: Variabel; navn: string; enhet: string; farge: string }[] = [
  { id: 'maksVekt', navn: 'Maks vekt', enhet: ' kg', farge: '#E8B93C' },
  { id: 'vektXReps', navn: 'Vekt × reps (beste sett)', enhet: ' kg', farge: '#FF8C00' },
  { id: 'tonnasje', navn: 'Tonnasje per økt', enhet: ' kg', farge: '#8B5CF6' },
  { id: 'sett', navn: 'Sett per økt', enhet: '', farge: '#1A6FD4' },
  { id: 'reps', navn: 'Reps per økt', enhet: '', farge: '#0EA5E9' },
  { id: 'snittRpe', navn: 'RPE', enhet: '', farge: '#E23A5A' },
  { id: 'holdSek', navn: 'Tid per sett (hold)', enhet: ' s', farge: '#28A86E' },
  { id: 'est1RM', navn: 'Est. 1RM (Epley)', enhet: ' kg', farge: '#E8B93C' },
]
const PR_FOR_VARIABEL: Partial<Record<Variabel, PrType>> = { maksVekt: 'maks_vekt', vektXReps: 'vekt_x_reps', est1RM: 'est_1rm' }

/** Forrige periode med samme lengde, rett før. */
function forrigePeriode(range: DateRange): DateRange {
  const from = new Date(range.from + 'T00:00:00'), to = new Date(range.to + 'T00:00:00')
  const dager = Math.max(1, Math.round((to.getTime() - from.getTime()) / 864e5) + 1)
  const pTo = new Date(from); pTo.setDate(pTo.getDate() - 1)
  const pFrom = new Date(pTo); pFrom.setDate(pFrom.getDate() - (dager - 1))
  return { from: pFrom.toISOString().slice(0, 10), to: pTo.toISOString().slice(0, 10), preset: range.preset }
}

function bruk(data: StyrkeAnalyse, range: DateRange) {
  const varighet = new Map(Object.entries(data.varighetMin))
  const inn = data.sett.filter(s => s.date >= range.from && s.date <= range.to)
  const forrige = forrigePeriode(range)
  return {
    inn, varighet, forrige,
    naa: periodeTall(data.sett, data.pr, varighet, range.from, range.to),
    for: periodeTall(data.sett, data.pr, varighet, forrige.from, forrige.to),
    uker: styrkePerUke(inn, varighet),
    ford: fordeling(inn),
    prInn: data.pr.filter(h => h.date >= range.from && h.date <= range.to),
  }
}

export function StyrkeTab({ data, range, targetUserId }: { data: StyrkeAnalyse; range: DateRange; targetUserId?: string }) {
  void targetUserId
  const d = useMemo(() => bruk(data, range), [data, range])
  if (!data.harData) {
    return (
      <div className="py-12 px-6 text-center" style={{ border: '1px dashed var(--kant-3)', backgroundColor: 'var(--card)' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 22, letterSpacing: '0.04em' }}>Ingen styrkeøkter ennå</p>
        <p style={{ fontFamily: FONT, color: 'var(--tekst-5-app)', fontSize: 14 }}>Logg en økt med bev.form Styrke og sett per øvelse - så kommer utvikling, tonnasje og automatiske PR-er hit.</p>
      </div>
    )
  }
  return (
    <div className="space-y-5" data-styrke-tab>
      {data.takNaadd && <p style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-app)' }}>PR-grunnlaget bruker de 10 000 nyeste settene - eldre historikk er utenfor.</p>}
      <StyrkeKort d={d} />
      <PrListe pr={d.prInn} manuelle={data.manuellePR} tittel="Personlige rekorder i perioden" />
      <OvelseGraf data={data} range={range} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <UkeGraf uker={d.uker} felt="okter" chartKey="styrke_okter_per_uke" tittel="Styrkeøkter per uke" enhet="" farge="#1A6FD4" />
        <UkeGraf uker={d.uker} felt="tonnasje" chartKey="styrke_tonnasje_per_uke" tittel="Tonnasje per uke" enhet=" kg" farge="#8B5CF6" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Muskelgrupper ford={d.ford} />
        <OvelseFordeling ford={d.ford} />
      </div>
      <TidPerOkt sett={d.inn} varighet={d.varighet} />
      <PeriodeSammenligning naa={d.naa} forr={d.for} range={range} forrige={d.forrige} />
    </div>
  )
}

function StyrkeKort({ d, bare }: { d: ReturnType<typeof bruk>; bare?: string }) {
  const vis = (k: string) => !bare || bare === k
  const delta = (a: number, b: number) => b > 0 ? Math.round(((a - b) / b) * 100) : null
  const kort = [
    vis('styrke_okter') && <MetricCard key="okter" chartKey="styrke_okter" label="Styrkeøkter" value={String(d.naa.okter)} sublabel={`Forrige periode: ${d.for.okter}`} deltaPercent={delta(d.naa.okter, d.for.okter)} accent="#1A6FD4" />,
    vis('styrke_tonnasje') && <MetricCard key="tonn" chartKey="styrke_tonnasje" label="Tonnasje" value={`${d.naa.tonnasje.toLocaleString('nb-NO')} kg`} sublabel={`${d.naa.sett} sett · forrige: ${d.for.tonnasje.toLocaleString('nb-NO')} kg`} deltaPercent={delta(d.naa.tonnasje, d.for.tonnasje)} accent="#8B5CF6" />,
    vis('styrke_tid') && <MetricCard key="tid" chartKey="styrke_tid" label="Tid i styrke" value={fmtTid(d.naa.minutter)} sublabel={d.naa.okter > 0 ? `${Math.round(d.naa.minutter / d.naa.okter)} min per økt` : 'Ingen økter'} deltaPercent={delta(d.naa.minutter, d.for.minutter)} accent="#28A86E" />,
    vis('styrke_pr_antall') && <MetricCard key="pr" chartKey="styrke_pr_antall" label="PR-er i perioden" value={String(d.naa.pr)} sublabel={`${d.naa.supersettOkter} supersett-økter · forrige: ${d.for.pr} PR`} accent={GULL} />,
  ].filter(Boolean)
  if (bare) return <>{kort}</>
  return <KortGruppe chartKey="styrke_sammendrag" tittel="Styrke i perioden"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kort}</div></KortGruppe>
}

function PrListe({ pr, manuelle, tittel }: { pr: PrHendelse[]; manuelle: StyrkeAnalyse['manuellePR']; tittel: string }) {
  const fortManuelt = (ovelse: string) => manuelle.some(m => `${m.subcategory ?? ''} ${m.custom_label ?? ''}`.toLowerCase().includes(normOvelse(ovelse)))
  const rader = pr.slice(0, 30)
  return (
    <ChartWrapper chartKey="styrke_pr_liste" title={tittel} subtitle="Regnes automatisk fra settene: maks vekt · vekt × reps · est. 1RM (Epley: vekt × (1 + reps/30)) · maks reps ved gitt vekt. Første registrering er grunnlinje, ikke PR." height="auto">
      {rader.length === 0 ? <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)', padding: '12px 0' }}>Ingen nye rekorder i perioden.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: FONT, fontSize: 13 }} data-styrke-pr>
            <thead><tr style={{ color: 'var(--tekst-5-app)', textAlign: 'left' }}>{['Øvelse', 'PR-type', 'Verdi', 'Forrige', 'Dato', ''].map(h => <th key={h} style={{ padding: '4px 8px', borderBottom: '1px solid var(--kant-3)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 11 }}>{h}</th>)}</tr></thead>
            <tbody>
              {rader.map((h, i) => (
                <tr key={`${h.workout_id}-${h.type}-${h.vekt ?? ''}-${i}`} style={{ color: 'var(--tekst-1-app)' }}>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)' }}><span style={{ color: GULL }}>★</span> {h.ovelse}{fortManuelt(h.ovelse) && <span style={{ marginLeft: 6, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tekst-8-app)', border: '1px solid var(--kant-3)', padding: '1px 5px' }}>Ført i Tester &amp; PR</span>}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)' }}>{PR_TYPE_NAVN[h.type]}{h.type === 'maks_reps' && h.vekt != null ? ` @ ${h.vekt} kg` : ''}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)', fontWeight: 700 }}>{h.verdi}{h.type === 'maks_reps' ? ' reps' : ' kg'}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)', color: 'var(--tekst-5-app)' }}>{h.forrige}{h.type === 'maks_reps' ? ' reps' : ' kg'}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)' }}>{fmtDato(h.date)}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)' }}><Link href={`/app/dagbok?edit=${h.workout_id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Åpne økt →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartWrapper>
  )
}

function PrPrikk(props: { cx?: number; cy?: number; payload?: OvelseOktPunkt; farge: string; prType?: PrType }) {
  const { cx, cy, payload, farge, prType } = props
  if (cx == null || cy == null) return null
  const erPr = payload?.pr.length ? (prType ? payload.pr.includes(prType) : true) : false
  if (erPr) return <text x={cx} y={cy + 5} textAnchor="middle" fontSize={15} fill={GULL} aria-label="PR">★</text>
  return <circle cx={cx} cy={cy} r={3} fill={farge} />
}

/** Per øvelse over tid — øvelsesvelger + variabel-chips; favoritt lagrer { ovelse, variabel }. */
export function OvelseGraf({ data, range, initialConfig }: { data: StyrkeAnalyse; range: DateRange; initialConfig?: Record<string, unknown> | null }) {
  const [ovelse, setOvelse] = useState<string>(() => typeof initialConfig?.ovelse === 'string' && data.ovelser.some(o => normOvelse(o.ovelse) === normOvelse(initialConfig!.ovelse as string)) ? initialConfig!.ovelse as string : (data.ovelser[0]?.ovelse ?? ''))
  const [variabel, setVariabel] = useState<Variabel>(() => VARIABLER.some(v => v.id === initialConfig?.variabel) ? initialConfig!.variabel as Variabel : 'maksVekt')
  const [sok, setSok] = useState('')
  const v = VARIABLER.find(x => x.id === variabel) ?? VARIABLER[0]
  const punkter = useMemo(() => ovelseOverTid(data.sett, ovelse, data.pr).filter(p => p.date >= range.from && p.date <= range.to).map(p => ({ ...p, label: fmtDato(p.date), y: p[variabel] })), [data, ovelse, variabel, range])
  const treff = data.ovelser.filter(o => !sok.trim() || normOvelse(o.ovelse).includes(normOvelse(sok)))
  const harVerdi = punkter.some(p => p.y != null)
  return (
    <ChartWrapper chartKey="styrke_ovelse" title="Øvelse over tid" subtitle="Velg øvelse og variabel · ★ = personlig rekord i den økta · est. 1RM med Epley (vekt × (1 + reps/30))" height="auto" config={{ ovelse, variabel }}>
      <div className="flex flex-wrap items-end gap-3 mb-2">
        <label className="flex flex-col gap-1">
          <span style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tekst-5-app)' }}>Søk øvelse</span>
          <input value={sok} onChange={e => setSok(e.target.value)} placeholder="f.eks. knebøy" data-styrke-sok
            style={{ fontFamily: FONT, fontSize: 14, padding: '6px 8px', backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', color: 'var(--tekst-1-app)', minWidth: 180 }} />
        </label>
        <label className="flex flex-col gap-1">
          <span style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tekst-5-app)' }}>Øvelse ({data.ovelser.length})</span>
          <select value={ovelse} onChange={e => setOvelse(e.target.value)} data-styrke-ovelse
            style={{ fontFamily: FONT, fontSize: 14, padding: '6px 8px', backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', color: 'var(--tekst-1-app)', minWidth: 220, minHeight: 36 }}>
            {(treff.length ? treff : data.ovelser).map(o => <option key={o.ovelse} value={o.ovelse}>{o.ovelse} · {o.sett} sett</option>)}
          </select>
        </label>
      </div>
      <div className="mb-2"><Gruppe navn="Variabel">{VARIABLER.map(x => <Chip key={x.id} farge={x.farge} etikett={x.navn} paa={variabel === x.id} fokus={false} onClick={() => setVariabel(x.id)} />)}</Gruppe></div>
      {!harVerdi ? <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-8-app)', padding: '12px 0' }}>Ingen verdier for «{v.navn}» på {ovelse || 'øvelsen'} i perioden.</p> : (
        <div style={{ height: 280 }} data-styrke-graf={variabel}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={punkter} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} minTickGap={12} />
              <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={48} domain={['auto', 'auto']} unit={v.enhet} />
              <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} formatter={(val, _n, item) => { const p = item.payload as OvelseOktPunkt & { y: number | null }; const pr = p.pr.length ? ` · PR: ${p.pr.map(t => PR_TYPE_NAVN[t]).join(', ')}` : ''; const formel = variabel === 'est1RM' ? ' · Epley: vekt × (1 + reps/30)' : ''; return [`${val}${v.enhet}${pr}${formel}`, `${p.title} · ${p.sett} sett`] }} />
              <Line dataKey="y" name={v.navn} stroke={v.farge} strokeWidth={2} connectNulls isAnimationActive={false} dot={<PrPrikk farge={v.farge} prType={PR_FOR_VARIABEL[variabel]} />} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartWrapper>
  )
}

function UkeGraf({ uker, felt, chartKey, tittel, enhet, farge }: { uker: ReturnType<typeof styrkePerUke>; felt: 'okter' | 'tonnasje' | 'minutter' | 'sett'; chartKey: string; tittel: string; enhet: string; farge: string }) {
  if (uker.length === 0) return null
  return (
    <ChartWrapper chartKey={chartKey} title={tittel} subtitle={felt === 'okter' ? 'Antall styrkeøkter per ISO-uke' : 'Sum vekt × reps per ISO-uke'}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={uker} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="week" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} tickFormatter={w => w.slice(5)} />
          <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={48} allowDecimals={false} unit={enhet} />
          <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} formatter={(v) => [`${v}${enhet}`, tittel]} />
          <Bar dataKey={felt} name={tittel} fill={farge} radius={BAR_RADIUS} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

const GRUPPE_NAVN = new Map<string, string>([...STANDARD_EXERCISE_CATEGORIES.map(c => [c.key, c.label] as [string, string]), ['ukjent', 'Ukjent / egen øvelse']])

function Muskelgrupper({ ford }: { ford: ReturnType<typeof fordeling> }) {
  if (ford.grupper.length === 0) return null
  const rader = ford.grupper.map(g => ({ navn: GRUPPE_NAVN.get(g.key) ?? g.key, sett: g.sett }))
  return (
    <ChartWrapper chartKey="styrke_muskelgrupper" title="Fordeling per muskelgruppe" subtitle="Sett i perioden · gruppe fra standardbiblioteket (egne øvelser = ukjent)" height={Math.max(220, 34 * rader.length + 40)}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rader} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_GRID} horizontal={false} />
          <XAxis type="number" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="navn" width={150} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
          <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} formatter={(v) => [`${v} sett`, 'Sett']} />
          <Bar dataKey="sett" name="Sett" fill="#8B5CF6" radius={BAR_RADIUS} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

function OvelseFordeling({ ford }: { ford: ReturnType<typeof fordeling> }) {
  const rader = ford.ovelser.slice(0, 10)
  if (rader.length === 0) return null
  return (
    <ChartWrapper chartKey="styrke_ovelser_fordeling" title="Mest brukte øvelser" subtitle="Sett per øvelse i perioden (topp 10)" height={Math.max(220, 34 * rader.length + 40)}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rader} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_GRID} horizontal={false} />
          <XAxis type="number" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="ovelse" width={150} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
          <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} formatter={(v, _n, item) => [`${v} sett · ${(item.payload as { tonnasje: number }).tonnasje.toLocaleString('nb-NO')} kg`, 'Sett']} />
          <Bar dataKey="sett" name="Sett" fill="#1A6FD4" radius={BAR_RADIUS} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

function TidPerOkt({ sett, varighet }: { sett: StyrkeAnalyse['sett']; varighet: Map<string, number> }) {
  const rader = useMemo(() => {
    const sett2 = new Map<string, { date: string; title: string; min: number; sett: number }>()
    for (const s of sett) { const r = sett2.get(s.workout_id) ?? { date: s.date, title: s.title, min: varighet.get(s.workout_id) ?? 0, sett: 0 }; r.sett++; sett2.set(s.workout_id, r) }
    return [...sett2.values()].filter(r => r.min > 0).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ ...r, label: fmtDato(r.date) }))
  }, [sett, varighet])
  if (rader.length === 0) return null
  return (
    <ChartWrapper chartKey="styrke_tid_per_okt" title="Tid per styrkeøkt" subtitle="Øktens varighet (min) med antall sett i tooltip">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={rader} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} minTickGap={12} />
          <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={44} unit=" min" />
          <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR} formatter={(v, _n, item) => [`${v} min · ${(item.payload as { sett: number }).sett} sett`, (item.payload as { title: string }).title]} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          <Line dataKey="min" name="Minutter" stroke="#28A86E" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

function PeriodeSammenligning({ naa, forr, range, forrige }: { naa: ReturnType<typeof periodeTall>; forr: ReturnType<typeof periodeTall>; range: DateRange; forrige: DateRange }) {
  const rader: { navn: string; a: number; b: number; enhet: string }[] = [
    { navn: 'Styrkeøkter', a: naa.okter, b: forr.okter, enhet: '' }, { navn: 'Sett', a: naa.sett, b: forr.sett, enhet: '' },
    { navn: 'Tonnasje', a: naa.tonnasje, b: forr.tonnasje, enhet: ' kg' }, { navn: 'Tid', a: naa.minutter, b: forr.minutter, enhet: ' min' },
    { navn: 'PR-er', a: naa.pr, b: forr.pr, enhet: '' }, { navn: 'Supersett-økter', a: naa.supersettOkter, b: forr.supersettOkter, enhet: '' },
  ]
  return (
    <ChartWrapper chartKey="styrke_periode_sammenligning" title="Sammenlign to perioder" subtitle={`Valgt periode (${fmtDato(range.from)}-${fmtDato(range.to)}) mot perioden rett før (${fmtDato(forrige.from)}-${fmtDato(forrige.to)})`} height="auto">
      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: FONT, fontSize: 13 }} data-styrke-perioder>
        <thead><tr style={{ color: 'var(--tekst-5-app)', textAlign: 'left' }}>{['', 'Denne', 'Forrige', 'Endring'].map((h, i) => <th key={i} style={{ padding: '4px 8px', borderBottom: '1px solid var(--kant-3)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 11 }}>{h}</th>)}</tr></thead>
        <tbody>{rader.map(r => { const d = r.b > 0 ? Math.round(((r.a - r.b) / r.b) * 100) : null; return (
          <tr key={r.navn} style={{ color: 'var(--tekst-1-app)' }}>
            <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)' }}>{r.navn}</td>
            <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)', fontWeight: 700 }}>{r.a.toLocaleString('nb-NO')}{r.enhet}</td>
            <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)', color: 'var(--tekst-5-app)' }}>{r.b.toLocaleString('nb-NO')}{r.enhet}</td>
            <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--kant-3)', color: d == null ? 'var(--tekst-8-app)' : d >= 0 ? '#28A86E' : '#E23A5A' }}>{d == null ? '-' : `${d > 0 ? '+' : ''}${d} %`}</td>
          </tr>) })}</tbody>
      </table>
    </ChartWrapper>
  )
}

/** Favoritt-rendring for Styrke-nøklene (range fra ctx). */
export function renderFavoritt(key: string, data: StyrkeAnalyse, ctx: { range: DateRange; config?: Record<string, unknown> | null }): React.ReactNode | null {
  if (!data.harData) return null
  const d = bruk(data, ctx.range)
  switch (key) {
    case 'styrke_sammendrag': return <StyrkeKort d={d} />
    case 'styrke_okter': case 'styrke_tonnasje': case 'styrke_tid': case 'styrke_pr_antall': return <StyrkeKort d={d} bare={key} />
    case 'styrke_pr_liste': return <PrListe pr={d.prInn} manuelle={data.manuellePR} tittel="Personlige rekorder i perioden" />
    case 'styrke_ovelse': return <OvelseGraf data={data} range={ctx.range} initialConfig={ctx.config} />
    case 'styrke_okter_per_uke': return <UkeGraf uker={d.uker} felt="okter" chartKey="styrke_okter_per_uke" tittel="Styrkeøkter per uke" enhet="" farge="#1A6FD4" />
    case 'styrke_tonnasje_per_uke': return <UkeGraf uker={d.uker} felt="tonnasje" chartKey="styrke_tonnasje_per_uke" tittel="Tonnasje per uke" enhet=" kg" farge="#8B5CF6" />
    case 'styrke_muskelgrupper': return <Muskelgrupper ford={d.ford} />
    case 'styrke_ovelser_fordeling': return <OvelseFordeling ford={d.ford} />
    case 'styrke_tid_per_okt': return <TidPerOkt sett={d.inn} varighet={d.varighet} />
    case 'styrke_periode_sammenligning': return <PeriodeSammenligning naa={d.naa} forr={d.for} range={ctx.range} forrige={d.forrige} />
    default: return null
  }
}
