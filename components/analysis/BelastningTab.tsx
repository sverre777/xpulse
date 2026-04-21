'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea, ReferenceLine,
} from 'recharts'
import type { BelastningAnalysis, FormStatus } from '@/app/actions/analysis'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

// Farger for CTL / ATL / TSB-linjene.
const COLOR_CTL = '#38BDF8'  // Fitness (blå)
const COLOR_ATL = '#E11D48'  // Fatigue (rød)
const COLOR_TSB = '#28A86E'  // Form (grønn)
const COLOR_TSS = '#FF4500'  // Daglig TSS (oransje)
const COLOR_TSS_AVG = '#F0F0F2'  // 7-dagers snitt

// Form-sone-farger for bakgrunnen på TSB-linjegrafen. Svakt mettede slik at
// linjene leses tydelig over.
const FORM_ZONES: { from: number; to: number; color: string; label: string }[] = [
  { from: 25,  to: 50,  color: 'rgba(138, 138, 150, 0.10)', label: 'Uttrent' },
  { from: 10,  to: 25,  color: 'rgba(40, 168, 110, 0.18)',  label: 'Optimal' },
  { from: -10, to: 10,  color: 'rgba(138, 138, 150, 0.08)', label: 'Nøytral' },
  { from: -30, to: -10, color: 'rgba(212, 160, 23, 0.18)',  label: 'Høy belastning' },
  { from: -50, to: -30, color: 'rgba(225, 29, 72, 0.22)',   label: 'Overtrent' },
]

const FORM_LABELS: Record<FormStatus, { label: string; color: string; desc: string }> = {
  detrained:      { label: 'Uttrent',          color: '#8A8A96', desc: 'TSB > 20 — for lite belastning, form synker.' },
  optimal:        { label: 'Optimal form',     color: '#28A86E', desc: 'TSB 10–20 — uthvilt og god form for konkurranse.' },
  neutral:        { label: 'Nøytral',          color: '#8A8A96', desc: 'TSB −10 til 10 — balansert trening.' },
  hoy_belastning: { label: 'Høy belastning',   color: '#D4A017', desc: 'TSB −30 til −10 — kropp jobber, monitorér restitusjon.' },
  overtrent:      { label: 'Overbelastet',     color: '#E11D48', desc: 'TSB < −30 — akutt overbelastning, trappa ned.' },
}

function formatDateShort(iso: string): string {
  // ISO → "15. apr"
  const d = new Date(iso + 'T00:00:00Z')
  const months = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']
  return `${d.getUTCDate()}. ${months[d.getUTCMonth()]}`
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => {
    if (c === '' || c == null) return ''
    const s = String(c)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function BelastningTab({ data }: { data: BelastningAnalysis }) {
  if (!data.hasData || data.daily.length === 0) {
    return (
      <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Ikke nok økter med sone-data til å beregne belastning. Logg økter med puls/soner for å bygge CTL og ATL over tid.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <CurrentStatus data={data} />
      <FitnessFatigueChart data={data} />
      <DailyTssChart data={data} />
      <CsvExport data={data} />
      <MethodNote />
    </div>
  )
}

function CurrentStatus({ data }: { data: BelastningAnalysis }) {
  const { atl, ctl, tsb, formStatus } = data.current
  const form = FORM_LABELS[formStatus]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <StatCard label="Fitness (CTL)" value={ctl.toFixed(0)} sub="42-dagers snitt TSS"    accent={COLOR_CTL} />
      <StatCard label="Fatigue (ATL)" value={atl.toFixed(0)} sub="7-dagers snitt TSS"     accent={COLOR_ATL} />
      <StatCard label="Form (TSB)"    value={(tsb >= 0 ? '+' : '') + tsb.toFixed(0)}
                sub="CTL − ATL" accent={COLOR_TSB} />
      <div className="p-4 flex flex-col gap-1"
        style={{ backgroundColor: '#111113', border: '1px solid #1E1E22', borderLeft: `3px solid ${form.color}`, minHeight: '110px' }}>
        <p className="text-[11px] tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Formstatus
        </p>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: form.color, fontSize: '28px', lineHeight: 1.05, letterSpacing: '0.03em' }}>
          {form.label}
        </p>
        <p className="text-[11px]" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {form.desc}
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="p-4 flex flex-col gap-1"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22', borderLeft: `3px solid ${accent}`, minHeight: '110px' }}>
      <p className="text-[11px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </p>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '40px', lineHeight: 1, letterSpacing: '0.03em' }}>
        {value}
      </span>
      <p className="text-[11px]" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {sub}
      </p>
    </div>
  )
}

