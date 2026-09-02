'use client'

import { useMemo } from 'react'
import { ActivityRow, Sport, findActivityType, IKKE_TRENINGSTID_TYPER } from '@/lib/types'
import {
  ALL_ZONE_NAMES,
  ExtendedZoneName,
  HeartZone,
  SPEED_ZONE,
  ZONE_NAMES,
  zoneForHeartRate,
} from '@/lib/heart-zones'
import { parseActivityDuration } from '@/lib/activity-duration'
import {
  formatPace, paceFromDistanceDuration, type PaceUnit,
} from '@/lib/pace-utils'
import { resolvePaceUnit } from '@/components/pace/PaceDisplay'
import { parseDecimal } from '@/lib/parse-decimal'
import type { WorkoutKlokkesyncData } from '@/app/actions/workout-klokkesync'
import type { Segment } from '@/lib/segmenter'
import {
  WorkoutDetailChart, Nokkeltall, nokkeltallFraKlokke, fmtVarighetLang, type NokkeltallCelle,
} from './WorkoutDetailChart'

interface Props {
  activities: ActivityRow[]
  heartZones: HeartZone[]
  sport: Sport
  // Brukerens default pace-enhet — null faller tilbake til 'min_per_km'.
  defaultPaceUnit?: PaceUnit | null
  /** Klokke-grafen LIVE i kortet (bolk 2): samples fra serveren, segmentene
      fra skjemaets egne rader — oppdateres for hver rad man fører. */
  klokke?: { data: WorkoutKlokkesyncData; segmenter: Segment[]; workoutId: string } | null
  /** Opplevd belastning — SAMME felt som «Dagsform og belastning» fører. */
  rpe?: number | null
  onRpe?: (v: number | null) => void
}

// Sonefarger: ÉN fasit i lib/activity-summary.ts (ZONE_COLORS_V2).
// Ikke gjenta hexene her — I1 grønn, I2 blå, alltid.
import { ZONE_COLORS_V2 as ZONE_COLORS } from '@/lib/activity-summary'


