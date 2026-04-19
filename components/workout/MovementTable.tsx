'use client'

import { Fragment, useState } from 'react'
import { MovementRow, ZoneRow, ExerciseRow, ShootingBlock, MOVEMENT_CATEGORIES, INTENSITY_ZONES, SHOOTING_BLOCK_TYPES, getSubcategories } from '@/lib/types'

interface MovementTableProps {
  rows: MovementRow[]
  onChange: (rows: MovementRow[]) => void
  defaultMovements?: string[]
}

const STRENGTH_MOVEMENTS = ['Styrke', 'Crossfit', 'Kampsport']
const isStrengthMovement = (name: string) => STRENGTH_MOVEMENTS.some(s => name.startsWith(s))
const isShootingMovement = (name: string) => name === 'Skiskyting'

function formatPace(minutes: string, km: string): string | null {
  const m = parseFloat(minutes)
  const k = parseFloat(km)
  if (!m || !k || k === 0) return null
  const secPerKm = (m * 60) / k
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')}/km`
}

function formatSpeed(minutes: string, km: string): string | null {
  const m = parseFloat(minutes)
  const k = parseFloat(km)
  if (!m || !k || m === 0) return null
  const kmh = (k / m) * 60
  return `${kmh.toFixed(1)} km/t`
}

const RUNNING_MOVEMENTS = ['Løping', 'Orientering']
const CYCLING_MOVEMENTS = ['Sykling', 'Rulleski', 'Langrenn']