export function FitnessFatigueChart({ data }: { data: BelastningAnalysis }) {
  const rows = useMemo(() => data.daily.map(d => ({
    date: d.date,
    label: formatDateShort(d.date),
    CTL: d.ctl, ATL: d.atl, TSB: d.tsb,
  })), [data.daily])

  // Dynamisk X-tick-hopp: maks ~10 ticks slik at etiketter ikke kolliderer.
  const tickInterval = Math.max(0, Math.floor(rows.length / 10) - 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Fitness / Fatigue / Form
        </p>
      </div>
      <ChartWrapper chartKey="belastning_fitness_fatigue_form" title="Belastningskurver"
        subtitle="CTL (blå) bygger form over tid · ATL (rød) reflekterer akutt tretthet · TSB (grønn) = form i dag. Bakgrunnsfarge viser form-sone for TSB."
        height={360}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              interval={tickInterval} minTickGap={8} />
            <YAxis yAxisId="ctl" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
            <YAxis yAxisId="tsb" orientation="right" tick={AXIS_STYLE}
              axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
              domain={[-50, 50]} />
            {FORM_ZONES.map(z => (
              <ReferenceArea key={z.label} yAxisId="tsb" y1={z.from} y2={z.to} fill={z.color} stroke="none" />
            ))}
            <ReferenceLine yAxisId="tsb" y={0} stroke="#555560" strokeDasharray="2 2" />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v, k) => [typeof v === 'number' ? v.toFixed(1) : String(v ?? ''), String(k)]}
              labelFormatter={(l) => String(l)} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            <Line yAxisId="ctl" type="monotone" dataKey="CTL" stroke={COLOR_CTL} strokeWidth={2.5} dot={false} name="Fitness (CTL)" />
            <Line yAxisId="ctl" type="monotone" dataKey="ATL" stroke={COLOR_ATL} strokeWidth={2} dot={false} name="Fatigue (ATL)" />
            <Line yAxisId="tsb" type="monotone" dataKey="TSB" stroke={COLOR_TSB} strokeWidth={2} dot={false} name="Form (TSB)" />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {FORM_ZONES.map(z => (
          <span key={z.label} className="flex items-center gap-2">
            <span style={{ width: 12, height: 12, backgroundColor: z.color, border: '1px solid #1E1E22' }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '11px' }}>
              {z.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function DailyTssChart({ data }: { data: BelastningAnalysis }) {
  const rows = useMemo(() => data.daily.map(d => ({
    date: d.date,
    label: formatDateShort(d.date),
    TSS: d.tss,
    snitt: d.tssRolling7,
  })), [data.daily])

  const tickInterval = Math.max(0, Math.floor(rows.length / 10) - 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Daglig TSS
        </p>
      </div>
      <ChartWrapper chartKey="belastning_daily_tss" title="Daglig treningsbelastning (TSS)"
        subtitle="Stolper = TSS per dag · hvit linje = glidende 7-dagers snitt"
        height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              interval={tickInterval} minTickGap={8} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E1E22' }}
              formatter={(v, k) => [typeof v === 'number' ? v.toFixed(1) : String(v ?? ''), String(k)]} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            <Bar dataKey="TSS" fill={COLOR_TSS} name="TSS" />
            <Line type="monotone" dataKey="snitt" stroke={COLOR_TSS_AVG} strokeWidth={2} dot={false} name="7-dagers snitt" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

function CsvExport({ data }: { data: BelastningAnalysis }) {
  const handleExport = () => {
    const header = ['dato', 'tss', 'atl', 'ctl', 'tsb', 'tss_rolling7']
    const rows: string[][] = [header]
    for (const d of data.daily) {
      rows.push([
        d.date,
        d.tss.toString(),
        d.atl.toString(),
        d.ctl.toString(),
        d.tsb.toString(),
        d.tssRolling7.toString(),
      ])
    }
    const first = data.daily[0]?.date ?? 'start'
    const last = data.daily[data.daily.length - 1]?.date ?? 'slutt'
    downloadCsv(`belastning_${first}_${last}.csv`, rows)
  }

  return (
    <div className="p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div>
        <p className="text-xs tracking-widest uppercase mb-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Eksport
        </p>
        <p className="text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Last ned daglige tall for perioden som CSV — for videre analyse i Excel eller egne verktøy.
        </p>
      </div>
      <button type="button" onClick={handleExport}
        className="px-4 py-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#FF4500', color: '#0A0A0B',
          border: 'none', minHeight: '40px', cursor: 'pointer',
        }}>
        Last ned CSV
      </button>
    </div>
  )
}

function MethodNote() {
  return (
    <div className="p-4" style={{ backgroundColor: '#0D0D11', border: '1px solid #1E1E22' }}>
      <p className="text-[11px] tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Slik beregnes tallene
      </p>
      <p className="text-xs leading-relaxed"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        <strong style={{ color: '#F0F0F2' }}>TSS</strong> = sum av minutter i sone × sone-vekt (I1=1, I2=2, I3=3, I4=4, I5=5, Hurtighet=5).
        {' '}<strong style={{ color: '#F0F0F2' }}>ATL</strong> (akutt tretthet) og <strong style={{ color: '#F0F0F2' }}>CTL</strong> (form-base)
        er eksponentielt vektede glidende snitt med tidskonstant 7 hhv. 42 dager. <strong style={{ color: '#F0F0F2' }}>TSB</strong> (form) = CTL − ATL.
        {' '}Tallene forbehandles med 42 dagers oppvarming før periodestart for at CTL skal være stabilt.
        {' '}Positive TSB betyr uthvilt — kropp er klar for høy belastning eller konkurranse.
        {' '}Negative TSB betyr akkumulert belastning — planlegg restitusjon.
      </p>
    </div>
  )
}
