'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ReferenceDot,
} from 'recharts'
import type { Sport } from '@/lib/types'
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_COLOR } from '@/components/analysis/ChartWrapper'

// Sample-arrays slik de er lagret i workout_samples-tabellen.
type HrSample = { t: number; hr: number }
type WattSample = { t: number; w: number }
type SpeedSample = { t: number; mps: number }
type AltSample = { t: number; alt: number }
type CadSample = { t: number; cad: number }

export interface WorkoutSamples {
  hr_samples: HrSample[] | null
  watt_samples: WattSample[] | null
  pace_samples: SpeedSample[] | null
  speed_samples: SpeedSample[] | null
  altitude_samples: AltSample[] | null
  cadence_samples: CadSample[] | null
}

export interface LapMarker {
  // Sekunder fra økt-start der lap-en starter.
  t_start: number
  index: number
  label?: string
}

export interface LactateMarker {
  // Sekunder fra økt-start.
  t: number
  mmol: number
}

export interface NutritionMarker {
  t: number
  type: string
  carbs_g: number | null
}

export interface ShootingMarker {
  t: number
  hits: number
  shots: number
  position: 'prone' | 'standing'
}

interface Props {
  sport: Sport
  samples: WorkoutSamples
  laps?: LapMarker[]
  lactate?: LactateMarker[]
  nutrition?: NutritionMarker[]
  shooting?: ShootingMarker[]
  height?: number
}

