'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import type { ShootingDepthAnalysis, ShootingSeriesRow } from '@/app/actions/analysis'
import { getShotSeasonProgress, type ShotSeasonProgress } from '@/app/actions/analysis'
import { useEffect, useState } from 'react'
import { ChartWrapper } from './ChartWrapper'
import {
  XpTooltip, CHART_GRID, CHART_AXIS_TICK, CHART_AXIS_LINE, CHART_LEGEND_STYLE,
  CHART_CURSOR, BAR_RADIUS,
} from './chart-theme'
import { CustomSkytingChartBuilder } from './CustomSkytingChartBuilder'
import { TestComparison } from './TestComparison'
import { ShotVolumeChart } from './ShotVolumeChart'
import type { DateRange } from './date-range'
import { windShort, sightLabel } from '@/lib/shooting'

const COLOR_PRONE = '#38BDF8'      // liggende (blå)
const COLOR_STANDING = '#FF4500'   // stående (oransje)
const COLOR_TOTAL = '#F0F0F2'
const COLOR_TRAIN = '#28A86E'
const COLOR_COMP = '#E23A5A'

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

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}%`
}

export function SkytingTab({ data, range, targetUserId }: {
  data: ShootingDepthAnalysis
  // Kø #47 bolk 6: skudd-grafen trenger perioden + trener-drilldown.
  range?: DateRange
  targetUserId?: string
}) {
  if (data.sportMismatch) {
    return (
      <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Skyting-dybde gjelder bare skiskyting. Endre sport-filter til «Alle» eller «Skiskyting» for å se dataene.
        </p>
      </div>
    )
  }
  if (!data.hasData) {
    return (
      <div className="py-16 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Ingen skyte-serier i perioden. Registrer skyting (liggende/stående/kombinert) på biathlon-økter for å se dybde-analyse.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SummaryCards data={data} />
      {/* Kø #47 bolk 7: skuddmengde mot årsmål (sesong-basert). */}
      <ShotGoalCard targetUserId={targetUserId} />
      {/* Kø #47 bolk 6: skudd per uke/måned m/ typefordeling + treff %-rad
          — samme komponent som i månedsanalysen under kalenderen. */}
      {range && (
        <ShotVolumeChart range={range} targetUserId={targetUserId} title="Skudd per uke" />
      )}
      {/* Kø #49 bolk 5: test-sammenligning — gjennomføringer av samme
          skytetest-mal side om side + trend (selvskjulende uten tester). */}
      <TestComparison targetUserId={targetUserId} />
      <CustomSkytingChartBuilder data={data} />
      <AccuracyTrend data={data} />
      <HrZoneAccuracy data={data} />
      <WindAccuracy data={data} />
      <FirstVsLast data={data} />
      <TimeTrend data={data} />
      <TrainingVsComp data={data} />
      <PerWorkoutType data={data} />
      <CsvExport data={data} />
      <MethodNote />
    </div>
  )
}

// Kø #47 bolk 7: «Skuddmengde mot årsmål» — fremdriftsbar (hittil/mål/%)
// + fordeling reelle / tørr (TID, presisering) / i konkurranse / snitt per
// uke. Veiledningstall — ALDRI røde alarmfarger. Uten satt mål: fordelingen
// vises, mål-baren skjules. Målet settes på sesongen (rediger sesong i
// årsplanen). Selvskjulende uten sesong/skyting.
function ShotGoalCard({ targetUserId }: { targetUserId?: string }) {
  const [prog, setProg] = useState<ShotSeasonProgress | null>(null)
  useEffect(() => {
    let cancelled = false
    getShotSeasonProgress(targetUserId)
      .then(res => { if (!cancelled) setProg(res && !('error' in res) ? res : null) })
      .catch(() => { if (!cancelled) setProg(null) })
    return () => { cancelled = true }
  }, [targetUserId])

  if (!prog || (prog.shots <= 0 && prog.drySeconds <= 0 && prog.goal == null)) return null
  const pct = prog.goal && prog.goal > 0 ? Math.min(100, (prog.shots / prog.goal) * 100) : null
  const fmtN = (n: number) => n.toLocaleString('nb-NO')

  return (
    <ChartWrapper
      chartKey="shot-goal"
      title="Skuddmengde mot årsmål"
      subtitle={`${prog.seasonName} · ${prog.from} → ${prog.to} · veiledningstall`}
      height="auto"
    >
      <div className="flex flex-col gap-3">
        {prog.goal != null && prog.goal > 0 ? (
          <div>
            <div className="flex items-baseline justify-between mb-1.5"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: '0.04em', color: '#F2F2F0' }}>
                {fmtN(prog.shots)} <span style={{ fontSize: 15, color: '#8B8B95' }}>/ {fmtN(prog.goal)} skudd</span>
              </span>
              <span style={{ fontSize: 14, color: '#C0C0CC' }}>{Math.round((prog.shots / prog.goal) * 100)} %</span>
            </div>
            <div style={{ height: 9, borderRadius: 5, background: 'var(--line)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`, borderRadius: 5,
                background: 'linear-gradient(90deg, var(--accent), rgba(255,69,0,0.55))',
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
        ) : (
          <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ingen årsskuddmål satt — sett det på sesongen i årsplanen for å få fremdriftsbaren.
          </p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13.5px', color: '#8A8A96' }}>
          <span>Reelle skudd <b style={{ color: '#F0F0F2' }}>{fmtN(prog.shots)}</b></span>
          <span>I konkurranse <b style={{ color: '#D4A017' }}>{fmtN(prog.competitionShots)}</b></span>
          <span>Tørrtrening <b style={{ color: '#F0F0F2' }}>{Math.round(prog.drySeconds / 60)} min</b></span>
          {prog.avgPerWeek != null && (
            <span>Snitt <b style={{ color: '#F0F0F2' }}>{fmtN(prog.avgPerWeek)}</b> skudd/uke</span>
          )}
        </div>
      </div>
    </ChartWrapper>
  )
}

