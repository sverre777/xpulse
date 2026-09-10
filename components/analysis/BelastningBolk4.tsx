'use client'

// BOLK 4 (Analyse v2, Sverre 5. sep + tillegg 6. sep) — HELSE MOT BELASTNING:
//  · HRV/hvilepuls 30 / 90 dager med CTL/ATL/TSB bak og hardøkter markert;
//  · korrelasjonskort (scatter + r + n; n < 10 → «for lite data»);
//  · «Klar for belastning»-stripe (ren visning, ingen råd);
//  · opplevd (rpe) vs TSS med filter per økttype / bev.form;
//  · sykdom/skade som lag på grafene;
//  · CUSTOM BELASTNINGSGRAF (Sverre 6. sep): belastningstrendene mot
//    følelse, timer, sonetid, laktat, HRV, hvilepuls, vekt og resultater.
// Alle tall fra getHelseBelastning (lib-formler) — ingen kopier her.

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Area, Scatter, ScatterChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea, ReferenceLine, ZAxis,
} from 'recharts'
import type { HelseBelastning, HelseBelastningDag, Klar } from '@/app/actions/helse-belastning'
import { KORR_MIN_N, korrTekst, type Korrelasjon } from '@/lib/korrelasjon'
import { ChartWrapper } from './ChartWrapper'
import { KortGruppe } from './KortGruppe'
import { XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE } from './chart-theme'
import { Chip, Gruppe } from '@/components/workout/WorkoutDetailChart'

const FONT = "'Barlow Condensed', sans-serif"
const F = { hrv: '#8B5CF6', hvilepuls: '#E23A5A', ctl: '#38BDF8', atl: '#E23A5A', tsb: '#28A86E', tss: '#E8B93C', hard: '#E8B93C', sykdom: 'rgba(226,58,90,.18)', skade: 'rgba(255,140,0,.18)' }
const fmtDato = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return `${d.getDate()}.${d.getMonth() + 1}` }
const tom = (tekst: string) => <p className="py-8 text-center text-sm" style={{ fontFamily: FONT, color: 'var(--tekst-5-app)' }}>{tekst}</p>

/** Sykdom/skade som lag — samme på alle helse-/belastningsgrafer (bolk 4).
    Gir en LISTE av ReferenceArea (Recharts leser barna direkte — en
    omsluttende komponent ville blitt usynlig). */
export function hendelseLag({ dager, xKey = 'label', yAxisId }: { dager: HelseBelastningDag[]; xKey?: 'label' | 'date'; yAxisId?: string }) {
  const baand: { fra: string; til: string; type: 'sykdom' | 'skade' }[] = []
  for (const type of ['sykdom', 'skade'] as const) {
    let start: string | null = null, sist: string | null = null
    for (const d of dager) {
      const paa = type === 'sykdom' ? d.sykdom : d.skade
      if (paa && start == null) start = d.date
      if (paa) sist = d.date
      if (!paa && start != null) { baand.push({ fra: start, til: sist!, type }); start = null }
    }
    if (start != null) baand.push({ fra: start, til: sist!, type })
  }
  const x = (iso: string) => xKey === 'label' ? fmtDato(iso) : iso
  // yAxisId MÅ settes når grafen har flere y-akser — ellers forkaster Recharts laget stille.
  return baand.map((b, i) => <ReferenceArea key={`${b.type}-${i}`} yAxisId={yAxisId} x1={x(b.fra)} x2={x(b.til)} fill={F[b.type]} stroke="none" label={{ value: b.type === 'sykdom' ? '🤒' : '🩹', position: 'insideTop', fontSize: 11 }} />)
}

