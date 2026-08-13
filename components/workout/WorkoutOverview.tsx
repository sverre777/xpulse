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
  WORKOUT_TYPES_BIATHLON, SPORTS, ACTIVITY_TYPES,
  type WorkoutFormData, type ActivityRow,
} from '@/lib/types'
import type { Equipment } from '@/lib/equipment-types'
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

export function WorkoutOverview({ data, onEdit, canEdit, equipment, equipmentIds }: {
  data: Partial<WorkoutFormData>
  onEdit: () => void
  canEdit: boolean
  equipment: Equipment[]
  equipmentIds: string[]
  heartZones?: HeartZone[]
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