function SummaryCards({ data }: { data: ShootingDepthAnalysis }) {
  const { series, shots, accuracy_pct, prone_accuracy_pct, standing_accuracy_pct, prone_shots, standing_shots } = data.totals
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Totalt treff%" value={fmtPct(accuracy_pct)}
        sub={`${shots} skudd · ${series} serier`} accent={COLOR_TOTAL} />
      <StatCard label="Liggende" value={fmtPct(prone_accuracy_pct)}
        sub={`${prone_shots} skudd`} accent={COLOR_PRONE} />
      <StatCard label="Stående" value={fmtPct(standing_accuracy_pct)}
        sub={`${standing_shots} skudd`} accent={COLOR_STANDING} />
      <StatCard label="Konkurranse" value={fmtPct(data.trainingVsComp.competition.accuracy_pct)}
        sub={`${data.trainingVsComp.competition.series} serier i konk.`} accent={COLOR_COMP} />
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="p-4 flex flex-col gap-1"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, borderLeft: `3px solid ${accent}`, minHeight: '110px' }}>
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </p>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '40px', lineHeight: 1, letterSpacing: '0.03em' }}>
        {value}
      </span>
      <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {sub}
      </p>
    </div>
  )
}

export function AccuracyTrend({ data }: { data: ShootingDepthAnalysis }) {
  const rows = useMemo(() => data.accuracyTrend.map(p => ({
    date: p.date,
    label: formatDateShort(p.date),
    Liggende: p.prone_pct,
    Stående: p.standing_pct,
    Total: p.total_pct,
  })), [data.accuracyTrend])
  const tickInterval = Math.max(0, Math.floor(rows.length / 10) - 1)

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Treff% per stilling over tid
        </p>
      </div>
      <ChartWrapper chartKey="skyting_accuracy_over_time" title="Utvikling per dag" subtitle="Én verdi per dag — aggregert på tvers av alle serier i økten." height={280}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
              interval={tickInterval} minTickGap={8} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40}
              domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<XpTooltip />}
              formatter={(v, k) => [typeof v === 'number' ? `${v.toFixed(1)}%` : '—', String(k)]} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            <Line type="monotone" dataKey="Liggende" stroke={COLOR_PRONE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="Stående" stroke={COLOR_STANDING} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="Total" stroke={COLOR_TOTAL} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

export function HrZoneAccuracy({ data }: { data: ShootingDepthAnalysis }) {
  if (data.accuracyByHrZone.length === 0) return null
  const rows = data.accuracyByHrZone.map(b => ({
    zone: b.zone, accuracy: b.accuracy_pct ?? 0, shots: b.shots,
  }))
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Treff% i puls-soner
        </p>
      </div>
      <ChartWrapper chartKey="skyting_accuracy_hr_zones" title="Treff vs. pulsbelastning"
        subtitle="Gruppert etter seriens snittpuls — viser hvor mye pulsen koster i treff."
        height={260}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="zone" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40}
              domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR}
              formatter={(v, k, p) => {
                if (k === 'accuracy') {
                  const payload = p && typeof p === 'object' && 'payload' in p ? (p as { payload: { shots: number } }).payload : null
                  return [`${typeof v === 'number' ? v.toFixed(1) : v}% (${payload?.shots ?? 0} skudd)`, 'Treff%']
                }
                return [String(v ?? ''), String(k)]
              }} />
            <Bar dataKey="accuracy" fill={COLOR_STANDING} name="Treff%" radius={BAR_RADIUS} />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

