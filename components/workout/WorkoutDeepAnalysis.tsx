'use client'

import { useMemo } from 'react'
import type { WorkoutSamples } from './WorkoutDetailChart'
import type { HeartZone } from '@/lib/heart-zones'
import { ZONE_NAMES, zoneForHeartRate } from '@/lib/heart-zones'
import type { Sport } from '@/lib/types'

// "Vis dypere analyse" — beregner avansert per-økt-statistikk fra samples
// uten ekstra DB-kall. Alt regnes ut én gang via useMemo så toggles ikke
// gir re-compute.
//
// Funksjonalitet:
// - Cardiac drift: HR-drift fra første halvdel til siste halvdel av økten
// - Best efforts: rolling-window peak for HR + watts (60/300/1200 sek)
// - Time-in-zones: andel sekunder i hver puls-sone (Olympiatoppen-skala)
// - Pa:HR decoupling (kun løping/langrenn): pace/HR drift
// - NP / IF (kun watt-data): normalized power og intensity factor

interface Props {
  samples: WorkoutSamples
  sport: Sport
  heartZones: HeartZone[]
  // Brukerens FTP (functional threshold power) for IF-beregning. Kan være null.
  ftpWatts?: number | null
}

export function WorkoutDeepAnalysis({ samples, sport, heartZones, ftpWatts }: Props) {
  const stats = useMemo(() => computeStats(samples, sport, heartZones, ftpWatts ?? null),
    [samples, sport, heartZones, ftpWatts])

  if (!stats.hasAnyData) {
    return (
      <div className="py-8 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '13px' }}>
          For lite data for dybdeanalyse — krever sek-for-sek puls fra klokken.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cardiac drift */}
      {stats.drift && (
        <Card title="Cardiac drift" subtitle="Pulsdrift gjennom økta — høy verdi indikerer akkumulert tretthet">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Snitt 1. halvdel" value={`${stats.drift.firstHalfBpm} bpm`} />
            <Metric label="Snitt 2. halvdel" value={`${stats.drift.secondHalfBpm} bpm`} />
            <Metric
              label="Drift"
              value={`${stats.drift.driftPct >= 0 ? '+' : ''}${stats.drift.driftPct.toFixed(1)}%`}
              accent={driftColor(stats.drift.driftPct)}
            />
            <Metric label="Δ bpm" value={`${stats.drift.driftBpm >= 0 ? '+' : ''}${stats.drift.driftBpm}`} />
          </div>
          <p className="mt-3 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {driftInterpretation(stats.drift.driftPct)}
          </p>
        </Card>
      )}

      {/* Best efforts */}
      {stats.bestEfforts && (
        <Card title="Beste innsatser" subtitle="Høyeste snitt over rullende vinduer">
          <div className="overflow-x-auto" style={{ border: '1px solid #1E1E22' }}>
            <table className="w-full text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#13131A' }}>
                  <Th>Vindu</Th>
                  {stats.bestEfforts.hr && <Th align="right">Puls</Th>}
                  {stats.bestEfforts.watts && <Th align="right">Watt</Th>}
                </tr>
              </thead>
              <tbody>
                {(['60','300','1200'] as const).map(k => (
                  <tr key={k} style={{ borderBottom: '1px solid #14141A' }}>
                    <Td>{k === '60' ? '1 min' : k === '300' ? '5 min' : '20 min'}</Td>
                    {stats.bestEfforts!.hr && (
                      <Td align="right">
                        {stats.bestEfforts!.hr[k] != null ? `${stats.bestEfforts!.hr[k]} bpm` : '—'}
                      </Td>
                    )}
                    {stats.bestEfforts!.watts && (
                      <Td align="right">
                        {stats.bestEfforts!.watts[k] != null ? `${stats.bestEfforts!.watts[k]} W` : '—'}
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Time in zones */}
      {stats.zones && (
        <Card title="Tid i pulssoner" subtitle="Olympiatoppens I-skala (HFmax-prosent)">
          <div className="space-y-2">
            {ZONE_NAMES.map(zone => {
              const sec = stats.zones![zone] ?? 0
              const pct = stats.zones!.total > 0 ? (sec / stats.zones!.total) * 100 : 0
              return (
                <ZoneRow key={zone} zone={zone}
                  range={heartZones.find(z => z.zone_name === zone) ?? null}
                  seconds={sec} pct={pct} />
              )
            })}
          </div>
        </Card>
      )}

      {/* Decoupling — kun løping/skiing */}
      {stats.decoupling != null && (
        <Card title="Pa:HR decoupling"
          subtitle="HR-stigning relativ til pace-fall — &lt; 5% indikerer god aerob form">
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Decoupling"
              value={`${stats.decoupling >= 0 ? '+' : ''}${stats.decoupling.toFixed(1)}%`}
              accent={decouplingColor(stats.decoupling)}
            />
            <div>
              <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                {stats.decoupling < 5
                  ? '✓ Stabil aerob form gjennom økten'
                  : stats.decoupling < 10
                  ? 'Moderat decoupling — kan tyde på begynnende tretthet'
                  : 'Høy decoupling — øktintensiteten var for høy aerobt eller du var sliten'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* NP / IF */}
      {stats.power && (
        <Card title="Watt-analyse" subtitle="Normalized Power og Intensity Factor">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Snitt-watt" value={`${stats.power.avg} W`} />
            <Metric label="Normalized Power" value={`${stats.power.np} W`} />
            {stats.power.if != null && (
              <Metric
                label="Intensity Factor"
                value={`${stats.power.if.toFixed(2)}`}
                accent={ifColor(stats.power.if)}
              />
            )}
            {stats.power.tss != null && (
              <Metric label="TSS" value={`${stats.power.tss}`} />
            )}
          </div>
          {stats.power.if == null && (
            <p className="mt-3 text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Sett FTP i innstillinger → Klokkesync for å se IF og TSS.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

// ── UI helpers ────────────────────────────────────────────

function Card({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="p-4" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        {title}
      </p>
      {subtitle && (
        <p className="text-xs mb-3 mt-0.5"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'Bebas Neue', sans-serif",
        color: accent ?? '#F0F0F2', fontSize: '24px', letterSpacing: '0.04em',
      }}>
        {value}
      </p>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className="px-2 py-2 tracking-widest uppercase"
      style={{ textAlign: align, color: '#8A8A96', fontWeight: 400, fontSize: '10px' }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className="px-2 py-2" style={{ textAlign: align, color: '#F0F0F2' }}>
      {children}
    </td>
  )
}

function ZoneRow({
  zone, range, seconds, pct,
}: {
  zone: string; range: HeartZone | null; seconds: number; pct: number
}) {
  const colors: Record<string, string> = {
    I1: '#28A86E', I2: '#3DD68C', I3: '#FFB300', I4: '#FF7300', I5: '#E11D48',
  }
  const color = colors[zone] ?? '#8A8A96'
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        <span>
          <span style={{ color, fontWeight: 600 }}>{zone}</span>
          {range && <span style={{ color: '#555560' }}> · {range.min_bpm}-{range.max_bpm} bpm</span>}
        </span>
        <span>{fmtDuration(seconds)} · {pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, backgroundColor: '#1E1E22' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function fmtDuration(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}t ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function driftColor(pct: number): string {
  if (pct < 3) return '#28A86E'
  if (pct < 6) return '#FFB300'
  return '#FF4500'
}

function driftInterpretation(pct: number): string {
  if (pct < 3) return 'Stabil puls — god aerob kontroll.'
  if (pct < 6) return 'Mild drift — typisk for moderat-lange økter.'
  if (pct < 10) return 'Markant drift — begynnende tretthet eller dehydrering.'
  return 'Stor drift — vurder lavere intensitet, mer drikke eller bedre restitusjon.'
}

function decouplingColor(pct: number): string {
  if (pct < 5) return '#28A86E'
  if (pct < 10) return '#FFB300'
  return '#FF4500'
}

function ifColor(ifVal: number): string {
  if (ifVal < 0.75) return '#28A86E'
  if (ifVal < 0.95) return '#FFB300'
  return '#FF4500'
}

// ── Statistikk-beregninger ────────────────────────────────

interface ComputedStats {
  hasAnyData: boolean
  drift: { firstHalfBpm: number; secondHalfBpm: number; driftBpm: number; driftPct: number } | null
  bestEfforts: {
    hr?: { '60': number | null; '300': number | null; '1200': number | null }
    watts?: { '60': number | null; '300': number | null; '1200': number | null }
  } | null
  zones: ({ total: number } & Record<string, number>) | null
  decoupling: number | null
  power: { avg: number; np: number; if: number | null; tss: number | null } | null
}

function computeStats(
  samples: WorkoutSamples,
  sport: Sport,
  heartZones: HeartZone[],
  ftpWatts: number | null,
): ComputedStats {
  const hr = samples.hr_samples ?? []
  const watts = samples.watt_samples ?? []
  const speedArr = samples.pace_samples ?? samples.speed_samples ?? []

  const hasAnyData = hr.length > 5 || watts.length > 5

  return {
    hasAnyData,
    drift: hr.length >= 30 ? computeCardiacDrift(hr) : null,
    bestEfforts: (hr.length >= 60 || watts.length >= 60) ? {
      hr: hr.length >= 60 ? {
        '60': bestRollingAvg(hr.map(s => ({ t: s.t, v: s.hr })), 60),
        '300': bestRollingAvg(hr.map(s => ({ t: s.t, v: s.hr })), 300),
        '1200': bestRollingAvg(hr.map(s => ({ t: s.t, v: s.hr })), 1200),
      } : undefined,
      watts: watts.length >= 60 ? {
        '60': bestRollingAvg(watts.map(s => ({ t: s.t, v: s.w })), 60),
        '300': bestRollingAvg(watts.map(s => ({ t: s.t, v: s.w })), 300),
        '1200': bestRollingAvg(watts.map(s => ({ t: s.t, v: s.w })), 1200),
      } : undefined,
    } : null,
    zones: hr.length >= 30 ? computeTimeInZones(hr, heartZones) : null,
    decoupling: shouldComputeDecoupling(sport) && hr.length >= 60 && speedArr.length >= 60
      ? computeDecoupling(hr, speedArr) : null,
    power: watts.length >= 60 ? computePowerStats(watts, ftpWatts) : null,
  }
}

function computeCardiacDrift(hr: Array<{ t: number; hr: number }>) {
  const mid = Math.floor(hr.length / 2)
  const first = hr.slice(0, mid)
  const second = hr.slice(mid)
  const firstAvg = avg(first.map(s => s.hr))
  const secondAvg = avg(second.map(s => s.hr))
  const driftBpm = Math.round(secondAvg - firstAvg)
  const driftPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0
  return {
    firstHalfBpm: Math.round(firstAvg),
    secondHalfBpm: Math.round(secondAvg),
    driftBpm,
    driftPct,
  }
}

// Returnerer høyeste snitt over et rullende vindu på `windowSec` sekunder.
// Null hvis økten er for kort eller datasettet er for tynt.
function bestRollingAvg(
  data: Array<{ t: number; v: number }>,
  windowSec: number,
): number | null {
  if (data.length < 2) return null
  const totalSec = data[data.length - 1].t - data[0].t
  if (totalSec < windowSec) return null

  // Akkumuler t * v og v over løpende vindu. Tilnærmet ved å anta jevn
  // sampling-rate og bruke index-vindu med size = windowSec / dt.
  // Mer robust: gjør ekspliksitt søk basert på t-verdier.
  let best = -Infinity
  let i = 0, j = 0, sum = 0, count = 0
  while (j < data.length) {
    sum += data[j].v
    count++
    while (data[j].t - data[i].t > windowSec && i < j) {
      sum -= data[i].v
      count--
      i++
    }
    if (data[j].t - data[i].t >= windowSec - 1) {
      const a = sum / count
      if (a > best) best = a
    }
    j++
  }
  return best === -Infinity ? null : Math.round(best)
}

function computeTimeInZones(
  hr: Array<{ t: number; hr: number }>,
  zones: HeartZone[],
): { total: number } & Record<string, number> {
  const buckets: Record<string, number> = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0 }
  let total = 0
  for (let i = 1; i < hr.length; i++) {
    const dt = hr[i].t - hr[i - 1].t
    if (dt <= 0 || dt > 60) continue  // hopp over store gaps
    const zone = zoneForHeartRate(hr[i].hr, zones)
    if (zone) {
      buckets[zone] += dt
      total += dt
    }
  }
  return { total, ...buckets }
}

function shouldComputeDecoupling(sport: Sport): boolean {
  return sport === 'running' || sport === 'triathlon' ||
    sport === 'cross_country_skiing' || sport === 'biathlon' ||
    sport === 'long_distance_skiing'
}

function computeDecoupling(
  hr: Array<{ t: number; hr: number }>,
  speed: Array<{ t: number; mps: number }>,
): number | null {
  // Pa:HR — pace per hjerteslag. Sammenlign første og andre halvdel.
  // Slå sammen på t = nærmeste sekund.
  const speedByT = new Map(speed.map(s => [s.t, s.mps]))
  const merged: Array<{ t: number; hr: number; mps: number }> = []
  for (const r of hr) {
    const sp = speedByT.get(r.t)
    if (sp != null && sp > 0.5) merged.push({ t: r.t, hr: r.hr, mps: sp })
  }
  if (merged.length < 60) return null
  const mid = Math.floor(merged.length / 2)
  const ratio = (rows: typeof merged) => {
    const speedAvg = avg(rows.map(r => r.mps))
    const hrAvg = avg(rows.map(r => r.hr))
    return hrAvg > 0 ? speedAvg / hrAvg : 0
  }
  const r1 = ratio(merged.slice(0, mid))
  const r2 = ratio(merged.slice(mid))
  if (r1 <= 0) return null
  // Decoupling = (r1 - r2) / r1. Positiv = pace falt relativt til HR (typisk).
  return ((r1 - r2) / r1) * 100
}

function computePowerStats(
  watts: Array<{ t: number; w: number }>,
  ftp: number | null,
): { avg: number; np: number; if: number | null; tss: number | null } {
  const avgW = avg(watts.map(s => s.w))
  // Normalized Power: 30-sek rolling avg, deretter avg av 4. potens, deretter ⁴√
  // Tilnærming: index-basert (antar ~1 Hz sampling).
  const window = 30
  const rolling: number[] = []
  let sum = 0, i = 0
  for (let j = 0; j < watts.length; j++) {
    sum += watts[j].w
    while (watts[j].t - watts[i].t > window && i < j) {
      sum -= watts[i].w
      i++
    }
    if (watts[j].t - watts[i].t >= window - 1) {
      rolling.push(sum / (j - i + 1))
    }
  }
  if (rolling.length === 0) return { avg: Math.round(avgW), np: Math.round(avgW), if: null, tss: null }
  const fourthMean = rolling.reduce((acc, x) => acc + Math.pow(x, 4), 0) / rolling.length
  const np = Math.round(Math.pow(fourthMean, 1 / 4))
  const ifVal = ftp && ftp > 0 ? np / ftp : null
  // TSS = (sec * NP * IF) / (FTP * 3600) * 100
  const totalSec = watts[watts.length - 1].t - watts[0].t
  const tss = ifVal != null && ftp != null
    ? Math.round((totalSec * np * ifVal) / (ftp * 3600) * 100)
    : null
  return { avg: Math.round(avgW), np, if: ifVal, tss }
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
