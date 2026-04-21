'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ZAxis, ReferenceLine,
} from 'recharts'
import type { TerskelAnalysis, LactatePoint } from '@/app/actions/analysis'
import { ChartWrapper, TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from './ChartWrapper'

const COLOR_PTS = '#FF4500'
const COLOR_REG = '#38BDF8'
const COLOR_LT1 = '#28A86E'
const COLOR_LT2 = '#E11D48'
const COLOR_PROFILE = '#D4A017'

function formatDateShort(iso: string): string {
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

export function TerskelTab({ data }: { data: TerskelAnalysis }) {
  if (!data.hasData) {
    return (
      <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Ingen laktatmålinger i perioden. Legg inn mmol/L-verdier på aktiviteter (test-økter og terskelintervaller) for å se laktatprofil og terskelpuls-estimat.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <EstimateCards data={data} />
      <LactateProfile data={data} />
      <LactateTrend data={data} />
      <TemplateTable data={data} />
      <CsvExport data={data} />
      <MethodNote />
    </div>
  )
}

function EstimateCards({ data }: { data: TerskelAnalysis }) {
  const { lt1_hr, lt2_hr, profile_threshold_hr, regression } = data.estimate
  const r2pct = regression ? Math.round(regression.r2 * 100) : null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="LT1 (2 mmol)" value={lt1_hr != null ? `${lt1_hr}` : '—'}
        sub="Aerob terskel — estimert puls" accent={COLOR_LT1} />
      <StatCard label="LT2 (4 mmol)" value={lt2_hr != null ? `${lt2_hr}` : '—'}
        sub="Anaerob terskel — estimert puls" accent={COLOR_LT2} />
      <StatCard label="Profil-terskel" value={profile_threshold_hr != null ? `${profile_threshold_hr}` : '—'}
        sub="Fra innstillinger" accent={COLOR_PROFILE} />
      <StatCard label="Datapunkter" value={regression ? `${regression.n}` : `${data.points.length}`}
        sub={r2pct != null ? `R² = ${r2pct}% — kurvetilpasning` : 'For få punkter for regresjon'} accent={COLOR_REG} />
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

export function LactateProfile({ data }: { data: TerskelAnalysis }) {
  // Scatter av (mmol, HR) med regresjonslinje over 0–12 mmol.
  const withHr = data.points.filter(p => p.heart_rate != null)
  const regression = data.estimate.regression

  const regressionLine = useMemo(() => {
    if (!regression) return []
    const mmols = withHr.map(p => p.value_mmol)
    const minX = Math.min(0.5, ...(mmols.length ? mmols : [1]))
    const maxX = Math.max(8, ...(mmols.length ? mmols : [6]))
    return [
      { x: minX, y: regression.slope * minX + regression.intercept },
      { x: maxX, y: regression.slope * maxX + regression.intercept },
    ]
  }, [regression, withHr])

  const scatterData = withHr.map(p => ({
    x: p.value_mmol, y: p.heart_rate as number,
    date: p.date, template: p.template_name, sport: p.sport,
  }))

  if (withHr.length === 0) {
    return (
      <div className="p-5" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <p className="text-xs tracking-widest uppercase mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Laktatprofil
        </p>
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen målinger med snittpuls på samme aktivitet — legg inn pulsdata for å se mmol vs HR.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Laktatprofil — mmol/L vs puls
        </p>
      </div>
      <ChartWrapper chartKey="terskel_lactate_profile" title="Scatter med regresjon"
        subtitle="Hvert punkt = én måling (mmol på x, aktivitetens snittpuls på y). Blå linje = lineær regresjon."
        height={340}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} />
            <XAxis type="number" dataKey="x" name="mmol/L" domain={[0, 'auto']}
              tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              label={{ value: 'mmol/L', position: 'insideBottom', offset: -2, style: AXIS_STYLE }} />
            <YAxis type="number" dataKey="y" name="Puls" domain={['auto', 'auto']}
              tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
              label={{ value: 'Puls', angle: -90, position: 'insideLeft', style: AXIS_STYLE }} />
            <ZAxis range={[40, 40]} />
            <ReferenceLine x={2} stroke={COLOR_LT1} strokeDasharray="3 3" label={{ value: 'LT1', position: 'top', fill: COLOR_LT1, fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} />
            <ReferenceLine x={4} stroke={COLOR_LT2} strokeDasharray="3 3" label={{ value: 'LT2', position: 'top', fill: COLOR_LT2, fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray: '3 3', stroke: '#555560' }}
              formatter={(v, k) => {
                if (k === 'x') return [`${v} mmol/L`, 'Laktat']
                if (k === 'y') return [`${v}`, 'Puls']
                return [String(v ?? ''), String(k)]
              }}
              labelFormatter={() => ''} />
            <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }} />
            <Scatter name="Målinger" data={scatterData} fill={COLOR_PTS} />
            {regression && regressionLine.length === 2 && (
              <Scatter name={`Regresjon (R²=${Math.round(regression.r2 * 100)}%)`}
                data={regressionLine} line={{ stroke: COLOR_REG, strokeWidth: 2 }} lineType="fitting"
                shape={() => <g />} fill="transparent" />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

export function LactateTrend({ data }: { data: TerskelAnalysis }) {
  // Målinger over tid — én linje, dato på x, mmol på y. Gir rask sjekk på
  // om laktat ved tilsvarende intensitet synker (= aerob forbedring).
  const rows = useMemo(() => {
    return [...data.points]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(p => ({ date: p.date, label: formatDateShort(p.date), mmol: p.value_mmol }))
  }, [data.points])

  const tickInterval = Math.max(0, Math.floor(rows.length / 10) - 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Laktat over tid
        </p>
      </div>
      <ChartWrapper chartKey="terskel_lactate_trend" title="Alle målinger" subtitle="Sjekk om laktat synker ved tilsvarende intensitet (= aerob forbedring)." height={240}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false}
              interval={tickInterval} minTickGap={8} />
            <YAxis tick={AXIS_STYLE} axisLine={{ stroke: GRID_COLOR }} tickLine={false} width={40}
              domain={[0, 'auto']} />
            <ReferenceLine y={2} stroke={COLOR_LT1} strokeDasharray="3 3" label={{ value: 'LT1 (2 mmol)', position: 'right', fill: COLOR_LT1, fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }} />
            <ReferenceLine y={4} stroke={COLOR_LT2} strokeDasharray="3 3" label={{ value: 'LT2 (4 mmol)', position: 'right', fill: COLOR_LT2, fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [typeof v === 'number' ? `${v.toFixed(1)} mmol/L` : String(v ?? ''), 'Laktat']} />
            <Line type="monotone" dataKey="mmol" stroke={COLOR_PTS} strokeWidth={2} dot={{ r: 3, fill: COLOR_PTS }} name="mmol/L" />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

function TemplateTable({ data }: { data: TerskelAnalysis }) {
  if (data.byTemplate.length === 0) {
    return null
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Laktat-respons per mal
        </p>
      </div>
      <div className="overflow-x-auto" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
        <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          <thead>
            <tr style={{ color: '#8A8A96', borderBottom: '1px solid #1E1E22' }}>
              <th className="text-left px-3 py-2 text-[11px] tracking-widest uppercase">Mal</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Målinger</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Snitt mmol</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Min</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Maks</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Snittpuls</th>
              <th className="text-right px-3 py-2 text-[11px] tracking-widest uppercase">Siste</th>
            </tr>
          </thead>
          <tbody>
            {data.byTemplate.map(t => (
              <tr key={t.template_id} style={{ color: '#F0F0F2', borderBottom: '1px solid #1E1E22' }}>
                <td className="px-3 py-2">{t.template_name}</td>
                <td className="px-3 py-2 text-right">{t.measurements}</td>
                <td className="px-3 py-2 text-right" style={{ color: '#FF8C00' }}>{t.avg_mmol.toFixed(2)}</td>
                <td className="px-3 py-2 text-right" style={{ color: '#8A8A96' }}>{t.min_mmol.toFixed(1)}</td>
                <td className="px-3 py-2 text-right" style={{ color: '#8A8A96' }}>{t.max_mmol.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{t.avg_hr ?? '—'}</td>
                <td className="px-3 py-2 text-right" style={{ color: '#8A8A96' }}>
                  {t.recent_date ? `${formatDateShort(t.recent_date)} (${t.recent_mmol?.toFixed(1) ?? '—'})` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CsvExport({ data }: { data: TerskelAnalysis }) {
  const handleExport = () => {
    const header = ['dato', 'sport', 'aktivitet', 'mal', 'mmol', 'snittpuls']
    const rows: string[][] = [header]
    const sorted: LactatePoint[] = [...data.points].sort((a, b) => a.date.localeCompare(b.date))
    for (const p of sorted) {
      rows.push([
        p.date,
        p.sport,
        p.activity_type ?? '',
        p.template_name ?? '',
        p.value_mmol.toString(),
        p.heart_rate != null ? p.heart_rate.toString() : '',
      ])
    }
    const first = sorted[0]?.date ?? 'start'
    const last = sorted[sorted.length - 1]?.date ?? 'slutt'
    downloadCsv(`terskel_${first}_${last}.csv`, rows)
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
          Last ned alle laktatmålinger i perioden som CSV (dato, sport, mal, mmol, puls).
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
        <strong style={{ color: '#F0F0F2' }}>LT1/LT2</strong> er puls-estimater ved 2 mmol hhv. 4 mmol, beregnet via lineær regresjon på (mmol, snittpuls) for alle aktiviteter med begge verdier.
        Pulsen er aktivitetens snittpuls — den beste proxyen vi har når målingen ikke kommer med eget pulstag.
        {' '}<strong style={{ color: '#F0F0F2' }}>R²</strong> viser hvor godt linjen passer — jo høyere, jo mer pålitelig estimatet.
        Gode data krever 5+ målinger spredt over lav til høy intensitet.
        {' '}<strong style={{ color: '#F0F0F2' }}>Profil-terskel</strong> er verdien du selv har satt i innstillinger — sammenlign med LT2-estimatet for å validere.
        {' '}Trenden viser om laktat synker ved tilsvarende intensitet — et tegn på aerob forbedring.
      </p>
    </div>
  )
}