// TREFF% PER VINDFORHOLD — én rad per vindforhold, liggende og stående side
// om side. Horisontale søyler fordi etikettene («Vindstille», «V3 mot
// venstre») er navn, ikke tall: de får plass til venstre uten å stå på skrå.
//
// Radene sorteres som en SKALA fra venstre vind, gjennom vindstille, til
// høyre vind — da blir en skjevhet mellom sidene synlig med én gang, i
// stedet for å drukne i alfabetisk rekkefølge.
//
// Kun-førte-regelen: prosenten deles på skudd der treff faktisk ER ført.
// Serier uten registrert vind (vind_styrke null) holdes helt utenfor — det
// er ikke «vindstille», det er ukjent, og skal ikke gjettes inn.
// Selvskjulende: har du aldri ført vind, kommer ikke kortet.
export function WindAccuracy({ data }: { data: ShootingDepthAnalysis }) {
  const rows = useMemo(() => {
    type Agg = { label: string; order: number; recL: number; hitL: number; recS: number; hitS: number }
    const per = new Map<string, Agg>()
    for (const r of data.series) {
      if (r.vind_styrke == null) continue
      const styrke = Math.min(r.vind_styrke, 5)
      // windShort er appens egen etikett for et vindforhold ('0' | 'V3' |
      // 'H5') — samme fasit som chips og tooltips bruker.
      const kort = windShort(r.vind_retning, r.vind_styrke)
      if (!kort) continue
      const label = styrke === 0
        ? 'Vindstille'
        : `${kort} ${r.vind_retning === 'V' ? '← venstre' : '→ høyre'}`
      // Skala: venstre vind negativt, vindstille 0, høyre vind positivt.
      const order = styrke === 0 ? 0 : (r.vind_retning === 'V' ? -styrke : styrke)
      const a = per.get(label) ?? { label, order, recL: 0, hitL: 0, recS: 0, hitS: 0 }
      a.recL += r.prone_recorded_shots
      a.hitL += r.prone_hits
      a.recS += r.standing_recorded_shots
      a.hitS += r.standing_hits
      per.set(label, a)
    }
    return Array.from(per.values())
      .filter(a => a.recL > 0 || a.recS > 0)
      .sort((a, b) => a.order - b.order)
      .map(a => ({
        label: a.label,
        // null (ikke 0) når posisjonen ikke er skutt i dette forholdet —
        // en 0-søyle ville påstått at man bommet på alt.
        liggende: a.recL > 0 ? Math.round((a.hitL / a.recL) * 1000) / 10 : null,
        staaende: a.recS > 0 ? Math.round((a.hitS / a.recS) * 1000) / 10 : null,
        skuddL: a.recL,
        skuddS: a.recS,
      }))
  }, [data.series])

  if (rows.length === 0) return null

  // Kortet vokser med antall forhold — ellers klemmes radene sammen.
  const høyde = Math.max(200, 56 + rows.length * 46)

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Treff% per vindforhold
        </p>
      </div>
      <ChartWrapper chartKey="skyting_wind_accuracy" title="Treff vs. vind"
        subtitle="Liggende og stående side om side per vindforhold · kun serier der vind er ført"
        height={høyde}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
              tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis type="category" dataKey="label" width={104}
              tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR}
              formatter={(v, k, p) => {
                const rad = p && typeof p === 'object' && 'payload' in p
                  ? (p as { payload: { skuddL: number; skuddS: number } }).payload
                  : null
                const skudd = k === 'liggende' ? rad?.skuddL : rad?.skuddS
                const navn = k === 'liggende' ? 'Liggende' : 'Stående'
                if (v == null) return ['—', navn]
                return [`${typeof v === 'number' ? v.toFixed(1) : v}% (${skudd ?? 0} skudd)`, navn]
              }} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            <Bar dataKey="liggende" name="Liggende" fill={COLOR_PRONE} radius={BAR_RADIUS} />
            <Bar dataKey="staaende" name="Stående" fill={COLOR_STANDING} radius={BAR_RADIUS} />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