// Hovedgraf for klokkesync-detaljer. Kombinerer puls/watt/pace/cadence/altitude
// på én tidsakse, med markører for laps, laktat, ernæring og skyting.
//
// Skjuler automatisk linjer som ikke gir mening for sporten:
// - Watt skjules for langrenn/skiskyting/løping (uvanlig med power-meter)
// - Pace vises som tempo for løping/langrenn, som hastighet for sykling
// - Skytemarkører kun for skiskyting
//
// Brukeren kan toggle linjer av/på via legend.
export function WorkoutDetailChart({
  sport, samples, laps = [], lactate = [], nutrition = [], shooting = [],
  height = 360,
}: Props) {
  // Beregn relevante linjer basert på sport + samples-tilgjengelighet.
  const visibility = computeVisibility(sport, samples)

  // Aktiv av/på-toggle per linje (init = visibility default).
  const [active, setActive] = useState<Record<string, boolean>>({
    hr: visibility.hr,
    watt: visibility.watt,
    pace: visibility.pace,
    cadence: visibility.cadence,
    altitude: visibility.altitude,
  })

  // Slå sammen alle samples til én tidsserie for chart-en.
  const merged = useMemo(() => mergeSamples(samples), [samples])

  // Hvis det ikke finnes noen samples, vis tom-tilstand.
  const hasAnyData = merged.length > 0
  if (!hasAnyData) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
          Ingen sekund-data registrert for denne økten.
          Importer fra Strava eller last opp .fit-fil for å se grafen.
        </p>
      </div>
    )
  }

  const totalSeconds = merged[merged.length - 1]?.t ?? 0
  const xTicks = computeXTicks(totalSeconds)

  return (
    <div className="p-4" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Økt-graf
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {visibility.hr && (
            <ToggleChip color="#FF4500" label="Puls" on={active.hr}
              onClick={() => setActive(s => ({ ...s, hr: !s.hr }))} />
          )}
          {visibility.watt && (
            <ToggleChip color="#FFB300" label="Watt" on={active.watt}
              onClick={() => setActive(s => ({ ...s, watt: !s.watt }))} />
          )}
          {visibility.pace && (
            <ToggleChip color="#3DD68C" label={paceLabel(sport)} on={active.pace}
              onClick={() => setActive(s => ({ ...s, pace: !s.pace }))} />
          )}
          {visibility.cadence && (
            <ToggleChip color="#7AA2FF" label="Kadens" on={active.cadence}
              onClick={() => setActive(s => ({ ...s, cadence: !s.cadence }))} />
          )}
          {visibility.altitude && (
            <ToggleChip color="#8A8A96" label="Høyde" on={active.altitude}
              onClick={() => setActive(s => ({ ...s, altitude: !s.altitude }))} />
          )}
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={merged} margin={{ top: 10, right: 28, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, totalSeconds]}
              ticks={xTicks}
              tickFormatter={fmtTime}
              tick={AXIS_STYLE}
              stroke={GRID_COLOR}
            />
            {/* Venstre y-akse: puls + cadence (begge i samme bpm/spm-range). */}
            <YAxis
              yAxisId="left"
              tick={AXIS_STYLE}
              stroke={GRID_COLOR}
              width={36}
            />
            {/* Høyre y-akse: watt eller m/s afhengig av synlighet. */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={AXIS_STYLE}
              stroke={GRID_COLOR}
              width={42}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => `Tid: ${fmtTime(Number(v))}`}
              formatter={(value, name) => formatTooltipValue(value, String(name), sport)}
            />
            <Legend
              wrapperStyle={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '11px',
                color: '#8A8A96',
              }}
            />

            {/* Lap-grenser: vertikale stiplete linjer på venstre y-akse. */}
            {laps.map((lap, i) =>
              i === 0 ? null : (
                <ReferenceLine
                  key={`lap-${i}`}
                  yAxisId="left"
                  x={lap.t_start}
                  stroke="#3A3A42"
                  strokeDasharray="2 4"
                />
              )
            )}

            {/* Laktat-markører: rød prikk på venstre y-akse, plassert på pulslinjen. */}
            {active.hr && lactate.map((lac, i) => {
              const hrAt = findValueAt(samples.hr_samples, lac.t)
              if (hrAt == null) return null
              return (
                <ReferenceDot
                  key={`lac-${i}`}
                  x={lac.t}
                  y={hrAt}
                  yAxisId="left"
                  r={5}
                  fill="#E11D48"
                  stroke="#0A0A0B"
                  strokeWidth={1.5}
                  ifOverflow="visible"
                />
              )
            })}

            {/* Ernærings-markører: gul/oransje på pulslinjen om HR finnes, ellers øverst. */}
            {nutrition.map((n, i) => {
              const hrAt = active.hr ? findValueAt(samples.hr_samples, n.t) : null
              return (
                <ReferenceDot
                  key={`nut-${i}`}
                  x={n.t}
                  y={hrAt ?? 0}
                  yAxisId="left"
                  r={4}
                  fill="#FFB300"
                  stroke="#0A0A0B"
                  strokeWidth={1.5}
                  ifOverflow="visible"
                />
              )
            })}

            {/* Skyte-markører — grønn for treff, rødere for bom. */}
            {sport === 'biathlon' && shooting.map((s, i) => {
              const hrAt = active.hr ? findValueAt(samples.hr_samples, s.t) : null
              const allHits = s.hits === s.shots && s.shots > 0
              return (
                <ReferenceDot
                  key={`sht-${i}`}
                  x={s.t}
                  y={hrAt ?? 0}
                  yAxisId="left"
                  r={5}
                  fill={allHits ? '#3DD68C' : '#FF4500'}
                  stroke="#0A0A0B"
                  strokeWidth={1.5}
                  ifOverflow="visible"
                />
              )
            })}

            {visibility.altitude && active.altitude && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="alt"
                name="Høyde (m)"
                stroke="#8A8A96"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibility.cadence && active.cadence && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="cad"
                name="Kadens"
                stroke="#7AA2FF"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibility.watt && active.watt && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="w"
                name="Watt"
                stroke="#FFB300"
                strokeWidth={1.4}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibility.pace && active.pace && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="mps"
                name={paceLabel(sport)}
                stroke="#3DD68C"
                strokeWidth={1.4}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibility.hr && active.hr && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="hr"
                name="Puls"
                stroke="#FF4500"
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <MarkerLegend
        hasLactate={lactate.length > 0}
        hasNutrition={nutrition.length > 0}
        hasShooting={sport === 'biathlon' && shooting.length > 0}
        hasLaps={laps.length > 1}
      />
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function ToggleChip({
  color, label, on, onClick,
}: {
  color: string; label: string; on: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        background: 'none',
        border: `1px solid ${on ? color : '#1E1E22'}`,
        color: on ? color : '#555560',
        padding: '4px 10px',
        cursor: 'pointer',
        opacity: on ? 1 : 0.6,
      }}
    >
      <span style={{
        display: 'inline-block', width: 8, height: 8, marginRight: 6,
        backgroundColor: on ? color : 'transparent',
        border: `1px solid ${color}`,
        verticalAlign: 'middle',
      }} />
      {label}
    </button>
  )
}

function MarkerLegend({
  hasLactate, hasNutrition, hasShooting, hasLaps,
}: {
  hasLactate: boolean; hasNutrition: boolean; hasShooting: boolean; hasLaps: boolean
}) {
  if (!hasLactate && !hasNutrition && !hasShooting && !hasLaps) return null
  return (
    <div className="flex gap-4 mt-2 flex-wrap text-xs"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {hasLaps && <span>┊ Lap-grense</span>}
      {hasLactate && <span style={{ color: '#E11D48' }}>● Laktat</span>}
      {hasNutrition && <span style={{ color: '#FFB300' }}>● Ernæring</span>}
      {hasShooting && <span><span style={{ color: '#3DD68C' }}>●</span>/<span style={{ color: '#FF4500' }}>●</span> Skyting (treff/bom)</span>}
    </div>
  )
}

