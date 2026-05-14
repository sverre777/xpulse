'use client'

import type { Sport } from '@/lib/types'

// En "lap" tilsvarer en rad i workout_activities for klokkesync-importerte
// økter. Vi bruker LapTable for å vise per-lap detaljer (varighet, distanse,
// snittpuls, maks-puls, watt, kadens, tempo) i én tabell.

export interface LapRow {
  id?: string
  index: number
  duration_seconds: number
  distance_meters: number | null
  avg_heart_rate: number | null
  max_hr: number | null
  avg_watts: number | null
  max_watts: number | null
  avg_speed_ms: number | null
  max_speed_ms: number | null
  avg_cadence: number | null
  max_cadence: number | null
  elevation_gain_m: number | null
  rpe: number | null
  lap_notes: string | null
  // Skiskyting-spesifikt — vises bare når sport=biathlon og verdier finnes.
  prone_hits?: number | null
  prone_shots?: number | null
  standing_hits?: number | null
  standing_shots?: number | null
  // Type-tagg ('warmup','interval','rest','skyting','cooldown') — kan settes manuelt.
  lap_type?: string | null
}

interface Props {
  laps: LapRow[]
  sport: Sport
}

export function LapTable({ laps, sport }: Props) {
  if (laps.length === 0) return null

  // Sport-spesifikk kolonne-synlighet.
  const showWatt = laps.some(l => l.avg_watts != null) &&
    (sport === 'cycling' || sport === 'triathlon' ||
     sport === 'long_distance_skiing' || sport === 'cross_country_skiing' ||
     sport === 'biathlon' || sport === 'running')
  const showPace = laps.some(l => l.avg_speed_ms != null)
  const showCadence = laps.some(l => l.avg_cadence != null)
  const showMaxHr = laps.some(l => l.max_hr != null)
  const showElev = laps.some(l => (l.elevation_gain_m ?? 0) > 0)
  const showShooting = sport === 'biathlon' &&
    laps.some(l => (l.prone_shots ?? 0) > 0 || (l.standing_shots ?? 0) > 0)
  const showRpe = laps.some(l => l.rpe != null)
  const showNotes = laps.some(l => l.lap_notes && l.lap_notes.trim().length > 0)

  return (
    <div className="overflow-x-auto" style={{ border: '1px solid #1E1E22' }}>
      <table className="w-full text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#13131A' }}>
            <Th>#</Th>
            <Th>Type</Th>
            <Th align="right">Tid</Th>
            <Th align="right">Distanse</Th>
            <Th align="right">Snittpuls</Th>
            {showMaxHr && <Th align="right">Maks</Th>}
            {showPace && <Th align="right">{paceHeader(sport)}</Th>}
            {showWatt && <Th align="right">Watt</Th>}
            {showCadence && <Th align="right">Kadens</Th>}
            {showElev && <Th align="right">Stign.</Th>}
            {showShooting && <Th align="center">Skyting</Th>}
            {showRpe && <Th align="right">RPE</Th>}
            {showNotes && <Th>Notat</Th>}
          </tr>
        </thead>
        <tbody>
          {laps.map(lap => (
            <tr key={lap.id ?? lap.index}
              style={{ borderBottom: '1px solid #14141A' }}>
              <Td>{lap.index + 1}</Td>
              <Td>
                {lap.lap_type ? <LapTypeChip type={lap.lap_type} /> : (
                  <span style={{ color: '#3A3A42' }}>—</span>
                )}
              </Td>
              <Td align="right">{fmtDuration(lap.duration_seconds)}</Td>
              <Td align="right">{fmtDistance(lap.distance_meters)}</Td>
              <Td align="right">{lap.avg_heart_rate != null ? `${lap.avg_heart_rate}` : '—'}</Td>
              {showMaxHr && (
                <Td align="right">{lap.max_hr != null ? `${lap.max_hr}` : '—'}</Td>
              )}
              {showPace && (
                <Td align="right">{fmtPace(lap.avg_speed_ms, sport)}</Td>
              )}
              {showWatt && (
                <Td align="right">
                  {lap.avg_watts != null ? `${Math.round(Number(lap.avg_watts))}` : '—'}
                  {lap.max_watts != null && (
                    <span style={{ color: '#555560' }}> / {Math.round(Number(lap.max_watts))}</span>
                  )}
                </Td>
              )}
              {showCadence && (
                <Td align="right">
                  {lap.avg_cadence != null ? `${Math.round(Number(lap.avg_cadence))}` : '—'}
                </Td>
              )}
              {showElev && (
                <Td align="right">
                  {lap.elevation_gain_m != null && lap.elevation_gain_m > 0
                    ? `+${lap.elevation_gain_m}m` : '—'}
                </Td>
              )}
              {showShooting && (
                <Td align="center">{fmtShooting(lap)}</Td>
              )}
              {showRpe && (
                <Td align="right">{lap.rpe != null ? `${lap.rpe}/10` : '—'}</Td>
              )}
              {showNotes && (
                <Td>
                  <span style={{ color: '#8A8A96' }}>{lap.lap_notes ?? ''}</span>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th className="px-2 py-2 tracking-widest uppercase"
      style={{
        textAlign: align,
        color: '#8A8A96',
        fontWeight: 400,
        fontSize: '10px',
      }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <td className="px-2 py-2"
      style={{ textAlign: align, color: '#F0F0F2' }}>
      {children}
    </td>
  )
}

function LapTypeChip({ type }: { type: string }) {
  const colors: Record<string, { bg: string; fg: string; label: string }> = {
    warmup:   { bg: '#2A2418', fg: '#FFB300', label: 'Oppvarming' },
    interval: { bg: '#2A1A1A', fg: '#FF4500', label: 'Intervall' },
    rest:     { bg: '#1A1A22', fg: '#7AA2FF', label: 'Pause' },
    skyting:  { bg: '#1A2418', fg: '#3DD68C', label: 'Skyting' },
    cooldown: { bg: '#241A24', fg: '#A855F7', label: 'Nedjogg' },
  }
  const c = colors[type] ?? { bg: '#1A1A22', fg: '#8A8A96', label: type }
  return (
    <span className="px-1.5 py-0.5 text-xs tracking-widest uppercase"
      style={{
        backgroundColor: c.bg, color: c.fg, fontSize: '10px',
        border: `1px solid ${c.fg}33`,
      }}>
      {c.label}
    </span>
  )
}

function fmtDuration(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

function fmtDistance(meters: number | null): string {
  if (meters == null || meters <= 0) return '—'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters} m`
}

function paceHeader(sport: Sport): string {
  if (sport === 'cycling' || sport === 'triathlon') return 'Hast.'
  return 'Tempo'
}

function fmtPace(mps: number | null, sport: Sport): string {
  if (mps == null || mps <= 0.1) return '—'
  if (sport === 'cycling' || sport === 'triathlon') {
    return `${(Number(mps) * 3.6).toFixed(1)} km/t`
  }
  const secPerKm = 1000 / Number(mps)
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2,'0')}/km`
}

function fmtShooting(lap: LapRow): string {
  const segs: string[] = []
  if ((lap.prone_shots ?? 0) > 0) {
    segs.push(`L: ${lap.prone_hits ?? 0}/${lap.prone_shots}`)
  }
  if ((lap.standing_shots ?? 0) > 0) {
    segs.push(`S: ${lap.standing_hits ?? 0}/${lap.standing_shots}`)
  }
  return segs.length > 0 ? segs.join(' · ') : '—'
}
