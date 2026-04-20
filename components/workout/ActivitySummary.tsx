'use client'

import { useMemo } from 'react'
import { ActivityRow, Sport, findActivityType } from '@/lib/types'
import {
  ALL_ZONE_NAMES,
  ExtendedZoneName,
  HeartZone,
  SPEED_ZONE,
  ZONE_NAMES,
  zoneForHeartRate,
} from '@/lib/heart-zones'
import { parseActivityDuration } from '@/lib/activity-duration'

interface Props {
  activities: ActivityRow[]
  heartZones: HeartZone[]
  sport: Sport
}

const ZONE_COLORS: Record<ExtendedZoneName, string> = {
  I1: '#28A86E',
  I2: '#1A6FD4',
  I3: '#D4A017',
  I4: '#FF4500',
  I5: '#E11D48',
  Hurtighet: '#8B5CF6',
}

function formatTotalTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '—'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.round((totalSeconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}t ${m}min`
  if (h > 0) return `${h}t`
  return `${m}min`
}

export function ActivitySummary({ activities, heartZones, sport }: Props) {
  const summary = useMemo(() => {
    let totalSeconds = 0
    let totalMeters = 0
    const movementSeconds: Record<string, number> = {}
    const zoneSeconds: Record<ExtendedZoneName, number> = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, Hurtighet: 0 }
    let missingHrCount = 0

    // Fleksibel skyting: skudd telles alltid, treff og nevner i %-regnestykket
    // telles kun der treff er fylt inn. *_shots_scored er altså "skudd hvor treff
    // er satt" — nevneren i treff%.
    const shooting = {
      prone_shots: 0, prone_shots_scored: 0, prone_hits: 0,
      standing_shots: 0, standing_shots_scored: 0, standing_hits: 0,
      total_shots: 0, total_shots_scored: 0, total_hits: 0,
    }

    let lactateCount = 0
    let lactateMax: number | null = null

    for (const a of activities) {
      const meta = findActivityType(a.activity_type)
      const isPause = a.activity_type === 'pause' || a.activity_type === 'aktiv_pause'
      const durSec = parseActivityDuration(a.duration) ?? 0

      // Skytestatistikk — summer skudd alltid; summer treff (og "scored"-nevner)
      // kun der treff er eksplisitt fylt inn.
      if (meta?.isShooting) {
        const psRaw = parseInt(a.prone_shots)
        const phRaw = parseInt(a.prone_hits)
        const ssRaw = parseInt(a.standing_shots)
        const shRaw = parseInt(a.standing_hits)
        const ps = Number.isFinite(psRaw) ? psRaw : 0
        const ss = Number.isFinite(ssRaw) ? ssRaw : 0
        shooting.prone_shots += ps
        shooting.standing_shots += ss
        shooting.total_shots += ps + ss
        if (Number.isFinite(phRaw) && ps > 0) {
          shooting.prone_shots_scored += ps
          shooting.prone_hits += phRaw
          shooting.total_shots_scored += ps
          shooting.total_hits += phRaw
        }
        if (Number.isFinite(shRaw) && ss > 0) {
          shooting.standing_shots_scored += ss
          shooting.standing_hits += shRaw
          shooting.total_shots_scored += ss
          shooting.total_hits += shRaw
        }
      }

      // Laktat — samle alle målinger
      for (const m of a.lactate_measurements ?? []) {
        const v = parseFloat(m.value_mmol)
        if (Number.isFinite(v) && v > 0) {
          lactateCount += 1
          if (lactateMax == null || v > lactateMax) lactateMax = v
        }
      }

      if (isPause) continue

      // Totaltid + distanse (pauser eksludert)
      totalSeconds += durSec
      const km = parseFloat(a.distance_km)
      if (Number.isFinite(km) && km > 0) totalMeters += km * 1000

      // Bevegelsesform-fordeling
      if (durSec > 0) {
        const label = meta?.isShooting
          ? 'Skyting'
          : (a.movement_name || meta?.label || 'Annet')
        movementSeconds[label] = (movementSeconds[label] ?? 0) + durSec
      }

      // Sonefordeling — eksplisitte zones først (inkl. Hurtighet), ellers puls → sone.
      // Hurtighet regnes ikke fra puls og "blokkerer" heller ikke HR-fallback.
      const explicitZones = ALL_ZONE_NAMES
        .map(k => ({ k, m: parseInt(a.zones?.[k] ?? '') || 0 }))
        .filter(z => z.m > 0)
      const hasExplicitHr = explicitZones.some(z => z.k !== SPEED_ZONE)

      for (const z of explicitZones) zoneSeconds[z.k] += z.m * 60

      if (!hasExplicitHr && durSec > 0 && !meta?.isShooting) {
        const hr = parseInt(a.avg_heart_rate)
        if (Number.isFinite(hr) && hr > 0 && heartZones.length === ZONE_NAMES.length) {
          const zone = zoneForHeartRate(hr, heartZones)
          if (zone) zoneSeconds[zone] += durSec
        } else if (meta?.usesMovement) {
          // Utholdenhets-lignende aktivitet uten puls og uten eksplisitte soner.
          missingHrCount += 1
        }
      }
    }

    const zoneTotalSec = ALL_ZONE_NAMES.reduce((s, k) => s + zoneSeconds[k], 0)

    const movementList = Object.entries(movementSeconds)
      .sort((a, b) => b[1] - a[1])
      .map(([name, sec]) => ({ name, minutes: Math.round(sec / 60) }))

    return {
      totalSeconds,
      totalMeters,
      movementList,
      zoneSeconds,
      zoneTotalSec,
      missingHrCount,
      shooting,
      lactateCount,
      lactateMax,
    }
  }, [activities, heartZones])

  if (activities.length === 0) return null

  const totalKm = summary.totalMeters / 1000
  const isBiathlon = sport === 'biathlon'
  const hasShooting = isBiathlon && summary.shooting.total_shots > 0
  const pct = (hits: number, shots: number) =>
    shots > 0 ? Math.round((hits / shots) * 100) : null

  return (
    <div className="p-4" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
          Oppsummering
        </span>
      </div>

      {/* Totaltid + Distanse */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
        <Metric label="Totaltid" value={formatTotalTime(summary.totalSeconds)} />
        <Metric label="Distanse" value={totalKm > 0 ? `${totalKm.toFixed(1)} km` : '—'} />
        {summary.lactateCount > 0 && (
          <Metric
            label="Laktat"
            value={`${summary.lactateCount}× ${summary.lactateMax != null ? `· maks ${summary.lactateMax.toFixed(1)}` : ''}`}
          />
        )}
      </div>

      {/* Bevegelsesform-fordeling */}
      {summary.movementList.length > 0 && (
        <div className="mb-3">
          <Label>Bevegelsesformer</Label>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '13px' }}>
            {summary.movementList.map((m, i) => (
              <span key={m.name}>
                {i > 0 && <span style={{ color: '#555560' }}> · </span>}
                <span>{m.name} {m.minutes}min</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sonefordeling */}
      {summary.zoneTotalSec > 0 && (
        <div className="mb-3">
          <Label>Sonefordeling</Label>
          <ZoneBar zoneSeconds={summary.zoneSeconds} total={summary.zoneTotalSec} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px' }}>
            {ALL_ZONE_NAMES.map(k => {
              const mins = Math.round(summary.zoneSeconds[k] / 60)
              if (mins <= 0) return null
              return (
                <span key={k}>
                  <span style={{ color: ZONE_COLORS[k], letterSpacing: '0.08em' }}>{k}</span>
                  <span style={{ color: '#C0C0CC' }}> {mins}min</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Manglende puls-varsel */}
      {summary.missingHrCount > 0 && (
        <p className="mb-2 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {summary.missingHrCount} aktivitet{summary.missingHrCount > 1 ? 'er' : ''} mangler puls — ikke inkludert i sonefordelingen.
        </p>
      )}

      {/* Skytestatistikk — treff% bruker kun aktiviteter der treff er fylt inn. */}
      {hasShooting && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1E1E22' }}>
          <Label>Skyting</Label>
          <div className="grid grid-cols-3 gap-3 mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px' }}>
            <ShootingMetric
              label="Liggende"
              shots={summary.shooting.prone_shots}
              hits={summary.shooting.prone_hits}
              shotsScored={summary.shooting.prone_shots_scored}
              pct={pct(summary.shooting.prone_hits, summary.shooting.prone_shots_scored)}
            />
            <ShootingMetric
              label="Stående"
              shots={summary.shooting.standing_shots}
              hits={summary.shooting.standing_hits}
              shotsScored={summary.shooting.standing_shots_scored}
              pct={pct(summary.shooting.standing_hits, summary.shooting.standing_shots_scored)}
            />
            <ShootingMetric
              label="Totalt"
              shots={summary.shooting.total_shots}
              hits={summary.shooting.total_hits}
              shotsScored={summary.shooting.total_shots_scored}
              pct={pct(summary.shooting.total_hits, summary.shooting.total_shots_scored)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ZoneBar({
  zoneSeconds, total,
}: {
  zoneSeconds: Record<ExtendedZoneName, number>
  total: number
}) {
  return (
    <div
      className="flex"
      style={{
        height: '8px', borderRadius: '4px', overflow: 'hidden',
        backgroundColor: '#1A1A1E',
      }}
    >
      {ALL_ZONE_NAMES.map(k => {
        const w = total > 0 ? (zoneSeconds[k] / total) * 100 : 0
        if (w <= 0) return null
        return (
          <div
            key={k}
            title={`${k}: ${Math.round(zoneSeconds[k] / 60)}min`}
            style={{ width: `${w}%`, backgroundColor: ZONE_COLORS[k] }}
          />
        )
      })}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.05em', lineHeight: 1.1 }}>
        {value}
      </p>
    </div>
  )
}

function ShootingMetric({
  label, shots, hits, shotsScored, pct,
}: {
  label: string; shots: number; hits: number; shotsScored: number; pct: number | null
}) {
  const pctColor = pct == null ? '#555560' : pct >= 80 ? '#28A86E' : pct >= 60 ? '#FF9500' : '#FF4500'
  // Primær-visning: totalt antall skudd. Når treff er registrert på minst én
  // serie, vis også treff/nevner + %. Nevneren er kun skudd der treff var satt.
  const hasScored = shotsScored > 0
  return (
    <div>
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </span>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.05em' }}>
          {shots} skudd
        </span>
        {hasScored && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#C0C0CC', fontSize: '14px', letterSpacing: '0.05em' }}>
            · {hits}/{shotsScored}
          </span>
        )}
        {pct != null && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: pctColor, fontSize: '15px' }}>
            {pct}%
          </span>
        )}
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1 text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
      {children}
    </label>
  )
}