function FirstVsLast({ data }: { data: ShootingDepthAnalysis }) {
  const { firstVsLast } = data
  if (firstVsLast.workouts_with_multiple_series === 0) return null
  const delta = (firstVsLast.first_accuracy_pct != null && firstVsLast.last_accuracy_pct != null)
    ? Math.round((firstVsLast.last_accuracy_pct - firstVsLast.first_accuracy_pct) * 10) / 10
    : null
  const deltaHr = (firstVsLast.first_avg_hr != null && firstVsLast.last_avg_hr != null)
    ? firstVsLast.last_avg_hr - firstVsLast.first_avg_hr
    : null

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Første vs. siste serie
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
        <InlineStat label="Første serie — treff%" value={fmtPct(firstVsLast.first_accuracy_pct)}
          sub={firstVsLast.first_avg_hr != null ? `snittpuls ${firstVsLast.first_avg_hr}` : undefined} />
        <InlineStat label="Siste serie — treff%" value={fmtPct(firstVsLast.last_accuracy_pct)}
          sub={firstVsLast.last_avg_hr != null ? `snittpuls ${firstVsLast.last_avg_hr}` : undefined} />
        <InlineStat label="Endring treff%"
          value={delta == null ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(1) + '%'}
          color={delta != null ? (delta >= 0 ? '#28A86E' : '#E23A5A') : '#F0F0F2'}
          sub="siste minus første" />
        <InlineStat label="Endring puls"
          value={deltaHr == null ? '—' : (deltaHr > 0 ? '+' : '') + deltaHr.toString()}
          sub={`${firstVsLast.workouts_with_multiple_series} økter med ≥2 serier`} />
      </div>
    </div>
  )
}

function InlineStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: color ?? '#F0F0F2', fontSize: '28px', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>{sub}</p>}
    </div>
  )
}

export function TimeTrend({ data }: { data: ShootingDepthAnalysis }) {
  if (data.timeTrend.length === 0) return null
  const rows = data.timeTrend.map(p => ({
    date: p.date, label: formatDateShort(p.date), sekunder: p.avg_seconds,
  }))
  const tickInterval = Math.max(0, Math.floor(rows.length / 10) - 1)
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Skytetid-progresjon
        </p>
      </div>
      <ChartWrapper chartKey="skyting_time_per_series" title="Snitt sekunder per serie"
        subtitle="Utvikling i hastighet ved skytevolden."
        height={240}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false}
              interval={tickInterval} minTickGap={8} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40}
              domain={[0, 'auto']} tickFormatter={(v) => `${v}s`} />
            <Tooltip content={<XpTooltip />}
              formatter={(v) => [`${v} s`, 'Snittid']} />
            <Line type="monotone" dataKey="sekunder" stroke={COLOR_STANDING} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

export function TrainingVsComp({ data }: { data: ShootingDepthAnalysis }) {
  const { training, competition } = data.trainingVsComp
  const rows = [
    { kategori: 'Trening', Treff: training.accuracy_pct ?? 0, serier: training.series, skudd: training.shots },
    { kategori: 'Konkurranse', Treff: competition.accuracy_pct ?? 0, serier: competition.series, skudd: competition.shots },
  ]
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Trening vs. konkurranse
        </p>
      </div>
      <ChartWrapper chartKey="skyting_training_vs_comp" title="Treff% i kontekst"
        subtitle="Mental fasthet — sammenlign skyting på trening og i konkurransesituasjon."
        height={220}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="kategori" tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={40}
              domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<XpTooltip />} cursor={CHART_CURSOR}
              formatter={(v, k, p) => {
                if (k === 'Treff') {
                  const payload = p && typeof p === 'object' && 'payload' in p ? (p as { payload: { serier: number; skudd: number } }).payload : null
                  return [`${typeof v === 'number' ? v.toFixed(1) : v}% (${payload?.serier ?? 0} serier · ${payload?.skudd ?? 0} skudd)`, 'Treff%']
                }
                return [String(v ?? ''), String(k)]
              }} />
            <Bar dataKey="Treff" name="Treff%" radius={BAR_RADIUS}>
              <Cell fill={COLOR_TRAIN} />
              <Cell fill={COLOR_COMP} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}