/** HRV og hvilepuls med belastningen bak og hardøkter markert. */
export function HelseMotBelastning({ data, initialConfig }: { data: HelseBelastning; initialConfig?: Record<string, unknown> | null }) {
  const [dagerN, setDagerN] = useState<30 | 90>(initialConfig?.dager === 90 ? 90 : 30)
  const [bak, setBak] = useState<'tsb' | 'ctl' | 'atl'>(initialConfig?.bak === 'ctl' || initialConfig?.bak === 'atl' ? initialConfig.bak : 'tsb')
  const rader = useMemo(() => data.dager.slice(-dagerN).map(d => ({ ...d, label: fmtDato(d.date) })), [data.dager, dagerN])
  const harHelse = rader.some(d => d.hrv != null || d.hvilepuls != null)
  return (
    <ChartWrapper chartKey="belastning_helse_kurver" title="HRV og hvilepuls mot belastning" height="auto" config={{ dager: dagerN, bak }}
      subtitle="Nattens HRV og hvilepuls (linjer) med formen bak (areal) - hardøkter som prikker, sykdom og skade som felt">
      <div className="flex gap-4 flex-wrap items-center mb-2">
        <Gruppe navn="Vindu">
          <Chip farge="var(--accent)" etikett="30 dager" paa={dagerN === 30} fokus={false} onClick={() => setDagerN(30)} />
          <Chip farge="var(--accent)" etikett="90 dager" paa={dagerN === 90} fokus={false} onClick={() => setDagerN(90)} />
        </Gruppe>
        <Gruppe navn="Bak">
          {(['tsb', 'ctl', 'atl'] as const).map(k => <Chip key={k} farge={F[k]} etikett={k.toUpperCase()} paa={bak === k} fokus={false} onClick={() => setBak(k)} />)}
        </Gruppe>
      </div>
      {!harHelse ? tom('Ingen HRV eller hvilepuls i perioden - koble klokka eller før manuelt under Helse.') : (
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={rader} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} minTickGap={12} />
              <YAxis yAxisId="h" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} domain={['auto', 'auto']} />
              <YAxis yAxisId="b" orientation="right" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} domain={['auto', 'auto']} />
              {hendelseLag({ dager: rader, yAxisId: 'h' })}
              <Area yAxisId="b" dataKey={bak} name={bak.toUpperCase()} type="monotone" fill={F[bak]} fillOpacity={0.12} stroke={F[bak]} strokeOpacity={0.5} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              <Tooltip content={<XpTooltip />} />
              <Legend wrapperStyle={CHART_LEGEND_STYLE} />
              <Line yAxisId="h" dataKey="hrv" name="HRV (ms)" stroke={F.hrv} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              <Line yAxisId="h" dataKey="hvilepuls" name="Hvilepuls" stroke={F.hvilepuls} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              <Scatter yAxisId="h" dataKey="hardMarkor" name="Hardøkt" fill={F.hard} shape="triangle" data={rader.filter(d => d.hard).map(d => ({ label: d.label, hardMarkor: d.hvilepuls ?? d.hrv ?? 0 }))} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartWrapper>
  )
}

/** Ett korrelasjonskort: scatter + r + n; n < 10 → dempet «for lite data». */
function KorrKort({ chartKey, tittel, xNavn, yNavn, k, xEnhet = '', yEnhet = '' }: { chartKey: string; tittel: string; xNavn: string; yNavn: string; k: Korrelasjon; xEnhet?: string; yEnhet?: string }) {
  const forLite = k.forLite
  return (
    <ChartWrapper chartKey={chartKey} title={tittel} height="auto"
      subtitle={forLite ? `for lite data - ${k.n} av ${KORR_MIN_N} dager` : `r = ${k.r ?? '-'} · n = ${k.n} · ${korrTekst(k.r)}`}>
      <div data-korrelasjon={chartKey} data-n={k.n} data-r={k.r ?? ''} style={{ height: 180, opacity: forLite ? 0.45 : 1 }}>
        {k.n === 0 ? tom('Ingen dager med begge verdiene.') : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ScatterChart margin={{ top: 6, right: 10, bottom: 4, left: -6 }}>
              <CartesianGrid stroke={CHART_GRID} />
              <XAxis type="number" dataKey="x" name={xNavn} unit={xEnhet} domain={['auto', 'auto']} tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} axisLine={CHART_AXIS_LINE} tickLine={false} />
              <YAxis type="number" dataKey="y" name={yNavn} unit={yEnhet} domain={['auto', 'auto']} tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} axisLine={CHART_AXIS_LINE} tickLine={false} width={44} />
              <ZAxis range={[30, 30]} />
              <Tooltip content={<XpTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--tekst-8-app)' }} formatter={(v, key) => [`${v}${key === 'x' ? xEnhet : yEnhet}`, key === 'x' ? xNavn : yNavn]} labelFormatter={() => ''} />
              <Scatter data={k.punkter} fill={forLite ? 'var(--tekst-8-app)' : '#FF4500'} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartWrapper>
  )
}