export function ActivitySummary({ activities, heartZones, sport, defaultPaceUnit = null, klokke = null, rpe = null, onRpe }: Props) {
  const summary = useMemo(() => {
    let totalSeconds = 0     // ren treningstid — ekskl. pauser OG skyting
    let shootingSeconds = 0  // skyting (alle typer + tørrtrening) som egen kategori
    let totalMeters = 0
    const movementSeconds: Record<string, number> = {}
    // Pace per bevegelsesform: vekt = sekunder, slik at lange økter teller mer.
    // Snitt-pace utledes fra Σmeter / Σsekunder per bevegelse.
    const movementMeters: Record<string, number> = {}
    const movementPaceSeconds: Record<string, number> = {}
    let bestPaceSeconds: number | null = null
    let bestPaceMovement: string | null = null
    const zoneSeconds: Record<ExtendedZoneName, number> = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0, I7: 0, I8: 0, Hurtighet: 0 }
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
      const isPause = IKKE_TRENINGSTID_TYPER.has(a.activity_type)
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
        const v = parseDecimal(m.value_mmol)
        if (Number.isFinite(v) && v > 0) {
          lactateCount += 1
          if (lactateMax == null || v > lactateMax) lactateMax = v
        }
      }

      if (isPause) continue

      // Skyting holdes utenfor treningstid og total-distanse — gå rett til
      // bevegelsesform-fordelingen (vi vil fortsatt se en "Skyting"-rad der).
      // skytingSeconds bobler opp som egen Metric.
      if (meta?.isShooting) {
        shootingSeconds += durSec
      } else {
        // Totaltid + distanse (pauser OG skyting ekskludert)
        totalSeconds += durSec
        const kmTrain = parseDecimal(a.distance_km)
        if (Number.isFinite(kmTrain) && kmTrain > 0) totalMeters += kmTrain * 1000
      }

      const km = parseDecimal(a.distance_km)
      // Bevegelsesform-fordeling
      const label = meta?.isShooting
        ? 'Skyting'
        : (a.movement_name || meta?.label || 'Annet')
      if (durSec > 0) {
        movementSeconds[label] = (movementSeconds[label] ?? 0) + durSec
      }

      // Pace-aggregering: bruk eksplisitt avg_pace_seconds_per_km hvis satt,
      // ellers avled fra distanse + varighet for denne raden. Vekter på meter.
      if (!meta?.isShooting && Number.isFinite(km) && km > 0 && durSec > 0) {
        const meters = km * 1000
        const explicit = parseInt(a.avg_pace_seconds_per_km)
        const rowPaceSec = Number.isFinite(explicit) && explicit > 0
          ? explicit
          : paceFromDistanceDuration(km, durSec)
        if (rowPaceSec != null && rowPaceSec > 0) {
          movementMeters[label] = (movementMeters[label] ?? 0) + meters
          // Σsekunder = pace × meter / 1000 (rekonstruerer sum-tid).
          movementPaceSeconds[label] = (movementPaceSeconds[label] ?? 0) + rowPaceSec * (meters / 1000)
          if (bestPaceSeconds == null || rowPaceSec < bestPaceSeconds) {
            bestPaceSeconds = rowPaceSec
            bestPaceMovement = label
          }
        }
      }

      // Sonefordeling — eksplisitte zones først (inkl. Hurtighet), ellers puls → sone.
      // Hurtighet regnes ikke fra puls og "blokkerer" heller ikke HR-fallback.
      // a.zones-verdier er MM:SS-strenger som representerer sekunder (phase 64+).
      const explicitZones = ALL_ZONE_NAMES
        .map(k => ({ k, sec: parseActivityDuration(a.zones?.[k] ?? '') ?? 0 }))
        .filter(z => z.sec > 0)
      const hasExplicitHr = explicitZones.some(z => z.k !== SPEED_ZONE)

      for (const z of explicitZones) zoneSeconds[z.k] += z.sec

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
      .map(([name, sec]) => {
        const meters = movementMeters[name] ?? 0
        const totalPaceSec = movementPaceSeconds[name] ?? 0
        const km = meters / 1000
        const avgPace = km > 0 ? totalPaceSec / km : null
        return {
          name,
          minutes: Math.round(sec / 60),
          avgPaceSeconds: avgPace,
        }
      })

    return {
      totalSeconds,
      shootingSeconds,
      totalMeters,
      movementList,
      zoneSeconds,
      zoneTotalSec,
      missingHrCount,
      shooting,
      lactateCount,
      lactateMax,
      bestPaceSeconds,
      bestPaceMovement,
    }
  }, [activities, heartZones])

  if (activities.length === 0) return null

  const totalKm = summary.totalMeters / 1000
  const isBiathlon = sport === 'biathlon'
  const hasShooting = isBiathlon && summary.shooting.total_shots > 0
  const pct = (hits: number, shots: number) =>
    shots > 0 ? Math.round((hits / shots) * 100) : null
  const paceUnit: PaceUnit = resolvePaceUnit('', defaultPaceUnit)

  // NØKKELTALLSRADEN — grafens rad (fasit) er kortets rad: Treningstid og
  // Distanse var her fra før; med klokke kommer varighet, hovedsone,
  // snittpuls, snittwatt og belastning fra samples, og opplevd belastning
  // føres rett i raden. Uten klokke står radenes tall (plan-grafen i bolk 5
  // fyller resten).
  const celler: NokkeltallCelle[] = klokke?.data.samples
    ? nokkeltallFraKlokke({ samples: klokke.data.samples, heartZones, np: klokke.data.wattMetrikker?.np ?? null })
    : [{ id: 'trening', etikett: 'Treningstid', verdi: summary.totalSeconds > 0 ? fmtVarighetLang(summary.totalSeconds) : '—' }]
  if (totalKm > 0) celler.push({ id: 'km', etikett: 'Distanse', verdi: totalKm.toFixed(1), hale: 'km' })
  if (summary.shootingSeconds > 0) celler.push({ id: 'skyting', etikett: 'Skyting', verdi: `${Math.round(summary.shootingSeconds / 60)}`, hale: 'min · utenfor treningstid' })
  if (summary.bestPaceSeconds != null) celler.push({ id: 'pace', etikett: 'Beste pace', verdi: formatPace(summary.bestPaceSeconds, paceUnit), hale: summary.bestPaceMovement ?? undefined })
  if (summary.lactateCount > 0) celler.push({ id: 'laktat', etikett: 'Laktat', verdi: `${summary.lactateCount}×`, hale: summary.lactateMax != null ? `maks ${summary.lactateMax.toFixed(1)}` : undefined })

  return (
    <div className="p-4" style={{ background: 'linear-gradient(135deg, var(--flate-12) 0%, var(--flate-7-alt) 100%)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
          Oppsummering
        </span>
      </div>

      {/* Klokke-grafen — samme komponent som på hovedsida, LIVE her:
          segmentbåndet leser skjemaets rader (bolk 2, monteringspunkt 1). */}
      {klokke?.data.samples && klokke.data.sport && (
        <div className="mb-3">
          <WorkoutDetailChart
            tetthet="skjema"
            workoutId={klokke.workoutId}
            sport={klokke.data.sport}
            samples={klokke.data.samples}
            laps={klokke.data.lapMarkers}
            lactate={klokke.data.lactate}
            nutrition={klokke.data.nutrition}
            shooting={klokke.data.shooting}
            segmenter={klokke.segmenter}
            heartZones={heartZones}
            np={klokke.data.wattMetrikker?.np ?? null}
          />
        </div>
      )}

      {/* Nøkkeltallsraden — varighet · hovedsone · snittpuls · snittwatt ·
          belastning · opplevd (føres), pluss distanse og det som finnes. */}
      <div className="mb-3">
        <Nokkeltall celler={celler} rpe={rpe} onRpe={onRpe} />
      </div>

      {/* Bevegelsesform-fordeling */}
      {summary.movementList.length > 0 && (
        <div className="mb-3">
          <Label>Bevegelsesformer</Label>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', fontSize: '13px' }}>
            {summary.movementList.map((m, i) => (
              <span key={m.name}>
                {i > 0 && <span style={{ color: 'var(--tekst-8-app)' }}> · </span>}
                <span>{m.name} {m.minutes}min</span>
                {m.avgPaceSeconds != null && (
                  <span style={{ color: 'var(--tekst-5-app)' }}> ({formatPace(m.avgPaceSeconds, paceUnit)})</span>
                )}
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
                  <span style={{ color: 'var(--tekst-3-app)' }}> {mins}min</span>
                </span>
              )
            })}
          </div>
          <p className="mt-1" style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: 'var(--tekst-8-app)', fontSize: '13px',
          }}>
            OLT I-skala — basert på % av maksimal puls
          </p>
        </div>
      )}

      {/* Manglende puls-varsel */}
      {summary.missingHrCount > 0 && (
        <p className="mb-2 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          {summary.missingHrCount} aktivitet{summary.missingHrCount > 1 ? 'er' : ''} mangler puls — ikke inkludert i sonefordelingen.
        </p>
      )}

      {/* Skytestatistikk — treff% bruker kun aktiviteter der treff er fylt inn. */}
      {hasShooting && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--kant-3)' }}>
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
        backgroundColor: 'var(--kant-2)',
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


function ShootingMetric({
  label, shots, hits, shotsScored, pct,
}: {
  label: string; shots: number; hits: number; shotsScored: number; pct: number | null
}) {
  const pctColor = pct == null ? 'var(--tekst-8-app)' : pct >= 80 ? '#28A86E' : pct >= 60 ? '#FF9500' : '#FF4500'
  // Primær-visning: totalt antall skudd. Når treff er registrert på minst én
  // serie, vis også treff/nevner + %. Nevneren er kun skudd der treff var satt.
  const hasScored = shotsScored > 0
  return (
    <div>
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        {label}
      </span>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '18px', letterSpacing: '0.05em' }}>
          {shots} skudd
        </span>
        {hasScored && (
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-3-app)', fontSize: '14px', letterSpacing: '0.05em' }}>
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