function computeVisibility(sport: Sport, s: WorkoutSamples) {
  const has = {
    hr: !!s.hr_samples?.length,
    watt: !!s.watt_samples?.length,
    pace: !!(s.pace_samples?.length || s.speed_samples?.length),
    cadence: !!s.cadence_samples?.length,
    altitude: !!s.altitude_samples?.length,
  }
  // Sport-spesifikt: skjul watt for sporter der det sjelden er meningsfylt
  // selv om streamen finnes (f.eks. løping uten power-meter).
  const wattRelevant = sport === 'cycling' || sport === 'triathlon' ||
                       sport === 'long_distance_skiing' || sport === 'cross_country_skiing' ||
                       sport === 'biathlon' || sport === 'running'
  return {
    hr: has.hr,
    watt: has.watt && wattRelevant,
    pace: has.pace,
    cadence: has.cadence,
    altitude: has.altitude,
  }
}

function paceLabel(sport: Sport): string {
  if (sport === 'cycling' || sport === 'triathlon') return 'Hastighet'
  return 'Tempo'
}

function formatTooltipValue(value: unknown, name: string, sport: Sport): [string, string] {
  if (typeof value !== 'number') return [String(value), name]
  if (name === 'Puls') return [`${Math.round(value)} bpm`, name]
  if (name === 'Watt') return [`${Math.round(value)} W`, name]
  if (name === 'Kadens') return [`${Math.round(value)}`, name]
  if (name === 'Høyde (m)') return [`${Math.round(value)} m`, name]
  if (name === 'Tempo' || name === 'Hastighet') {
    if (sport === 'cycling' || sport === 'triathlon') {
      return [`${(value * 3.6).toFixed(1)} km/t`, name]
    }
    // m/s → min/km. value=0 → uendelig pace; vis "—".
    if (value <= 0.1) return ['—', name]
    const secPerKm = 1000 / value
    const m = Math.floor(secPerKm / 60)
    const s = Math.round(secPerKm % 60)
    return [`${m}:${String(s).padStart(2,'0')}/km`, name]
  }
  return [String(value), name]
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

function computeXTicks(total: number): number[] {
  if (total <= 0) return [0]
  // Mål: 6-8 ticks. Velg interval som ~ total/7, rundet til pent tall.
  const step = niceStep(total / 7)
  const ticks: number[] = []
  for (let t = 0; t <= total; t += step) ticks.push(t)
  if (ticks[ticks.length - 1] !== total) ticks.push(total)
  return ticks
}

function niceStep(x: number): number {
  const candidates = [30, 60, 120, 300, 600, 900, 1800, 3600, 7200]
  for (const c of candidates) {
    if (x <= c) return c
  }
  return Math.ceil(x / 3600) * 3600
}

// Slår sammen alle samples til éne array m/{t, hr?, w?, mps?, cad?, alt?}.
// t-er kommer ofte tett (per-sekund) — vi kvantiserer til samme akse for at
// alle linjer skal ha lik X.
function mergeSamples(s: WorkoutSamples): Array<{
  t: number
  hr?: number; w?: number; mps?: number; cad?: number; alt?: number
}> {
  const map = new Map<number, {
    t: number; hr?: number; w?: number; mps?: number; cad?: number; alt?: number
  }>()
  const speedArr = s.pace_samples ?? s.speed_samples
  const add = <K extends 'hr' | 'w' | 'mps' | 'cad' | 'alt'>(
    arr: Array<{ t: number } & Record<K, number>> | null | undefined,
    key: K,
  ) => {
    if (!arr) return
    for (const r of arr) {
      const existing = map.get(r.t)
      if (existing) {
        existing[key] = r[key]
      } else {
        map.set(r.t, { t: r.t, [key]: r[key] } as ReturnType<typeof map.get> & { t: number })
      }
    }
  }
  add(s.hr_samples ?? null, 'hr')
  add(s.watt_samples ?? null, 'w')
  add(speedArr ?? null, 'mps')
  add(s.cadence_samples ?? null, 'cad')
  add(s.altitude_samples ?? null, 'alt')
  return Array.from(map.values()).sort((a, b) => a.t - b.t)
}

// Finn nærmeste hr-verdi for en gitt t. Brukes for å plassere markører på
// pulslinjen heller enn å feste seg helt nederst i grafen.
function findValueAt(arr: HrSample[] | null, t: number): number | null {
  if (!arr || arr.length === 0) return null
  // Binærsøk er ikke verdt det her (≤ tusenvis av punkter, og dette skjer
  // for noen få markører totalt).
  let best = arr[0]
  let bestDiff = Math.abs(best.t - t)
  for (const r of arr) {
    const d = Math.abs(r.t - t)
    if (d < bestDiff) { best = r; bestDiff = d }
  }
  return best.hr
}