export function Korrelasjonskort({ data, bare }: { data: HelseBelastning; bare?: string }) {
  const k = data.korrelasjoner
  const kort = [
    <KorrKort key="1" chartKey="belastning_korr_hrv_tsb" tittel="HRV vs form (TSB)" xNavn="TSB" yNavn="HRV" yEnhet=" ms" k={k.hrvVsTsb} />,
    <KorrKort key="2" chartKey="belastning_korr_hvilepuls_atl" tittel="Hvilepuls vs tretthet (ATL)" xNavn="ATL" yNavn="Hvilepuls" yEnhet=" bpm" k={k.hvilepulsVsAtl} />,
    <KorrKort key="3" chartKey="belastning_korr_sovn_opplevd" tittel="Søvn vs opplevd neste dag" xNavn="Søvn" xEnhet=" t" yNavn="Opplevd" k={k.sovnVsOpplevd} />,
    <KorrKort key="4" chartKey="belastning_korr_dagsform_ef" tittel="Dagsform vs EF" xNavn="Dagsform" yNavn="EF" k={k.dagsformVsEf} />,
    <KorrKort key="5" chartKey="belastning_korr_sovn_treff" tittel="Søvn vs treff %" xNavn="Søvn" xEnhet=" t" yNavn="Treff" yEnhet=" %" k={k.sovnVsTreff} />,
    <KorrKort key="6" chartKey="belastning_korr_hrv_treff" tittel="HRV vs treff %" xNavn="HRV" xEnhet=" ms" yNavn="Treff" yEnhet=" %" k={k.hrvVsTreff} />,
    <KorrKort key="7" chartKey="belastning_korr_vekt_wattkg" tittel="Vekt vs watt per kg" xNavn="Vekt" xEnhet=" kg" yNavn="W/kg" k={k.vektVsWattKg} />,
  ]
  if (bare) return kort.find(x => (x.props as { chartKey: string }).chartKey === bare) ?? null
  return (
    <KortGruppe chartKey="belastning_korrelasjoner" tittel="Korrelasjonskort · n < 10 dager = for lite data">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{kort}</div>
    </KortGruppe>
  )
}

const KLAR_FARGE: Record<Klar, string> = { klar: '#28A86E', moderat: '#E8B93C', hvil: '#E23A5A' }
const KLAR_TEKST: Record<Klar, string> = { klar: 'Klar', moderat: 'Moderat', hvil: 'Hvil' }

