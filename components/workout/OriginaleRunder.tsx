'use client'

// BOLK 25 (Sverre 5. sep 2026): under «Vis dypere analyse» vises ALLTID
// klokkas ORIGINALE runder — rå laps / runde_backup, samme kilde som
// «Klokkesynk-runder» (pkt 6) — uansett kutt, match, Del her, drag-and-
// drop eller samle-valg. I tillegg GAP (stigningsjustert tempo) per runde
// og for økta, der høydedata finnes. Ren lesevisning.
//
// GAP-formelen er lib/prestasjon (Minetti-tilnærming): snittstigningen i
// rundens tidsvindu fra høydekurven, fart = distanse/tid når klokka ikke
// har snittfart. Under 0,5 % stigning gir formelen ingen GAP (støy) — da
// står «—».

import { useMemo } from 'react'
import type { Sport } from '@/lib/types'
import type { WorkoutSamples } from './WorkoutDetailChart'
import { gapFart, stigningPctForVindu } from '@/lib/prestasjon'
import type { LapRow } from './LapTable'

const FONT = "'Barlow Condensed', sans-serif"

function fmtTid(sek: number): string {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = Math.round(sek % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
function fmtTempo(mps: number | null, sport: Sport): string {
  if (mps == null || mps <= 0.1) return '—'
  if (sport === 'cycling' || sport === 'triathlon') return `${(mps * 3.6).toFixed(1)} km/t`
  const sekPerKm = 1000 / mps
  const m = Math.floor(sekPerKm / 60), s = Math.round(sekPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}
function fmtKm(meter: number | null): string {
  if (meter == null || meter <= 0) return '—'
  return `${(meter / 1000).toFixed(2).replace('.', ',')} km`
}

export interface OriginalRunde {
  index: number
  tidSek: number
  distanseM: number | null
  fartMs: number | null
  gapMs: number | null
  snittpuls: number | null
  makspuls: number | null
  stigningM: number | null
}

/** Rundene + øktsum med GAP — ren beregning (testes for seg). */
export function beregnOriginaleRunder(laps: LapRow[], samples: WorkoutSamples | null | undefined): { runder: OriginalRunde[]; okt: OriginalRunde | null } {
  const alt = samples?.altitude_samples && samples.altitude_samples.length > 4 ? samples.altitude_samples : null
  let fra = 0
  const runder: OriginalRunde[] = laps.map((lap, i) => {
    const til = fra + lap.duration_seconds
    const fart = lap.avg_speed_ms ?? (lap.distance_meters != null && lap.duration_seconds > 0 ? lap.distance_meters / lap.duration_seconds : null)
    const stigning = alt ? stigningPctForVindu(alt, fra, til, lap.distance_meters) : null
    const r: OriginalRunde = {
      index: i + 1, tidSek: lap.duration_seconds, distanseM: lap.distance_meters, fartMs: fart,
      gapMs: gapFart(fart, stigning), snittpuls: lap.avg_heart_rate, makspuls: lap.max_hr, stigningM: lap.elevation_gain_m,
    }
    fra = til
    return r
  })
  if (runder.length === 0) return { runder, okt: null }
  const tid = runder.reduce((s, r) => s + r.tidSek, 0)
  const medDist = runder.filter(r => r.distanseM != null)
  const dist = medDist.length > 0 ? medDist.reduce((s, r) => s + (r.distanseM ?? 0), 0) : null
  const fart = dist != null && tid > 0 ? dist / tid : null
  const stigningPct = alt ? stigningPctForVindu(alt, 0, tid, dist) : null
  const puls = runder.filter(r => r.snittpuls != null)
  const snittpuls = puls.length > 0 ? Math.round(puls.reduce((s, r) => s + (r.snittpuls ?? 0) * r.tidSek, 0) / puls.reduce((s, r) => s + r.tidSek, 0)) : null
  const maks = runder.filter(r => r.makspuls != null).map(r => r.makspuls as number)
  const stig = runder.filter(r => r.stigningM != null)
  return {
    runder,
    okt: {
      index: 0, tidSek: tid, distanseM: dist, fartMs: fart, gapMs: gapFart(fart, stigningPct),
      snittpuls, makspuls: maks.length > 0 ? Math.max(...maks) : null,
      stigningM: stig.length > 0 ? stig.reduce((s, r) => s + (r.stigningM ?? 0), 0) : null,
    },
  }
}

export function OriginaleRunder({ laps, sport, samples, kilde }: {
  laps: LapRow[]
  sport: Sport
  samples: WorkoutSamples | null | undefined
  kilde: 'backup' | 'klokkerader' | null
}) {
  const { runder, okt } = useMemo(() => beregnOriginaleRunder(laps, samples), [laps, samples])
  if (runder.length === 0) return null
  const harGap = runder.some(r => r.gapMs != null) || okt?.gapMs != null
  const th: React.CSSProperties = { fontFamily: FONT, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', fontWeight: 700, padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-1-app)', padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderTop: '1px solid var(--kant-3)' }
  const celle = (r: OriginalRunde) => (
    <>
      <td style={td}>{fmtTid(r.tidSek)}</td>
      <td style={td}>{fmtKm(r.distanseM)}</td>
      <td style={td}>{fmtTempo(r.fartMs, sport)}</td>
      <td style={td} data-gap={r.gapMs != null ? '' : undefined} title="GAP — stigningsjustert tempo (tilnærming)">{r.gapMs != null ? fmtTempo(r.gapMs, sport) : '—'}</td>
      <td style={td}>{r.snittpuls ?? '—'}</td>
      <td style={td}>{r.makspuls ?? '—'}</td>
      <td style={td}>{r.stigningM != null ? `${Math.round(r.stigningM)} m` : '—'}</td>
    </>
  )
  return (
    <div data-originale-runder data-kilde={kilde ?? undefined} data-antall={runder.length} className="mt-3" style={{ overflowX: 'auto' }}>
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <span style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--tekst-5-app)' }}>
          ⌚ Klokkas originale runder
        </span>
        <span style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-8-alt)' }}>
          {kilde === 'backup' ? 'sikkerhetskopien tatt før første endring' : 'radene med klokke-proveniens'} · uendret av kutt, match og samling
          {harGap ? ' · GAP der høydedata finnes' : ''}
        </span>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Runde</th>
            <th style={th}>Tid</th><th style={th}>Distanse</th><th style={th}>Tempo</th>
            <th style={th} title="GAP — stigningsjustert tempo (tilnærming)">GAP</th>
            <th style={th}>Snittpuls</th><th style={th}>Makspuls</th><th style={th}>Stigning</th>
          </tr>
        </thead>
        <tbody>
          {runder.map(r => (
            <tr key={r.index} data-original-runde={r.index}>
              <td style={{ ...td, textAlign: 'left', color: 'var(--tekst-5-app)' }}>{r.index}</td>
              {celle(r)}
            </tr>
          ))}
          {okt && (
            <tr data-original-okt style={{ fontWeight: 700 }}>
              <td style={{ ...td, textAlign: 'left', borderTop: '2px solid var(--kant-3)' }}>Økta</td>
              {celle({ ...okt })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
