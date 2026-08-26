'use client'

// G3 (kø #39): månedsvolum i design-utkastets stil — 12 søyler m/
// live-høyde, timer-input under søylen, månedslabel, og vtotal-linje
// (sesongtotal + snitt t/mnd + ~t/uke). Km/notat/fordeling (del E)
// beholdes med full paritet i en detaljrad per måned («▸ detaljer»).
// Mobil (≤md): 6 kolonner × 2 rader som i utkastets @media-regel.

import { useMemo, useRef, useState, useTransition } from 'react'
import type { MonthlyVolumePlan } from '@/app/actions/volume-plans'
import { upsertMonthlyVolumePlan } from '@/app/actions/volume-plans'
import { MonthlyVolumeInput } from './MonthlyVolumeInput'

const MONTHS_SHORT_NO = ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES']

function enumerateMonths(startDate: string, endDate: string): { year: number; month: number }[] {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const months: { year: number; month: number }[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

export function MonthlyVolumeSection({
  userId, seasonId, startDate, endDate, plans, canEdit = true, targetUserId,
}: {
  userId: string
  seasonId: string | null
  startDate: string
  endDate: string
  plans: MonthlyVolumePlan[]
  canEdit?: boolean
  targetUserId?: string
}) {
  void targetUserId
  const [open, setOpen] = useState(false)
  // Måned m/ åpen detaljrad (km/notat/fordeling) — én om gangen.
  const [detailKey, setDetailKey] = useState<string | null>(null)
  // Live-verdier fra hurtig-inputene (før lagring) — driver søylehøydene.
  const [liveHours, setLiveHours] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})
  const [, startTransition] = useTransition()
  const saveTimers = useRef<Record<string, number>>({})

  const months = enumerateMonths(startDate, endDate)
  const byKey = useMemo(() => new Map(plans.map(p => [`${p.year}-${p.month}`, p])), [plans])

  const num = (s: string) => {
    const n = parseFloat((s || '').replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const hoursFor = (key: string): number => {
    if (liveHours[key] !== undefined) return num(liveHours[key])
    const p = byKey.get(key)
    return Number(p?.planned_hours) || 0
  }

  const totalHours = months.reduce((s, m) => s + hoursFor(`${m.year}-${m.month}`), 0)
  const totalKm = plans.reduce((s, p) => s + (Number(p.planned_km) || 0), 0)
  const maxHours = Math.max(1, ...months.map(m => hoursFor(`${m.year}-${m.month}`)))
  const monthsWithHours = months.filter(m => hoursFor(`${m.year}-${m.month}`) > 0).length
  const avgPerMonth = monthsWithHours > 0 ? totalHours / monthsWithHours : 0
  // Veiledende ukesnitt over hele sesongens lengde (samme «~» som ukevisningen).
  const seasonDays = Math.max(1, Math.round((new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86400000) + 1)
  const perWeek = totalHours > 0 ? (totalHours * 7) / seasonDays : 0
  const fmtN = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 })

  // Hurtig-lagring av timer — km/notat/fordeling fra eksisterende rad
  // sendes UENDRET med (upsert overskriver alle totalfelter).
  const quickSave = (year: number, month: number, hoursStr: string) => {
    const key = `${year}-${month}`
    const existing = byKey.get(key)
    setSaveState(s => ({ ...s, [key]: 'saving' }))
    startTransition(async () => {
      const res = await upsertMonthlyVolumePlan(userId, year, month, {
        season_id: seasonId,
        planned_hours: hoursStr,
        planned_km: existing?.planned_km ?? null,
        notes: existing?.notes ?? null,
      })
      setSaveState(s => ({ ...s, [key]: res.error ? 'error' : 'saved' }))
      if (!res.error) {
        window.setTimeout(() => setSaveState(s => {
          const next = { ...s }
          delete next[key]
          return next
        }), 1200)
      }
    })
  }
  const scheduleQuickSave = (year: number, month: number, hoursStr: string) => {
    const key = `${year}-${month}`
    if (saveTimers.current[key]) window.clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = window.setTimeout(() => quickSave(year, month, hoursStr), 600)
  }

  return (
    <section className="mb-6"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      {/* Beam-header i xp-designspråket. */}
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{
          background: 'none',
          border: 'none',
          borderBottom: open ? '1px solid var(--kant-3)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}>
        <div className="flex items-center gap-3">
          <span style={{ width: 22, height: 4, borderRadius: 2, backgroundColor: 'var(--accent)', display: 'inline-block' }} />
          <div>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif",
              color: 'var(--tekst-1-app)',
              fontSize: '18px',
              letterSpacing: '0.06em',
              display: 'block',
            }}>
              Månedsvolum
            </span>
            <span className="text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)' }}>
              {canEdit ? 'Planlagte timer per måned — søylene oppdateres live.' : 'Planlagte timer per måned.'}
            </span>
          </div>
          <span className="text-xs tracking-wider uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            {totalHours > 0 || totalKm > 0
              ? `${fmtN(totalHours)} t${totalKm > 0 ? ` · ${totalKm.toFixed(0)} km` : ''}`
              : 'ikke satt'}
          </span>
        </div>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: 'var(--tekst-5-app)',
          fontSize: '12px',
        }}>
          {open ? '▾ Skjul' : '▸ Vis'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* ── Søylegrid (design-utkastets .vol): 12 kolonner desktop,
              6 × 2 rader mobil. ── */}
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2 pt-3"
            style={{ rowGap: 14 }}>
            {months.slice(0, 24).map(({ year, month }) => {
              const key = `${year}-${month}`
              const existing = byKey.get(key) ?? null
              const hours = hoursFor(key)
              const shown = liveHours[key] ?? (existing?.planned_hours != null ? String(existing.planned_hours) : '')
              const state = saveState[key]
              const detailOpen = detailKey === key
              return (
                <div key={key} className="text-center" style={{ minWidth: 0 }}>
                  {/* Søyle m/ live-høyde relativt til største måned. */}
                  <div style={{ height: 70, display: 'flex', alignItems: 'flex-end', marginBottom: 6 }}>
                    <span aria-hidden style={{
                      width: '100%',
                      height: `${Math.max(hours > 0 ? 4 : 2, Math.round((hours / maxHours) * 100))}%`,
                      borderRadius: '5px 5px 2px 2px',
                      background: hours > 0
                        ? 'linear-gradient(180deg, var(--accent), rgba(255,69,0,0.55))'
                        : 'var(--line)',
                      transition: 'height 0.15s',
                    }} />
                  </div>
                  {canEdit ? (
                    <input
                      value={shown}
                      onChange={e => {
                        setLiveHours(v => ({ ...v, [key]: e.target.value }))
                        scheduleQuickSave(year, month, e.target.value)
                      }}
                      onBlur={e => quickSave(year, month, e.target.value)}
                      placeholder="—"
                      inputMode="decimal"
                      aria-label={`Timer ${MONTHS_SHORT_NO[month - 1]} ${year}`}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--card2)',
                        border: `1px solid ${state === 'error' ? '#E23A5A' : 'var(--line)'}`,
                        borderRadius: 7,
                        color: state === 'saved' ? '#28A86E' : 'var(--ink)',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 14,
                        textAlign: 'center',
                        padding: '6px 2px',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: hours > 0 ? 'var(--tekst-1-app)' : 'var(--tekst-10)' }}>
                      {hours > 0 ? fmtN(hours) : '—'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailKey(detailOpen ? null : key)}
                    className="w-full text-xs"
                    title="Km, notat og fordeling"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: detailOpen ? 'var(--accent)' : 'var(--tekst-8-app)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '5px 0 0', minHeight: 26,
                    }}>
                    {MONTHS_SHORT_NO[month - 1]}{(existing?.zone_hours || existing?.movement_hours || existing?.planned_km != null || existing?.notes) ? ' ·' : ''} {detailOpen ? '▴' : '▾'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* vtotal-linje: sesongtotal + snitt + veiledende ukesnitt. */}
          <div className="mt-3 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            Sesongtotal:{' '}
            <b style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--tekst-1-app)', letterSpacing: '0.04em' }}>
              {fmtN(totalHours)}T
            </b>
            {monthsWithHours > 0 && (
              <span style={{ marginLeft: 10 }}>
                {fmtN(avgPerMonth)} t/mnd snitt · ~{fmtN(perWeek)} t/uke
              </span>
            )}
            {totalKm > 0 && <span style={{ marginLeft: 10 }}>{totalKm.toFixed(0)} km</span>}
          </div>

          {/* ── Detaljrad for valgt måned: km/notat/fordeling (del E) —
              eksisterende editor med full paritet. Re-mountes når timene
              hurtig-endres så feltene alltid viser lagret tilstand. ── */}
          {detailKey && (() => {
            const m = months.find(x => `${x.year}-${x.month}` === detailKey)
            if (!m) return null
            const existing = byKey.get(detailKey) ?? null
            if (!canEdit) {
              const hasData = existing?.planned_hours != null || existing?.planned_km != null || existing?.notes
              return (
                <div className="py-2 text-xs mt-2"
                  style={{ borderTop: '1px solid var(--kant-2)', fontFamily: "'Barlow Condensed', sans-serif", color: hasData ? 'var(--tekst-3-app)' : 'var(--tekst-10)' }}>
                  <span style={{ color: 'var(--tekst-5-app)', marginRight: 8 }}>{m.month}/{m.year}:</span>
                  {existing?.planned_hours != null && <span>{existing.planned_hours} t · </span>}
                  {existing?.planned_km != null && <span>{existing.planned_km} km</span>}
                  {existing?.notes && <span> · {existing.notes}</span>}
                  {existing?.zone_hours && Object.keys(existing.zone_hours).length > 0 && (
                    <span> · {Object.entries(existing.zone_hours).map(([k, v]) => `${k} ${v}t`).join(' / ')}</span>
                  )}
                  {existing?.movement_hours && Object.keys(existing.movement_hours).length > 0 && (
                    <span> · {Object.entries(existing.movement_hours).map(([k, v]) => `${k} ${v}t`).join(' / ')}</span>
                  )}
                  {!hasData && <span>—</span>}
                </div>
              )
            }
            return (
              <div className="mt-2">
                <MonthlyVolumeInput
                  key={`${detailKey}-${existing?.planned_hours ?? ''}-${liveHours[detailKey] ?? ''}`}
                  userId={userId}
                  seasonId={seasonId}
                  year={m.year}
                  month={m.month}
                  initialHours={liveHours[detailKey] !== undefined ? (num(liveHours[detailKey]) || null) : (existing?.planned_hours ?? null)}
                  initialKm={existing?.planned_km ?? null}
                  initialNotes={existing?.notes ?? null}
                  initialZoneHours={existing?.zone_hours ?? null}
                  initialMovementHours={existing?.movement_hours ?? null}
                />
              </div>
            )
          })()}

          {canEdit && (
            <p className="mt-3 text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              Endringer lagres automatisk. Trykk månedsnavnet for km, notat og fordeling.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