function AutoPace({ movement, minutes, km }: { movement: string; minutes: string; km: string }) {
  const isRunning = RUNNING_MOVEMENTS.some(r => movement.startsWith(r))
  const isCycling = CYCLING_MOVEMENTS.some(c => movement.startsWith(c))
  if (isRunning) {
    const pace = formatPace(minutes, km)
    if (!pace) return null
    return <span style={{ color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px' }}>{pace}</span>
  }
  if (isCycling) {
    const spd = formatSpeed(minutes, km)
    if (!spd) return null
    return <span style={{ color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px' }}>{spd}</span>
  }
  return null
}

function ZoneExpandSection({ zones, onChange }: { zones: ZoneRow[]; onChange: (z: ZoneRow[]) => void }) {
  const activeZones = INTENSITY_ZONES.slice(0, 5).map(zn => {
    const existing = zones.find(z => z.zone_name === zn)
    return existing ?? { zone_name: zn, minutes: '' }
  })

  const update = (zn: string, val: string) => {
    const next = activeZones.map(z => z.zone_name === zn ? { ...z, minutes: val } : z)
    onChange(next.filter(z => z.minutes))
  }

  const iSt: React.CSSProperties = {
    background: 'transparent', border: 'none', outline: 'none',
    color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '13px', width: '100%', padding: 0, textAlign: 'right' as const,
  }

  return (
    <div className="px-3 py-2" style={{ backgroundColor: '#0D0D11', borderTop: '1px solid #1A1A1E' }}>
      <div className="flex gap-3 items-center flex-wrap">
        <span className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', minWidth: '90px' }}>
          Intensitetssoner
        </span>
        {activeZones.map(z => {
          const zoneColors: Record<string, string> = {
            I1: '#2A5A8A', I2: '#1A7A4A', I3: '#8A8A10', I4: '#8A5A00', I5: '#8A1A00',
          }
          const col = zoneColors[z.zone_name] ?? '#555560'
          return (
            <div key={z.zone_name} className="flex items-center gap-1">
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '13px',
                color: col, minWidth: '22px',
              }}>{z.zone_name}</span>
              <div style={{ width: '48px', borderBottom: `1px solid ${col}44` }}>
                <input
                  type="number" value={z.minutes} min="0"
                  onChange={e => update(z.zone_name, e.target.value)}
                  placeholder="—"
                  style={iSt}
                />
              </div>
              <span style={{ color: '#333340', fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif" }}>min</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExerciseExpandSection({ exercises, onChange }: {
  exercises: ExerciseRow[]
  onChange: (e: ExerciseRow[]) => void
}) {
  const addRow = () => onChange([...exercises, { id: crypto.randomUUID(), exercise_name: '', sets: '', reps: '', weight_kg: '' }])
  const removeRow = (id: string) => onChange(exercises.filter(e => e.id !== id))
  const update = (id: string, field: keyof ExerciseRow, val: string) =>
    onChange(exercises.map(e => e.id === id ? { ...e, [field]: val } : e))

  const iSt: React.CSSProperties = {
    background: 'transparent', border: 'none', outline: 'none',
    color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', width: '100%', padding: 0,
  }

  return (
    <div className="px-3 py-2" style={{ backgroundColor: '#0D0D11', borderTop: '1px solid #1A1A1E' }}>
      <span className="text-xs tracking-widest uppercase block mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Øvelser
      </span>
      {exercises.length > 0 && (
        <table className="w-full mb-2" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Øvelse', 'Sett', 'Reps', 'Kg', ''].map(h => (
                <th key={h} className="py-1 text-left text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', fontWeight: 400 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exercises.map(e => (
              <tr key={e.id} className="group">
                <td className="py-0.5 pr-2">
                  <input value={e.exercise_name} onChange={ev => update(e.id, 'exercise_name', ev.target.value)}
                    placeholder="Navn..." style={{ ...iSt, minWidth: '100px' }} />
                </td>
                <td className="py-0.5 pr-2" style={{ width: '40px' }}>
                  <input type="number" value={e.sets} onChange={ev => update(e.id, 'sets', ev.target.value)}
                    placeholder="—" min="0" style={iSt} />
                </td>
                <td className="py-0.5 pr-2" style={{ width: '40px' }}>
                  <input type="number" value={e.reps} onChange={ev => update(e.id, 'reps', ev.target.value)}
                    placeholder="—" min="0" style={iSt} />
                </td>
                <td className="py-0.5 pr-2" style={{ width: '50px' }}>
                  <input type="number" step="0.5" value={e.weight_kg} onChange={ev => update(e.id, 'weight_kg', ev.target.value)}
                    placeholder="—" min="0" style={iSt} />
                </td>
                <td className="py-0.5 w-6">
                  <button type="button" onClick={() => removeRow(e.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" onClick={addRow}
        className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        + Legg til øvelse
      </button>
    </div>
  )
}

const numSt: React.CSSProperties = {
  background: '#111115', border: '1px solid #1E1E22', outline: 'none',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px', padding: '4px 8px', width: '60px', textAlign: 'center' as const,
}

function pct(hits: string, shots: string): number | null {
  const s = parseInt(shots), h = parseInt(hits)
  if (!s || s === 0) return null
  return Math.round((h / s) * 100)
}

function PctBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const color = value >= 90 ? '#28A86E' : value >= 70 ? '#FF8C00' : '#FF4500'
  return (
    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px', color, minWidth: '40px' }}>
      {value}%
    </span>
  )
}

function ShootingExpandSection({ blocks, onChange }: {
  blocks: ShootingBlock[]
  onChange: (b: ShootingBlock[]) => void
}) {
  const makeBlock = (): ShootingBlock => ({
    id: crypto.randomUUID(), shooting_type: '',
    prone_shots: '', prone_hits: '', standing_shots: '', standing_hits: '',
  })

  const addBlock = () => onChange([...blocks, makeBlock()])
  const removeBlock = (id: string) => onChange(blocks.filter(b => b.id !== id))
  const upd = (id: string, field: keyof ShootingBlock, val: string) =>
    onChange(blocks.map(b => b.id === id ? { ...b, [field]: val } : b))

  const totalShots = blocks.reduce((s, b) => s + (parseInt(b.prone_shots) || 0) + (parseInt(b.standing_shots) || 0), 0)
  const totalHits  = blocks.reduce((s, b) => s + (parseInt(b.prone_hits)  || 0) + (parseInt(b.standing_hits)  || 0), 0)
  const overallPct = totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : null

  return (
    <div style={{ backgroundColor: '#0D0D11', borderTop: '1px solid #1A1A1E' }}>
      <div className="px-3 py-3">
        <span className="text-xs tracking-widest uppercase block mb-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Skyting
        </span>

        {blocks.length === 0 && (
          <p className="mb-3 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340' }}>
            Ingen skyteserier lagt til ennå
          </p>
        )}

        {blocks.map((b, bi) => {
          const pronePct    = pct(b.prone_hits, b.prone_shots)
          const standingPct = pct(b.standing_hits, b.standing_shots)
          const blockShots  = (parseInt(b.prone_shots) || 0) + (parseInt(b.standing_shots) || 0)
          const blockHits   = (parseInt(b.prone_hits)  || 0) + (parseInt(b.standing_hits)  || 0)
          const blockPct    = blockShots > 0 ? Math.round((blockHits / blockShots) * 100) : null

          return (
            <div key={b.id} className="mb-4 pb-4" style={{ borderBottom: '1px solid #1A1A1E' }}>
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#8A8A96', fontSize: '13px', letterSpacing: '0.12em' }}>
                  SERIE {bi + 1}
                </span>
                {blocks.length > 1 && (
                  <button type="button" onClick={() => removeBlock(b.id)}
                    style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>
                    ×
                  </button>
                )}
              </div>

              {/* Type buttons */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SHOOTING_BLOCK_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => upd(b.id, 'shooting_type', t.value)}
                    className="px-2 py-1 text-xs tracking-widest uppercase"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      backgroundColor: b.shooting_type === t.value ? '#FF4500' : 'transparent',
                      color: b.shooting_type === t.value ? '#F0F0F2' : '#555560',
                      border: `1px solid ${b.shooting_type === t.value ? '#FF4500' : '#222228'}`,
                      cursor: 'pointer',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Results: Liggende + Stående side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs tracking-widest uppercase block mb-1.5"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Liggende</span>
                  <div className="flex items-center gap-2">
                    <input type="number" value={b.prone_shots} onChange={e => upd(b.id, 'prone_shots', e.target.value)}
                      placeholder="skudd" min="0" max="100" style={numSt} />
                    <span style={{ color: '#333340', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif" }}>
                      treff
                    </span>
                    <input type="number" value={b.prone_hits} onChange={e => upd(b.id, 'prone_hits', e.target.value)}
                      placeholder="treff" min="0" max="100" style={numSt} />
                    <PctBadge value={pronePct} />
                  </div>
                </div>

                <div>
                  <span className="text-xs tracking-widest uppercase block mb-1.5"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Stående</span>
                  <div className="flex items-center gap-2">
                    <input type="number" value={b.standing_shots} onChange={e => upd(b.id, 'standing_shots', e.target.value)}
                      placeholder="skudd" min="0" max="100" style={numSt} />
                    <span style={{ color: '#333340', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif" }}>
                      treff
                    </span>
                    <input type="number" value={b.standing_hits} onChange={e => upd(b.id, 'standing_hits', e.target.value)}
                      placeholder="treff" min="0" max="100" style={numSt} />
                    <PctBadge value={standingPct} />
                  </div>
                </div>
              </div>

              {blockPct !== null && (
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                    Total serie:
                  </span>
                  <PctBadge value={blockPct} />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', fontSize: '12px' }}>
                    ({blockHits}/{blockShots})
                  </span>
                </div>
              )}
            </div>
          )
        })}

        <button type="button" onClick={addBlock}
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          + Legg til ny skyteserie
        </button>

        {overallPct !== null && blocks.length > 1 && (
          <div className="mt-4 pt-3 flex items-baseline gap-2" style={{ borderTop: '1px solid #1A1A1E' }}>
            <span className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Samlet total:
            </span>
            <PctBadge value={overallPct} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '12px' }}>
              ({totalHits}/{totalShots} treff)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function MovementTable({ rows, onChange, defaultMovements = [] }: MovementTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const allCategories = MOVEMENT_CATEGORIES.map(m => m.name)

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const update = (i: number, field: keyof MovementRow, value: unknown) => {
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  const addRow = (name?: string) => {
    onChange([...rows, {
      id: crypto.randomUUID(),
      movement_name: name ?? '',
      minutes: '', distance_km: '', elevation_meters: '',
      avg_heart_rate: '', zones: [], exercises: [], shooting_blocks: [],
    }])
  }

  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  const parseDisplayName = (name: string): { parent: string; sub: string } => {
    if (name.includes(' — ')) {
      const [p, s] = name.split(' — ')
      return { parent: p, sub: s }
    }
    return { parent: name, sub: '' }
  }

  const buildName = (parent: string, sub: string) => sub ? `${parent} — ${sub}` : parent

  const iSt: React.CSSProperties = {
    background: 'transparent', border: 'none', outline: 'none',
    color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', width: '100%', padding: 0,
  }
  const selSt: React.CSSProperties = { ...iSt, cursor: 'pointer' }

  const totalMin  = rows.reduce((s, r) => s + (parseInt(r.minutes) || 0), 0)
  const totalKm   = rows.reduce((s, r) => s + (parseFloat(r.distance_km) || 0), 0)
  const totalElev = rows.reduce((s, r) => s + (parseInt(r.elevation_meters) || 0), 0)

  return (
    <div>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            {['Bevegelsesform', 'Underkategori', 'Min', 'Km', 'Hm', 'Puls', ''].map(h => (
              <th key={h} className="py-2 px-2 text-left text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const { parent, sub } = parseDisplayName(row.movement_name)
            const subs = getSubcategories(parent)
            const isExp = expanded.has(row.id)
            const isStrength = isStrengthMovement(parent)
            const isShooting = isShootingMovement(parent)

            return (
              <Fragment key={row.id}>
                <tr className="group" style={{ borderBottom: isExp ? 'none' : '1px solid #1A1A1E' }}>
                  {/* Expand toggle */}
                  <td className="px-2 py-1.5" style={{ minWidth: '130px' }}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggle(row.id)}
                        style={{
                          color: isExp ? '#FF4500' : '#333340',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '10px', padding: 0, lineHeight: 1, flexShrink: 0,
                        }}
                        title={isExp ? 'Skjul detaljer' : 'Vis detaljer'}
                      >
                        {isExp ? '▼' : '▶'}
                      </button>
                      <select value={parent}
                        onChange={e => {
                          const newSubs = getSubcategories(e.target.value)
                          update(i, 'movement_name', buildName(e.target.value, newSubs.length > 0 ? newSubs[0] : ''))
                        }}
                        style={selSt}>
                        <option value="">Velg...</option>
                        {allCategories.map(m => <option key={m} value={m}>{m}</option>)}
                        {row.movement_name && !allCategories.includes(parent) && (
                          <option value={parent}>{parent}</option>
                        )}
                      </select>
                    </div>
                  </td>
                  {/* Subcategory */}
                  <td className="px-2 py-1.5" style={{ minWidth: '100px' }}>
                    {subs.length > 0 ? (
                      <select value={sub} onChange={e => update(i, 'movement_name', buildName(parent, e.target.value))}
                        style={selSt}>
                        <option value="">Alle</option>
                        {subs.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span style={{ color: '#333340', fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif" }}>—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5" style={{ width: '60px' }}>
                    <div>
                      <input type="number" value={row.minutes} onChange={e => update(i, 'minutes', e.target.value)}
                        placeholder="—" min="0" style={iSt} />
                      <AutoPace movement={parent} minutes={row.minutes} km={row.distance_km} />
                    </div>
                  </td>
                  <td className="px-2 py-1.5" style={{ width: '60px' }}>
                    <input type="number" step="0.1" value={row.distance_km} onChange={e => update(i, 'distance_km', e.target.value)}
                      placeholder="—" min="0" style={iSt} />
                  </td>
                  <td className="px-2 py-1.5" style={{ width: '60px' }}>
                    <input type="number" value={row.elevation_meters} onChange={e => update(i, 'elevation_meters', e.target.value)}
                      placeholder="—" min="0" style={iSt} />
                  </td>
                  <td className="px-2 py-1.5" style={{ width: '55px' }}>
                    <div className="flex items-center gap-0.5">
                      <input type="number" value={row.avg_heart_rate} onChange={e => update(i, 'avg_heart_rate', e.target.value)}
                        placeholder="—" min="0" max="250" style={iSt} />
                      {row.avg_heart_rate && <span style={{ color: '#555560', fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0 }}>bpm</span>}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 w-8">
                    <button type="button" onClick={() => removeRow(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                      ×
                    </button>
                  </td>
                </tr>
                {isExp && (
                  <tr style={{ borderBottom: '1px solid #1A1A1E' }}>
                    <td colSpan={7} style={{ padding: 0 }}>
                      {isShooting ? (
                        <ShootingExpandSection
                          blocks={row.shooting_blocks ?? []}
                          onChange={bl => update(i, 'shooting_blocks', bl)}
                        />
                      ) : isStrength ? (
                        <ExerciseExpandSection
                          exercises={row.exercises ?? []}
                          onChange={ex => update(i, 'exercises', ex)}
                        />
                      ) : (
                        <ZoneExpandSection
                          zones={row.zones ?? []}
                          onChange={z => update(i, 'zones', z)}
                        />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: '1px solid #222228' }}>
              <td colSpan={2} className="px-2 py-1.5 text-xs tracking-widest uppercase"
                style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>Totalt</td>
              <td className="px-2 py-1.5 text-sm font-semibold" style={{ color: '#FF4500', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {totalMin > 0 ? totalMin : '—'}
              </td>
              <td className="px-2 py-1.5 text-sm" style={{ color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {totalKm > 0 ? totalKm.toFixed(1) : '—'}
              </td>
              <td className="px-2 py-1.5 text-sm" style={{ color: '#8A8A96', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {totalElev > 0 ? totalElev : '—'}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>

      {/* Quick-add default movements */}
      <div className="mt-3 flex flex-wrap gap-2">
        {defaultMovements.filter(m => !rows.some(r => r.movement_name.startsWith(m))).map(m => (
          <button key={m} type="button" onClick={() => addRow(m)}
            className="px-2 py-1 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
              background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
            }}>
            + {m}
          </button>
        ))}
        <button type="button" onClick={() => addRow()}
          className="px-2 py-1 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
            background: 'none', border: '1px solid rgba(255,69,0,0.3)', cursor: 'pointer',
          }}>
          + Annet
        </button>
      </div>
    </div>
  )
}

// Zone aggregation summary shown below all movements
export function ZoneAggregateSummary({ rows }: { rows: MovementRow[] }) {
  const totals: Record<string, number> = {}
  for (const row of rows) {
    for (const z of row.zones ?? []) {
      if (z.minutes && parseInt(z.minutes) > 0) {
        totals[z.zone_name] = (totals[z.zone_name] ?? 0) + parseInt(z.minutes)
      }
    }
  }
  const entries = INTENSITY_ZONES.slice(0, 5).map(zn => ({ zone: zn, minutes: totals[zn] ?? 0 }))
  const hasData = entries.some(e => e.minutes > 0)
  if (!hasData) return null

  const totalMins = entries.reduce((s, e) => s + e.minutes, 0)
  const zoneColors: Record<string, string> = {
    I1: '#2A5A8A', I2: '#1A7A4A', I3: '#8A8A10', I4: '#8A5A00', I5: '#8A1A00',
  }

  return (
    <div className="mt-4 p-3" style={{ backgroundColor: '#0D0D11', border: '1px solid #1A1A1E' }}>
      <p className="text-xs tracking-widest uppercase mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Sonefordeling totalt
      </p>
      {/* Bar */}
      <div className="flex h-2 w-full mb-2 overflow-hidden">
        {entries.filter(e => e.minutes > 0).map(e => (
          <div
            key={e.zone}
            style={{ width: `${(e.minutes / totalMins) * 100}%`, backgroundColor: zoneColors[e.zone] ?? '#333' }}
          />
        ))}
      </div>
      {/* Labels */}
      <div className="flex gap-4 flex-wrap">
        {entries.filter(e => e.minutes > 0).map(e => (
          <div key={e.zone} className="flex items-center gap-1.5">
            <div style={{ width: '8px', height: '8px', backgroundColor: zoneColors[e.zone] ?? '#333', flexShrink: 0 }} />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: zoneColors[e.zone], fontSize: '14px' }}>{e.zone}</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>{e.minutes}min</span>
          </div>
        ))}
      </div>
    </div>
  )
}