function PerWorkoutType({ data }: { data: ShootingDepthAnalysis }) {
  if (data.perWorkoutType.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Skyting per økt-type
        </p>
      </div>
      <div className="overflow-x-auto xp-hscroll" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
        <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          <thead>
            <tr style={{ color: '#8A8A96', borderBottom: '1px solid #1E1E22' }}>
              <th className="text-left px-3 py-2 text-xs tracking-widest uppercase">Økt-type</th>
              <th className="text-right px-3 py-2 text-xs tracking-widest uppercase">Serier</th>
              <th className="text-right px-3 py-2 text-xs tracking-widest uppercase">Skudd</th>
              <th className="text-right px-3 py-2 text-xs tracking-widest uppercase">Treff</th>
              <th className="text-right px-3 py-2 text-xs tracking-widest uppercase">Treff%</th>
            </tr>
          </thead>
          <tbody>
            {data.perWorkoutType.map(r => (
              <tr key={r.workout_type} style={{ color: '#F0F0F2', borderBottom: '1px solid #1E1E22' }}>
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 text-right">{r.series}</td>
                <td className="px-3 py-2 text-right">{r.shots}</td>
                <td className="px-3 py-2 text-right">{r.hits}</td>
                <td className="px-3 py-2 text-right" style={{ color: '#FF8C00' }}>{fmtPct(r.accuracy_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CsvExport({ data }: { data: ShootingDepthAnalysis }) {
  const handleExport = () => {
    // Seriemodellen (bolk 9): én rad per serie m/ serie-tid og serie-puls.
    // treff_foert skiller «0 treff» fra «treff ikke ført» (kun-førte-regelen).
    const header = ['dato', 'okt_type', 'serie_nr', 'aktivitet', 'ligg_skudd', 'ligg_treff', 'sta_skudd', 'sta_treff', 'treff_foert', 'varighet_sek', 'snittpuls', 'makspuls', 'vind', 'sikt', 'i_konkurranse']
    const rows: string[][] = [header]
    const sorted: ShootingSeriesRow[] = [...data.series].sort((a, b) =>
      a.date.localeCompare(b.date) || a.sort_order - b.sort_order)
    for (const r of sorted) {
      rows.push([
        r.date, r.workout_type, r.sort_order.toString(), r.activity_type,
        r.prone_shots.toString(), r.prone_hits.toString(),
        r.standing_shots.toString(), r.standing_hits.toString(),
        r.prone_recorded_shots + r.standing_recorded_shots > 0 ? 'ja' : 'nei',
        r.duration_seconds != null ? r.duration_seconds.toString() : '',
        r.avg_heart_rate != null ? r.avg_heart_rate.toString() : '',
        r.max_heart_rate != null ? r.max_heart_rate.toString() : '',
        windShort(r.vind_retning, r.vind_styrke) ?? '',
        sightLabel(r.sikt) ?? '',
        r.in_competition ? 'ja' : 'nei',
      ])
    }
    const first = sorted[0]?.date ?? 'start'
    const last = sorted[sorted.length - 1]?.date ?? 'slutt'
    downloadCsv(`skyting_${first}_${last}.csv`, rows)
  }

  return (
    <div className="p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <div>
        <p className="text-xs tracking-widest uppercase mb-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Eksport
        </p>
        <p className="text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Last ned hver skyte-serie med skudd, treff, varighet, puls og kontekst.
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
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Slik beregnes tallene
      </p>
      <p className="text-xs leading-relaxed"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Én <strong style={{ color: '#F0F0F2' }}>serie</strong> = én skyte-aktivitet (liggende, stående, kombinert, innskyting eller basis). Treff% = treff / skudd × 100.
        {' '}<strong style={{ color: '#F0F0F2' }}>Puls-soner</strong> bruker aktivitetens snittpuls — lavere puls gir normalt bedre treff.
        {' '}<strong style={{ color: '#F0F0F2' }}>Første vs. siste</strong> sammenligner første og siste serie <em>innen samme økt</em> — speiler tretthet og konsentrasjon.
        {' '}<strong style={{ color: '#F0F0F2' }}>Trening vs. konkurranse</strong> splittes på økt-type <em>competition</em> og <em>testlop</em> mot alle andre.
      </p>
    </div>
  )
}