/** «Klar for belastning» — ren visning: HRV/hvilepuls mot egen grunnlinje + TSB. */
export function KlarForBelastning({ data }: { data: HelseBelastning }) {
  const dager = data.dager.slice(-30)
  const iDag = dager[dager.length - 1]
  return (
    <ChartWrapper chartKey="belastning_klar" title="Klar for belastning" height="auto"
      subtitle="Visning, ikke råd: nattens HRV og hvilepuls mot ditt eget 7-dagers snitt, og formen (TSB). Grønn = innenfor, gul = litt utenfor, rød = tydelig utenfor eller TSB under −30.">
      {dager.every(d => d.klar == null) ? tom('Trenger minst tre dager med HRV eller hvilepuls før stripa kan vises.') : (
        <div data-klar-stripe>
          {iDag?.klar && (
            <p style={{ fontFamily: FONT, fontSize: 15, margin: '0 0 8px' }}>
              I dag: <b style={{ color: KLAR_FARGE[iDag.klar] }} data-klar-idag={iDag.klar}>{KLAR_TEKST[iDag.klar]}</b>
              {iDag.tsb != null && <span style={{ color: 'var(--tekst-8-app)', fontSize: 12.5 }}> · TSB {iDag.tsb > 0 ? '+' : ''}{Math.round(iDag.tsb)}</span>}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dager.length}, minmax(0, 1fr))`, gap: 2 }}>
            {dager.map(d => (
              <div key={d.date} title={`${d.date}${d.klar ? ` · ${KLAR_TEKST[d.klar]}` : ''}`} data-klar={d.klar ?? 'ukjent'}
                style={{ height: 22, borderRadius: 3, background: d.klar ? KLAR_FARGE[d.klar] : 'var(--flate-12-alt)', opacity: d.klar ? 0.9 : 0.5 }} />
            ))}
          </div>
          <div className="flex justify-between" style={{ fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-app)', marginTop: 4 }}>
            <span>{fmtDato(dager[0].date)}</span><span>{fmtDato(dager[dager.length - 1].date)}</span>
          </div>
        </div>
      )}
    </ChartWrapper>
  )
}

/** Opplevd (rpe) vs TSS per økt, filter per økttype / bev.form. */
export function RpeVsTss({ data, initialConfig }: { data: HelseBelastning; initialConfig?: Record<string, unknown> | null }) {
  const typer = useMemo(() => [...new Set(data.okter.map(o => o.workout_type))], [data.okter])
  const bev = useMemo(() => [...new Set(data.okter.map(o => o.bevegelse).filter(Boolean))], [data.okter])
  const [type, setType] = useState<string | null>(typeof initialConfig?.type === 'string' ? initialConfig.type : null)
  const [bevValg, setBev] = useState<string | null>(typeof initialConfig?.bev === 'string' ? initialConfig.bev : null)
  const punkter = data.okter.filter(o => o.opplevd != null && o.tss > 0 && (!type || o.workout_type === type) && (!bevValg || o.bevegelse === bevValg)).map(o => ({ x: o.tss, y: o.opplevd, date: o.date, title: o.title }))
  return (
    <ChartWrapper chartKey="belastning_rpe_vs_tss" title="Opplevd vs TSS per økt" height="auto" config={{ type, bev: bevValg }}
      subtitle="Hver økt som punkt - ligger opplevd belastning over eller under det beregnede? Filtrer på økttype og bevegelsesform.">
      <div className="flex gap-4 flex-wrap items-center mb-2">
        {typer.length > 1 && <Gruppe navn="Økttype">{[null, ...typer].map(t => <Chip key={t ?? 'alle'} farge="var(--accent)" etikett={t ?? 'Alle'} paa={type === t} fokus={false} onClick={() => setType(t)} />)}</Gruppe>}
        {bev.length > 1 && <Gruppe navn="Bev.form">{[null, ...bev].map(b => <Chip key={b ?? 'alle'} farge="#1A6FD4" etikett={b ?? 'Alle'} paa={bevValg === b} fokus={false} onClick={() => setBev(b)} />)}</Gruppe>}
      </div>
      {punkter.length === 0 ? tom('Ingen økter med både opplevd belastning og TSS i utvalget.') : (
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -6 }}>
              <CartesianGrid stroke={CHART_GRID} />
              <XAxis type="number" dataKey="x" name="TSS" domain={[0, 'auto']} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
              <YAxis type="number" dataKey="y" name="Opplevd" domain={[0, 10]} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} />
              <ZAxis range={[40, 40]} />
              <Tooltip content={<XpTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--tekst-8-app)' }} formatter={(v, key) => [`${v}`, key === 'x' ? 'TSS' : 'Opplevd']} labelFormatter={() => ''} />
              <Scatter data={punkter} fill="#FF4500" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartWrapper>
  )
}

type Last = 'tss' | 'ctl' | 'atl' | 'tsb'
type Variabel = 'dagsform' | 'timer' | 'soneI3PlusTimer' | 'laktatMaks' | 'hrv' | 'hvilepuls' | 'vekt' | 'resultatPct' | 'sovnTimer'
const VARIABLER: { id: Variabel; navn: string; farge: string; enhet: string; punkt?: boolean; reversert?: boolean }[] = [
  { id: 'dagsform', navn: 'Følelse', farge: '#A855F7', enhet: '' },
  { id: 'timer', navn: 'Timer', farge: '#1A6FD4', enhet: ' t' },
  { id: 'soneI3PlusTimer', navn: 'Sone I3+', farge: '#F97316', enhet: ' t' },
  { id: 'laktatMaks', navn: 'Laktat', farge: '#E23A5A', enhet: ' mmol', punkt: true },
  { id: 'hrv', navn: 'HRV', farge: '#8B5CF6', enhet: ' ms' },
  { id: 'hvilepuls', navn: 'Hvilepuls', farge: '#E23A5A', enhet: ' bpm' },
  { id: 'sovnTimer', navn: 'Søvn', farge: '#0EA5E9', enhet: ' t' },
  { id: 'vekt', navn: 'Vekt', farge: '#E8B93C', enhet: ' kg' },
  { id: 'resultatPct', navn: 'Resultater', farge: '#FF4500', enhet: ' %', punkt: true, reversert: true },
]

/** Custom belastningsgraf: belastningstrender mot én valgt variabel (Sverre 6. sep). */
export function BelastningCustom({ data, initialConfig }: { data: HelseBelastning; initialConfig?: Record<string, unknown> | null }) {
  const [last, setLast] = useState<Last[]>(Array.isArray(initialConfig?.last) ? (initialConfig.last as Last[]).filter(x => ['tss', 'ctl', 'atl', 'tsb'].includes(x)) : ['ctl', 'atl', 'tsb'])
  const [variabel, setVariabel] = useState<Variabel>(VARIABLER.some(v => v.id === initialConfig?.variabel) ? (initialConfig!.variabel as Variabel) : 'dagsform')
  const v = VARIABLER.find(x => x.id === variabel)!
  const rader = useMemo(() => data.dager.map(d => ({ ...d, label: fmtDato(d.date) })), [data.dager])
  const harVar = rader.some(d => d[variabel] != null)
  const toggle = (k: Last) => setLast(l => l.includes(k) ? l.filter(x => x !== k) : [...l, k])
  return (
    <ChartWrapper chartKey="belastning_custom" title="Custom belastningsgraf" height="auto" config={{ last, variabel }}
      subtitle="Belastningstrendene (venstre akse) mot én valgt variabel (høyre akse) - følelse, timer, sonetid, laktat, HRV, hvilepuls, søvn, vekt eller resultater">
      <div className="flex gap-4 flex-wrap items-center mb-2">
        <Gruppe navn="Belastning">
          {(['tss', 'ctl', 'atl', 'tsb'] as const).map(k => <Chip key={k} farge={F[k]} etikett={k.toUpperCase()} paa={last.includes(k)} fokus={false} onClick={() => toggle(k)} />)}
        </Gruppe>
        <Gruppe navn="Mot">
          {VARIABLER.map(x => <Chip key={x.id} farge={x.farge} etikett={x.navn} paa={variabel === x.id} fokus={variabel === x.id} onClick={() => setVariabel(x.id)} />)}
        </Gruppe>
      </div>
      <div style={{ height: 320 }} data-belastning-custom data-variabel={variabel}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={rader} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} minTickGap={12} />
            <YAxis yAxisId="b" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40} domain={['auto', 'auto']} />
            <YAxis yAxisId="v" orientation="right" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={44} domain={['auto', 'auto']} reversed={v.reversert} unit={v.enhet} />
            {hendelseLag({ dager: rader, yAxisId: 'b' })}
            <ReferenceLine yAxisId="b" y={0} stroke="var(--tekst-8-app)" strokeDasharray="2 2" />
            <Tooltip content={<XpTooltip />} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            {last.includes('tss') && <Bar yAxisId="b" dataKey="tss" name="TSS" fill={F.tss} fillOpacity={0.35} isAnimationActive={false} />}
            {last.includes('ctl') && <Line yAxisId="b" dataKey="ctl" name="CTL" stroke={F.ctl} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
            {last.includes('atl') && <Line yAxisId="b" dataKey="atl" name="ATL" stroke={F.atl} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />}
            {last.includes('tsb') && <Line yAxisId="b" dataKey="tsb" name="TSB" stroke={F.tsb} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
            {harVar && (v.punkt
              ? <Scatter yAxisId="v" dataKey={variabel} name={v.navn} fill={v.farge} data={rader.filter(d => d[variabel] != null)} />
              : <Line yAxisId="v" dataKey={variabel} name={v.navn} stroke={v.farge} strokeWidth={2.5} dot={{ r: 2 }} connectNulls isAnimationActive={false} />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!harVar && <p style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-8-app)', marginTop: 6 }}>Ingen verdier for «{v.navn}» i perioden ennå.</p>}
    </ChartWrapper>
  )
}

/** Seksjonen i Belastning-fanen. */
export function HelseBelastningSeksjon({ data }: { data: HelseBelastning }) {
  return (
    <div className="space-y-5" data-helse-belastning>
      <HelseMotBelastning data={data} />
      <KlarForBelastning data={data} />
      <Korrelasjonskort data={data} />
      <RpeVsTss data={data} />
      <BelastningCustom data={data} />
    </div>
  )
}

