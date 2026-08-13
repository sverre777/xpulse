'use client'

// Øktoversikt (kø #40, fase 1) — pen read-only visning av GJENNOMFØRT økt.
// Følger design/xpulse-oktoversikt-design.html: hero m/ status-piller,
// hero-stats-grid, sonefordeling og aktivitets-tidslinje. «✎ Rediger»
// bytter til det eksisterende redigeringsskjemaet (WorkoutModal styrer).
//
// KJERNEREGEL: tomme seksjoner rendres ikke — visningen ser komplett ut
// uansett hvor mye som er ført.
//
// Aggregering går gjennom snapshotActivityToLike + computeActivityTotals —
// SAMME delte kilde som kalender/analyse (minutt-semantikk på varighet,
// pause/skyting holdes utenfor treningstid) → tallene matcher dagboken.

import type { ReactNode } from 'react'
import {
  WORKOUT_TYPES_BIATHLON, SPORTS, ACTIVITY_TYPES, WEATHER_TYPES, WIND_STRENGTHS,
  NUTRITION_TYPES,
  type WorkoutFormData, type ActivityRow,
} from '@/lib/types'
import { parseActivityDuration } from '@/lib/activity-duration'
import type { Equipment } from '@/lib/equipment-types'
import { WorkoutKlokkesyncSection } from './WorkoutKlokkesyncSection'
import { HeartZone, ALL_ZONE_NAMES, type ExtendedZoneName } from '@/lib/heart-zones'
import { snapshotActivityToLike, } from '@/lib/calendar-summary'
import { computeActivityTotals, ZONE_COLORS_V2, type ActivityLike } from '@/lib/activity-summary'

const SHOOTING_TYPES = new Set(['skyting_liggende', 'skyting_staaende', 'skyting_kombinert', 'skyting_innskyting', 'skyting_basis'])
const PAUSE_TYPES_LOCAL = new Set(['pause', 'aktiv_pause'])

