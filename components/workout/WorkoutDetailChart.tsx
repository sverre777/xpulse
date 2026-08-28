'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ReferenceDot, ReferenceArea,
} from 'recharts'
import type { Sport } from '@/lib/types'
import {
  XpTooltip, CHART_GRID, CHART_GRID_ZERO, CHART_AXIS_TICK, CHART_LEGEND_STYLE,
} from '@/components/analysis/chart-theme'
import {
  SEGMENT_FARGER, fmtKlokkeSek, pulsIVindu, type Segment,
} from '@/lib/segmenter'

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
  // «Legg til detaljer» bolk 2: segmentbånd (1c) + skytevinduer på kurven
  // (1b). Ren visning — beregnet i workout-klokkesync fra radene.
  segmenter?: Segment[]
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
  segmenter = [],
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

  // Valgt segment/punktmarkør i båndet — hover ELLER klikk/tapp (touch).
  const [valgt, setValgt] = useState<string | null>(null)

  // Slå sammen alle samples til én tidsserie for chart-en.
  const merged = useMemo(() => mergeSamples(samples), [samples])

  // Hvis det ikke finnes noen samples, vis tom-tilstand.
  const hasAnyData = merged.length > 0
  if (!hasAnyData) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed var(--kant-3)' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', fontSize: '14px' }}>
          Ingen sekund-data registrert for denne økten.
          Importer fra Strava eller last opp .fit-fil for å se grafen.
        </p>
      </div>
    )
  }

  const totalSeconds = merged[merged.length - 1]?.t ?? 0
  const xTicks = computeXTicks(totalSeconds)

  return (
    <div className="p-4" style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)' }}>
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
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
            <ToggleChip color="var(--tekst-5-app)" label="Høyde" on={active.altitude}
              onClick={() => setActive(s => ({ ...s, altitude: !s.altitude }))} />
          )}
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={merged} margin={{ top: 10, right: 28, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, totalSeconds]}
              ticks={xTicks}
              tickFormatter={fmtTime}
              tick={CHART_AXIS_TICK}
              stroke={CHART_GRID_ZERO}
            />
            {/* Venstre y-akse: puls + cadence (begge i samme bpm/spm-range). */}
            <YAxis
              yAxisId="left"
              tick={CHART_AXIS_TICK}
              stroke={CHART_GRID_ZERO}
              width={36}
            />
            {/* Høyre y-akse: watt eller m/s afhengig av synlighet. */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={CHART_AXIS_TICK}
              stroke={CHART_GRID_ZERO}
              width={42}
            />
            <Tooltip
              content={<XpTooltip />}
              labelFormatter={(v) => `Tid: ${fmtTime(Number(v))}`}
              formatter={(value, name) => formatTooltipValue(value, String(name), sport)}
            />
            <Legend
              wrapperStyle={CHART_LEGEND_STYLE}
            />

            {/* Skytevinduer på kurven (fasit 1b) — låst til rundens
                grenser, eller manuelt plassert (fase 113-kolonnene).
                Etikett m/ treff i toppen av vinduet. */}
            {segmenter.filter(sg => sg.paaKurven).map(sg => (
              <ReferenceArea
                key={`vindu-${sg.aktivitetId}`}
                yAxisId="left"
                x1={sg.startSek}
                x2={sg.sluttSek}
                fill={SEGMENT_FARGER[sg.type]}
                fillOpacity={0.14}
                stroke={SEGMENT_FARGER[sg.type]}
                strokeOpacity={0.9}
                ifOverflow="visible"
                label={{
                  value: `${sg.etikett.toUpperCase()}${sg.treff ? ` ${sg.treff}` : ''}`,
                  position: 'insideTop',
                  fill: SEGMENT_FARGER[sg.type],
                  fontSize: 10,
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}
              />
            ))}

            {/* Lap-grenser: vertikale stiplete linjer på venstre y-akse. */}
            {laps.map((lap, i) =>
              i === 0 ? null : (
                <ReferenceLine
                  key={`lap-${i}`}
                  yAxisId="left"
                  x={lap.t_start}
                  stroke="var(--tekst-10-alt)"
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
                  fill="#E23A5A"
                  stroke="var(--flate-3)"
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
                  stroke="var(--flate-3)"
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
                  stroke="var(--flate-3)"
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
                stroke="var(--tekst-5-app)"
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

      {segmenter.length > 0 && totalSeconds > 0 && (
        <SegmentBaand
          segmenter={segmenter}
          totalSek={totalSeconds}
          lactate={lactate}
          nutrition={nutrition}
          hr={samples.hr_samples}
          speed={samples.pace_samples ?? samples.speed_samples}
          sport={sport}
          valgt={valgt}
          onVelg={setValgt}
        />
      )}

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
        border: `1px solid ${on ? color : 'var(--kant-3)'}`,
        color: on ? color : 'var(--tekst-8-app)',
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
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
      {hasLaps && <span>┊ Lap-grense</span>}
      {hasLactate && <span style={{ color: '#E23A5A' }}>● Laktat</span>}
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

// ── Segmentbånd (fasit 1c) ───────────────────────────────────
// Kollapset lesevisning: båndet under kurven viser radene som segmenter i
// tid, punktmarkører (laktat/ernæring) ligger OVER båndet, og hold/tapp på
// et segment eller punkt gir leser-linja under (tid · varighet · snittpuls ·
// treff). Skytevinduer får i tillegg faste leser-rader (fasit 1b).
//
// Innrykkene speiler plot-området i recharts over: venstre = margin.left
// (-8) + y-aksebredde 36 = 28px, høyre = margin.right 28 + 42 = 70px.
// Endres marginene/aksebreddene i LineChart, må disse følge med.
const BAAND_INNRYKK_VENSTRE = 28
const BAAND_INNRYKK_HOYRE = 70

function SegmentBaand({
  segmenter, totalSek, lactate, nutrition, hr, speed, sport, valgt, onVelg,
}: {
  segmenter: Segment[]
  totalSek: number
  lactate: LactateMarker[]
  nutrition: NutritionMarker[]
  hr: HrSample[] | null
  speed: SpeedSample[] | null
  sport: Sport
  valgt: string | null
  onVelg: (id: string | null) => void
}) {
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / totalSek) * 100))}%`

  const valgtSegment = segmenter.find(sg => sg.aktivitetId === valgt) ?? null
  const valgtLaktat = valgt?.startsWith('lac-') ? lactate[Number(valgt.slice(4))] : null
  const valgtNutrition = valgt?.startsWith('nut-') ? nutrition[Number(valgt.slice(4))] : null

  return (
    <div style={{ marginLeft: BAAND_INNRYKK_VENSTRE, marginRight: BAAND_INNRYKK_HOYRE }}>
      {/* Punktmarkører OVER båndet — punkt = tidspunkt + verdi, aldri
          varighet (fasit-notatet). */}
      {(lactate.length > 0 || nutrition.length > 0) && (
        <div style={{ position: 'relative', height: 14 }}>
          {lactate.map((lac, i) => (
            <button key={`lac-${i}`} type="button"
              onMouseEnter={() => onVelg(`lac-${i}`)}
              onClick={() => onVelg(valgt === `lac-${i}` ? null : `lac-${i}`)}
              aria-label={`Laktat ${lac.mmol} mmol ved ${fmtKlokkeSek(lac.t)}`}
              style={{
                position: 'absolute', left: pct(lac.t), transform: 'translateX(-50%)',
                width: 9, height: 9, borderRadius: '50%', padding: 0,
                background: '#E23A5A', border: '1px solid var(--flate-3)',
                cursor: 'pointer', top: 2,
              }} />
          ))}
          {nutrition.map((n, i) => (
            <button key={`nut-${i}`} type="button"
              onMouseEnter={() => onVelg(`nut-${i}`)}
              onClick={() => onVelg(valgt === `nut-${i}` ? null : `nut-${i}`)}
              aria-label={`Ernæring ved ${fmtKlokkeSek(n.t)}`}
              style={{
                position: 'absolute', left: pct(n.t), transform: 'translateX(-50%) rotate(45deg)',
                width: 8, height: 8, padding: 0,
                background: '#FFB300', border: '1px solid var(--flate-3)',
                cursor: 'pointer', top: 2,
              }} />
          ))}
        </div>
      )}

      {/* Selve båndet. */}
      <div style={{ position: 'relative', height: 14 }}
        onMouseLeave={() => onVelg(null)}>
        {segmenter.map(sg => (
          <button key={sg.aktivitetId} type="button"
            onMouseEnter={() => onVelg(sg.aktivitetId)}
            onClick={() => onVelg(valgt === sg.aktivitetId ? null : sg.aktivitetId)}
            aria-label={`${sg.etikett} ${fmtKlokkeSek(sg.startSek)}–${fmtKlokkeSek(sg.sluttSek)}`}
            style={{
              position: 'absolute',
              left: pct(sg.startSek),
              width: `calc(${pct(sg.sluttSek - sg.startSek)} - 2px)`,
              minWidth: 3,
              height: 14, top: 0, padding: 0,
              background: SEGMENT_FARGER[sg.type],
              opacity: valgt == null || valgt === sg.aktivitetId ? 0.9 : 0.45,
              border: 'none', borderRadius: 3, cursor: 'pointer',
            }} />
        ))}
      </div>

      {/* Leser-linje for valgt segment/punkt («hold over»-raden i fasiten). */}
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
        color: 'var(--tekst-5-app)', minHeight: 20, paddingTop: 4,
      }}>
        {valgtSegment && (() => {
          const puls = pulsIVindu(hr, valgtSegment.startSek, valgtSegment.sluttSek)
          return (
            <span>
              <b style={{ color: SEGMENT_FARGER[valgtSegment.type] }}>{valgtSegment.etikett}</b>
              {' · '}{fmtKlokkeSek(valgtSegment.startSek)}–{fmtKlokkeSek(valgtSegment.sluttSek)}
              {' · '}{fmtKlokkeSek(valgtSegment.sluttSek - valgtSegment.startSek)}
              {puls.snitt != null ? <>{' · snitt '}{puls.snitt}</> : <>{' · puls: for lite data'}</>}
              {valgtSegment.treff ? <>{' · '}{valgtSegment.treff}</> : null}
            </span>
          )
        })()}
        {valgtLaktat && (
          <span>
            <b style={{ color: '#E23A5A' }}>Laktat {String(valgtLaktat.mmol).replace('.', ',')} mmol</b>
            {' · '}{fmtKlokkeSek(valgtLaktat.t)}
            {(() => {
              const p = findValueAt(hr, valgtLaktat.t)
              return p != null ? <>{' · puls '}{p}</> : null
            })()}
            {(() => {
              const f = naermesteFart(speed, valgtLaktat.t)
              return f != null ? <>{' · '}{fmtFart(f, sport)}</> : null
            })()}
          </span>
        )}
        {valgtNutrition && (
          <span>
            <b style={{ color: '#FFB300' }}>Ernæring — {valgtNutrition.type}</b>
            {' · '}{fmtKlokkeSek(valgtNutrition.t)}
            {valgtNutrition.carbs_g != null ? <>{' · '}{valgtNutrition.carbs_g} g karbo</> : null}
          </span>
        )}
        {!valgtSegment && !valgtLaktat && !valgtNutrition && (
          <span style={{ color: 'var(--tekst-8-alt)' }}>
            Hold over et segment: tid · varighet · snittpuls{segmenter.some(sg => sg.treff) ? ' · treff' : ''}
          </span>
        )}
      </div>

      {/* Faste leser-rader for skytevinduene (fasit 1b). */}
      {segmenter.filter(sg => sg.paaKurven).length > 0 && (
        <div className="mt-1 space-y-0.5"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13 }}>
          {segmenter.filter(sg => sg.paaKurven).map(sg => {
            const puls = pulsIVindu(hr, sg.startSek, sg.sluttSek)
            return (
              <div key={`leser-${sg.aktivitetId}`} style={{ color: 'var(--tekst-8-alt)' }}>
                <span style={{ color: SEGMENT_FARGER[sg.type] }}>{sg.etikett}:</span>{' '}
                <b style={{ color: 'var(--tekst-5-app)', fontWeight: 600 }}>
                  {fmtKlokkeSek(sg.startSek)}–{fmtKlokkeSek(sg.sluttSek)}
                  {puls.inn != null ? ` · puls inn ${puls.inn}` : ''}
                  {puls.snitt != null ? ` · snitt ${puls.snitt}` : ' · puls: for lite data'}
                  {sg.treff ? ` · ${sg.treff}` : ''}
                </b>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function naermesteFart(arr: SpeedSample[] | null, t: number): number | null {
  if (!arr || arr.length === 0) return null
  let best = arr[0]
  let bestDiff = Math.abs(best.t - t)
  for (const r of arr) {
    const d = Math.abs(r.t - t)
    if (d < bestDiff) { best = r; bestDiff = d }
  }
  return best.mps
}

function fmtFart(mps: number, sport: Sport): string {
  if (sport === 'cycling' || sport === 'triathlon') return `${(mps * 3.6).toFixed(1)} km/t`
  if (mps <= 0.1) return '—'
  const secPerKm = 1000 / mps
  const m = Math.floor(secPerKm / 60)
  const sek = Math.round(secPerKm % 60)
  return `${m}:${String(sek).padStart(2, '0')}/km`
}