function fmtClock(sec: number): string {
  // «1T 24M»-format fra utkastet (Bebas-vennlig).
  const m = Math.round(sec / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}T ${m % 60}M` : `${m}M`
}

function fmtZoneTime(sec: number): string {
  // «32:00»-format fra utkastet (min:sek).
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtNo(n: number, decimals = 1): string {
  return n.toLocaleString('nb-NO', { maximumFractionDigits: decimals })
}

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

function fmtDate(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function num(s: string | undefined | null): number {
  const n = parseFloat(String(s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const K_STYLE: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
  letterSpacing: '0.18em', color: '#8B8B95', textTransform: 'uppercase',
}

function Card({ title, aux, beamColor = 'var(--accent)', children }: {
  title: string; aux?: string; beamColor?: string; children: ReactNode
}) {
  return (
    <section className="p-5 mb-3.5" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }}>
      <div className="flex items-center gap-2.5 mb-3.5">
        <span style={{ width: 20, height: 3.5, borderRadius: 2, background: beamColor }} />
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.12em', color: '#8B8B95', fontWeight: 400 }}>
          {title}
        </h3>
        {aux && <span className="ml-auto" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: '#55555F' }}>{aux}</span>}
      </div>
      {children}
    </section>
  )
}

export function WorkoutOverview({ data, onEdit, canEdit, equipment, equipmentIds, workoutId }: {
  data: Partial<WorkoutFormData>
  onEdit: () => void
  canEdit: boolean
  equipment: Equipment[]
  equipmentIds: string[]
  heartZones?: HeartZone[]
  workoutId?: string
}) {
  const activities: ActivityRow[] = data.activities ?? []

  // Aggregér via delt kilde. Trening = alt unntatt pause + skyting.
  const trainingLikes: ActivityLike[] = []
  const allLikes = new Map<string, ActivityLike | null>()
  for (const a of activities) {
    const like = snapshotActivityToLike(a)
    allLikes.set(a.id, like)
    if (!like) continue
    if (PAUSE_TYPES_LOCAL.has(a.activity_type) || SHOOTING_TYPES.has(a.activity_type)) continue
    trainingLikes.push(like)
  }
  const totals = computeActivityTotals(trainingLikes, [])

  // Hero-stats: tomme celler skjules (kjerneregel — aldri «—» her).
  const totalSec = totals.totalSeconds
  const totalKm = totals.totalMeters / 1000
  const hrWeighted = (() => {
    let sum = 0, w = 0
    for (const a of activities) {
      if (SHOOTING_TYPES.has(a.activity_type) || PAUSE_TYPES_LOCAL.has(a.activity_type)) continue
      const like = allLikes.get(a.id)
      const hr = num(a.avg_heart_rate)
      if (!like || hr <= 0 || !like.duration_seconds) continue
      sum += hr * like.duration_seconds; w += like.duration_seconds
    }
    return w > 0 ? Math.round(sum / w) : 0
  })()
  const maxHr = Math.max(0, ...activities.map(a => num(a.max_heart_rate)))
  const elevation = activities.reduce((s, a) => s + num(a.elevation_gain_m), 0)
  const wattWeighted = (() => {
    let sum = 0, w = 0
    for (const a of activities) {
      const like = allLikes.get(a.id)
      const watts = num(a.avg_watts)
      if (!like || watts <= 0 || !like.duration_seconds) continue
      sum += watts * like.duration_seconds; w += like.duration_seconds
    }
    return w > 0 ? Math.round(sum / w) : 0
  })()
  const speedKmh = totalSec > 0 && totalKm > 0 ? (totalKm / (totalSec / 3600)) : 0

  const stats: { k: string; v: ReactNode; sm?: boolean }[] = []
  if (totalSec > 0) stats.push({ k: 'Total tid', v: fmtClock(totalSec) })
  if (totalKm > 0) stats.push({ k: 'Distanse', v: <>{fmtNo(totalKm)} <span style={{ fontSize: 14, color: '#55555F' }}>km</span></> })
  if (hrWeighted > 0) stats.push({ k: 'Snittpuls', v: <>{hrWeighted} <span style={{ fontSize: 14, color: '#55555F' }}>bpm</span></> })
  if (speedKmh > 0) stats.push({ k: 'Snittfart', v: <>{fmtNo(speedKmh)} <span style={{ fontSize: 14, color: '#55555F' }}>km/t</span></> })
  if (maxHr > 0) stats.push({ k: 'Makspuls', v: String(Math.round(maxHr)), sm: true })
  if (elevation > 0) stats.push({ k: 'Høydemeter', v: <>{Math.round(elevation)} <span style={{ fontSize: 14, color: '#55555F' }}>m</span></>, sm: true })
  if (wattWeighted > 0) stats.push({ k: 'Snittwatt', v: String(wattWeighted), sm: true })

  // Sonefordeling
  const zoneTotal = ALL_ZONE_NAMES.reduce((s, k) => s + (totals.zoneSeconds[k] ?? 0), 0)

  // Meta-rad
  const typeLabel = WORKOUT_TYPES_BIATHLON.find(t => t.value === data.workout_type)?.label ?? null
  const sportLabel = SPORTS.find(s => s.value === data.sport)?.label ?? null
  const primaryMovement = (() => {
    let top: string | null = null, topVal = 0
    const counts = new Map<string, number>()
    for (const a of activities) {
      const m = a.movement_name?.trim()
      if (!m) continue
      const sec = allLikes.get(a.id)?.duration_seconds ?? 0
      counts.set(m, (counts.get(m) ?? 0) + sec)
    }
    for (const [name, val] of counts) if (val > topVal) { top = name; topVal = val }
    return top
  })()
  const gearNames = equipmentIds
    .map(id => equipment.find(e => e.id === id)?.name)
    .filter((n): n is string => !!n)

  const fromTemplate = data.template_name || data.standard_workout_template_name || null

  const activityLabel = (a: ActivityRow) =>
    ACTIVITY_TYPES.find(t => t.value === a.activity_type)?.label ?? a.activity_type

  const pillStyle = (color: string, bg: string, borderC: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, fontWeight: 700,
    letterSpacing: '0.13em', textTransform: 'uppercase', borderRadius: 999,
    padding: '6px 13px', color, background: bg, border: `1px solid ${borderC}`,
  })
  const chipStyle: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8B8B95',
    border: '1px solid var(--line2)', borderRadius: 999, padding: '6px 13px',
  }

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto">
      {/* ── HERO ── */}
      <div className="pb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <span style={pillStyle('#28A86E', 'rgba(40,168,110,.12)', 'rgba(40,168,110,.4)')}>✓ Gjennomført</span>
          {data.imported_from === 'strava' && (
            <span style={pillStyle('var(--accent)', 'var(--accent-soft)', 'var(--accent-50)')}>▲ Strava-synk</span>
          )}
          {data.imported_from && data.imported_from !== 'strava' && (
            <span style={pillStyle('#8B8B95', 'transparent', 'var(--line2)')}>⌚ Klokkesynk</span>
          )}
          {fromTemplate && (
            <span style={pillStyle('#8B8B95', 'transparent', 'var(--line2)')}>Fra mal: {fromTemplate}</span>
          )}
        </div>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, letterSpacing: '0.03em', lineHeight: 1.05, color: '#F2F2F0', fontWeight: 400 }}>
          {data.title || 'Økt'}
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8B8B95', fontSize: 16 }}>
          {fmtDate(data.date) && <span><b style={{ color: '#F2F2F0', fontWeight: 600 }}>{fmtDate(data.date)}</b></span>}
          {data.time_of_day && <span>Kl. <b style={{ color: '#F2F2F0', fontWeight: 600 }}>{data.time_of_day.slice(0, 5)}</b></span>}
          {data.location && <span><b style={{ color: '#F2F2F0', fontWeight: 600 }}>{data.location}</b></span>}
          {typeLabel && <span>Type <b style={{ color: '#F2F2F0', fontWeight: 600 }}>{typeLabel}</b></span>}
          {sportLabel && (
            <span>Sport <b style={{ color: '#F2F2F0', fontWeight: 600 }}>{sportLabel}{primaryMovement ? ` · ${primaryMovement}` : ''}</b></span>
          )}
        </div>
        {(data.is_important || data.is_altitude_training || data.is_heat_training || data.is_group_session || gearNames.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-3.5">
            {data.is_important && (
              <span style={{ ...chipStyle, color: '#F5C542', borderColor: 'rgba(245,197,66,.4)' }}>★ Viktig økt</span>
            )}
            {data.is_altitude_training && (
              <span style={chipStyle}>🏔 Høydetrening{data.altitude_meters ? ` · ${data.altitude_meters} moh` : ''}</span>
            )}
            {data.is_heat_training && <span style={chipStyle}>🌡 Varmetrening</span>}
            {data.is_group_session && <span style={chipStyle}>👥 Fellestrening</span>}
            {gearNames.map(n => (
              <span key={n} style={chipStyle}>Utstyr · <b style={{ color: '#F2F2F0' }}>{n}</b></span>
            ))}
          </div>
        )}
      </div>

      {/* ── HERO-STATS (tomme celler skjules) ── */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 mb-3.5" style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg,#131318,#0E0E12)' }}>
          {stats.map((s, i) => (
            <div key={s.k} style={{ padding: '16px 18px', borderRight: (i + 1) % 4 !== 0 ? '1px solid var(--line)' : 'none', borderTop: i >= 4 ? '1px solid var(--line)' : 'none' }}>
              <span style={K_STYLE}>{s.k}</span>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: s.sm ? 23 : 30, letterSpacing: '0.03em', marginTop: 2, color: '#F2F2F0' }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SONEFORDELING ── */}
      {zoneTotal > 0 && (
        <Card title="SONEFORDELING" aux={`Σ ${fmtClock(zoneTotal)}`}>
          <div className="flex overflow-hidden mb-3" style={{ height: 10, borderRadius: 5, background: 'var(--line)' }}>
            {ALL_ZONE_NAMES.map(k => {
              const sec = totals.zoneSeconds[k] ?? 0
              if (sec <= 0) return null
              return <div key={k} style={{ width: `${(sec / zoneTotal) * 100}%`, background: ZONE_COLORS_V2[k] }} />
            })}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {ALL_ZONE_NAMES.map(k => {
              const sec = totals.zoneSeconds[k] ?? 0
              if (sec <= 0) return null
              return (
                <div key={k} className="text-center">
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', color: ZONE_COLORS_V2[k] }}>
                    {k === 'Hurtighet' ? 'HURT.' : k}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: '0.04em', color: '#F2F2F0' }}>{fmtZoneTime(sec)}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#55555F' }}>{Math.round((sec / zoneTotal) * 100)}%</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── KLOKKEDATA — HØYT og synlig (pulskurve/høyde/watt + laps).
          Gjenbruker WorkoutKlokkesyncSection 1:1 (WorkoutDetailChart er på
          graf-temaet); egen data-finnes-sjekk, kun importerte økter. ── */}
      {workoutId && data.imported_from && (
        <div className="mb-3.5">
          <WorkoutKlokkesyncSection workoutId={workoutId} importedFrom={data.imported_from ?? null} />
        </div>
      )}

      {/* ── AKTIVITETER (read-only tidslinje) ── */}
      {activities.length > 0 && (
        <Card title="AKTIVITETER" aux="Kronologisk">
          <div className="relative" style={{ paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, background: 'linear-gradient(180deg, var(--accent), rgba(255,69,0,.15))', borderRadius: 2 }} />
            {activities.map((a, i) => {
              const like = allLikes.get(a.id)
              const isShooting = SHOOTING_TYPES.has(a.activity_type)
              const isPause = PAUSE_TYPES_LOCAL.has(a.activity_type)
              const sec = like?.duration_seconds ?? 0
              const km = (like?.distance_meters ?? 0) / 1000
              const hr = num(a.avg_heart_rate)
              const watts = num(a.avg_watts)
              const shots = num(a.prone_shots) + num(a.standing_shots)
              const hits = num(a.prone_hits) + num(a.standing_hits)
              const aZones = like ? computeActivityTotals([like], []) : null
              const aZoneTotal = aZones ? ALL_ZONE_NAMES.reduce((s, k) => s + (aZones.zoneSeconds[k] ?? 0), 0) : 0
              return (
                <div key={a.id} className="relative flex flex-wrap items-center gap-x-3.5 gap-y-1.5 py-3"
                  style={{ borderBottom: i < activities.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ position: 'absolute', left: -21, top: 18, width: 10, height: 10, borderRadius: '50%', background: 'var(--bg-primary, #0A0A0B)', border: `3px solid ${isShooting ? '#E23A5A' : isPause ? '#55555F' : 'var(--accent)'}` }} />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: '#F2F2F0' }}>
                    {activityLabel(a)}
                    {a.movement_name && <small style={{ color: '#8B8B95', fontWeight: 500 }}> · {a.movement_name}{a.movement_subcategory ? ` ${a.movement_subcategory}` : ''}</small>}
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8B8B95', fontSize: 14.5 }}>
                    {sec > 0 && <b style={{ color: '#F2F2F0', fontWeight: 600 }}>{fmtZoneTime(sec)}</b>}
                    {km > 0 && <> · <b style={{ color: '#F2F2F0', fontWeight: 600 }}>{fmtNo(km)}</b> km</>}
                    {hr > 0 && <> · <b style={{ color: '#F2F2F0', fontWeight: 600 }}>{Math.round(hr)}</b> bpm</>}
                    {watts > 0 && <> · <b style={{ color: '#F2F2F0', fontWeight: 600 }}>{Math.round(watts)}</b> w</>}
                    {isShooting && shots > 0 && <> · <b style={{ color: '#F2F2F0', fontWeight: 600 }}>{hits}/{shots}</b> treff</>}
                  </span>
                  {aZoneTotal > 0 && aZones && (
                    <div className="flex overflow-hidden md:ml-auto" style={{ height: 5, width: 90, borderRadius: 3, background: 'var(--line)' }}>
                      {ALL_ZONE_NAMES.map(k => {
                        const zs = aZones.zoneSeconds[k as ExtendedZoneName] ?? 0
                        if (zs <= 0) return null
                        return <div key={k} style={{ width: `${(zs / aZoneTotal) * 100}%`, background: ZONE_COLORS_V2[k as ExtendedZoneName] }} />
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── SKYTING (fase 2 — kun når skyte-data finnes) ── */}
      {(() => {
        let pShots = 0, pHits = 0, sShots = 0, sHits = 0, series = 0
        for (const a of activities) {
          if (!SHOOTING_TYPES.has(a.activity_type)) continue
          const ps = num(a.prone_shots), ss = num(a.standing_shots)
          if (ps + ss > 0) series++
          pShots += ps; pHits += num(a.prone_hits)
          sShots += ss; sHits += num(a.standing_hits)
        }
        const shots = pShots + sShots
        if (shots <= 0) return null
        const hits = pHits + sHits
        const pct = (h: number, s: number) => s > 0 ? `${Math.round((h / s) * 100)}%` : ''
        const dots = (h: number, s: number) => s > 0 && s <= 20 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {Array.from({ length: s }, (_, i) => (
              <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < h ? '#28A86E' : 'var(--line2)' }} />
            ))}
          </div>
        ) : null
        const box = (k: string, h: number, s: number) => (
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', background: 'var(--card2)' }}>
            <span style={K_STYLE}>{k}</span>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.03em', marginTop: 2, color: '#F2F2F0' }}>
              {h}/{s} <span style={{ fontSize: 14, color: '#55555F' }}>{pct(h, s)}</span>
            </div>
            {dots(h, s)}
          </div>
        )
        return (
          <Card title="SKYTING" beamColor="#E23A5A" aux={`${series} serie${series !== 1 ? 'r' : ''} · ${shots} skudd`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {box('Totalt', hits, shots)}
              {pShots > 0 && box('Liggende', pHits, pShots)}
              {sShots > 0 && box('Stående', sHits, sShots)}
            </div>
          </Card>
        )
      })()}

      {/* ── SPLITS PER KM (fase 2 — kun når splits finnes) ── */}
      {(() => {
        const rows: { km: string; sec: number }[] = []
        for (const a of activities) {
          for (const s of a.splits_per_km ?? []) {
            const sec = parseActivityDuration(s.duration) ?? 0
            if (sec > 0) rows.push({ km: s.km, sec })
          }
        }
        if (rows.length === 0) return null
        const best = Math.min(...rows.map(r => r.sec))
        return (
          <Card title="SPLITS PER KM" aux={`${rows.length} km`}>
            <div className="flex flex-col gap-1.5">
              {rows.map((r, i) => (
                <div key={i} className="grid items-center gap-2.5" style={{ gridTemplateColumns: '44px 1fr 64px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5 }}>
                  <span style={{ color: '#55555F', letterSpacing: '0.05em' }}>{r.km}</span>
                  <div style={{ height: 7, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((best / r.sec) * 100)}%`, background: 'linear-gradient(90deg, var(--accent), rgba(255,69,0,.6))', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.04em', textAlign: 'right', color: '#F2F2F0' }}>
                    {fmtZoneTime(r.sec)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )
      })()}

      {/* ── DAGSFORM OG BELASTNING (fase 2 — hvis ført) ── */}
      {(data.day_form_physical != null || data.day_form_mental != null || data.rpe != null) && (
        <Card title="DAGSFORM OG BELASTNING" beamColor="#F5C542">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {data.day_form_physical != null && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', background: 'var(--card2)' }}>
                <div style={{ ...K_STYLE, marginBottom: 6 }}>Fysisk form</div>
                <div style={{ color: 'var(--line2)', fontSize: 19, letterSpacing: 2 }}>
                  <b style={{ color: '#E8B93C', textShadow: '0 0 10px rgba(232,185,60,.35)', fontWeight: 400 }}>{'★'.repeat(data.day_form_physical)}</b>
                  {'★'.repeat(Math.max(0, 5 - data.day_form_physical))}
                </div>
              </div>
            )}
            {data.day_form_mental != null && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', background: 'var(--card2)' }}>
                <div style={{ ...K_STYLE, marginBottom: 6 }}>Mental form</div>
                <div style={{ color: 'var(--line2)', fontSize: 19, letterSpacing: 2 }}>
                  <b style={{ color: '#E8B93C', textShadow: '0 0 10px rgba(232,185,60,.35)', fontWeight: 400 }}>{'★'.repeat(data.day_form_mental)}</b>
                  {'★'.repeat(Math.max(0, 5 - data.day_form_mental))}
                </div>
              </div>
            )}
            {data.rpe != null && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', background: 'var(--card2)' }}>
                <div style={{ ...K_STYLE, marginBottom: 6 }}>RPE</div>
                <span style={{
                  display: 'inline-block', fontFamily: "'Bebas Neue', sans-serif", fontSize: 24,
                  letterSpacing: '0.04em', color: '#fff', borderRadius: 9, padding: '4px 14px 2px',
                  background: data.rpe >= 8 ? '#E23A5A' : data.rpe >= 6 ? '#FF8C00' : data.rpe >= 4 ? '#E8B93C' : '#28A86E',
                }}>
                  {data.rpe}
                </span>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#55555F', marginTop: 4 }}>av 10</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── VÆR/FØRE + ERNÆRING side ved side (fase 2 — hvis ført) ── */}
      {(() => {
        const w = data.weather
        const hasWeather = !!w && !!(w.temperature || w.weather_type || w.wind_strength || (w.surface_conditions?.length ?? 0) > 0 || w.notes)
        const nutrition = (data.nutrition_entries ?? []).filter(n => n.nutrition_type || num(n.carbs_g) > 0 || n.custom_label)
        if (!hasWeather && nutrition.length === 0) return null
        const wLabel = (list: { value: string; label: string }[], v: string) => list.find(o => o.value === v)?.label ?? v
        const lineStyle: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif", color: '#8B8B95', fontSize: 15.5 }
        const bStyle: React.CSSProperties = { color: '#F2F2F0', fontWeight: 600 }
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" style={{ marginBottom: 0 }}>
            {hasWeather && w && (
              <Card title="VÆR OG FØRE" beamColor="#28A86E">
                <div className="flex flex-wrap gap-x-5 gap-y-2" style={lineStyle}>
                  {(w.weather_type || w.temperature) && (
                    <span><b style={bStyle}>{[wLabel(WEATHER_TYPES, w.weather_type), w.temperature ? `${w.temperature}°` : ''].filter(Boolean).join(', ')}</b></span>
                  )}
                  {w.wind_strength && <span>Vind <b style={bStyle}>{wLabel(WIND_STRENGTHS, w.wind_strength)}</b></span>}
                  {(w.surface_conditions?.length ?? 0) > 0 && <span>Føre <b style={bStyle}>{w.surface_conditions.join(', ')}</b></span>}
                  {w.notes && <span style={{ width: '100%', color: '#8B8B95' }}>{w.notes}</span>}
                </div>
              </Card>
            )}
            {nutrition.length > 0 && (
              <Card title="ERNÆRING" aux={`${nutrition.length} rad${nutrition.length !== 1 ? 'er' : ''}`}>
                <div className="flex flex-col gap-1.5" style={lineStyle}>
                  {nutrition.map(n => {
                    const label = n.custom_label || NUTRITION_TYPES.find(t => t.value === n.nutrition_type)?.label || n.nutrition_type
                    const parts = [
                      num(n.carbs_g) > 0 ? `${fmtNo(num(n.carbs_g), 0)} g karbo` : '',
                      num(n.protein_g) > 0 ? `${fmtNo(num(n.protein_g), 0)} g protein` : '',
                    ].filter(Boolean).join(' · ')
                    return (
                      <span key={n.id}>
                        {n.time_offset_minutes && <span style={{ color: '#55555F' }}>{n.time_offset_minutes} min · </span>}
                        <b style={bStyle}>{label}</b>{parts ? ` · ${parts}` : ''}
                      </span>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        )
      })()}

      {/* ── NOTATER + tagger (fase 2 — hvis ført) ── */}
      {(data.notes || (data.tags?.length ?? 0) > 0) && (
        <Card title="NOTATER">
          {data.notes && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16.5, lineHeight: 1.55, color: '#F2F2F0', whiteSpace: 'pre-wrap' }}>
              {data.notes}
            </p>
          )}
          {(data.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {data.tags!.map(t => (
                <span key={t} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 999, padding: '5px 12px' }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Sync-fot (diskret) ── */}
      {data.imported_from && (
        <div className="flex items-center gap-2.5 mb-3.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#55555F' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          Importert fra {data.imported_from === 'strava' ? 'Strava' : data.imported_from}
        </div>
      )}

      {/* ── Rediger-CTA nederst (i tillegg til toppbaren i modalen) ── */}
      {canEdit && (
        <button type="button" onClick={onEdit}
          className="w-full transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14,
            letterSpacing: '0.13em', textTransform: 'uppercase',
            color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)',
            borderRadius: 12, padding: '12px', cursor: 'pointer', marginTop: 4,
          }}>
          ✎ Rediger økt
        </button>
      )}
    </div>
  )
}
