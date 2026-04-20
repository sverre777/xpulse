'use client'

import { useState } from 'react'
import {
  ActivityRow, ActivityType, ACTIVITY_TYPES, findActivityType,
  Sport, DEFAULT_MOVEMENTS_BY_SPORT, MOVEMENT_CATEGORIES,
  ACTIVITY_SUBCATEGORIES, STRENGTH_SUBCATEGORIES,
  ActivityZoneMinutes, emptyActivityZones,
  StrengthExerciseRow, StrengthSetRow,
  ActivityLactateMeasurement,
  isEnduranceMovement, isStrengthMovement,
} from '@/lib/types'
import { parseActivityDuration, formatActivityDuration } from '@/lib/activity-duration'

interface Props {
  rows: ActivityRow[]
  onChange: (rows: ActivityRow[]) => void
  sport: Sport
  // I plan-modus skjules rene måleverdier (puls, laktat, treff) — plan fokuserer
  // på intensjon (type, bevegelsesform, varighet, soner/målpuls).
  mode?: 'plan' | 'dagbok'
}

function defaultMovementForSport(sport: Sport): string {
  return DEFAULT_MOVEMENTS_BY_SPORT[sport]?.[0] ?? 'Løping'
}

function emptyRow(type: ActivityType, movement: string): ActivityRow {
  return {
    id: crypto.randomUUID(),
    activity_type: type,
    movement_name: movement,
    movement_subcategory: '',
    start_time: '',
    duration: '',
    distance_km: '',
    avg_heart_rate: '',
    max_heart_rate: '',
    avg_watts: '',
    prone_shots: '',
    prone_hits: '',
    standing_shots: '',
    standing_hits: '',
    notes: '',
    zones: emptyActivityZones(),
    exercises: [],
    lactate_measurements: [],
  }
}

function emptyLactateMeasurement(): ActivityLactateMeasurement {
  return {
    id: crypto.randomUUID(),
    value_mmol: '',
    measured_at: '',
  }
}

function emptyExercise(): StrengthExerciseRow {
  return {
    id: crypto.randomUUID(),
    exercise_name: '',
    notes: '',
    sets: [emptySet(1)],
  }
}

function emptySet(n: number): StrengthSetRow {
  return {
    id: crypto.randomUUID(),
    set_number: String(n),
    reps: '',
    weight_kg: '',
    rpe: '',
    notes: '',
  }
}

function sumZoneMinutes(z: ActivityZoneMinutes): number {
  return (['I1','I2','I3','I4','I5'] as const)
    .reduce((s, k) => s + (parseInt(z[k]) || 0), 0)
}

const ZONE_COLORS_BAR: Record<keyof ActivityZoneMinutes, string> = {
  I1: '#28A86E', I2: '#2A7AB8', I3: '#D4B500', I4: '#FF9500', I5: '#FF4500',
}

export function ActivitiesSection({ rows, onChange, sport, mode = 'dagbok' }: Props) {
  const isPlanMode = mode === 'plan'
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const updateRow = (id: string, patch: Partial<ActivityRow>) => {
    onChange(rows.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const deleteRow = (id: string) => {
    onChange(rows.filter(r => r.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const moveRow = (id: string, dir: -1 | 1) => {
    const i = rows.findIndex(r => r.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const addRow = () => {
    const last = rows[rows.length - 1]
    // Default: hovedaktivitet med sport-ens hovedbevegelsesform. Subsequent rader
    // kopierer type + bevegelsesform fra forrige (så serier av like økter blir raske).
    const type: ActivityType = last ? last.activity_type : 'aktivitet'
    const movement = last ? last.movement_name : defaultMovementForSport(sport)
    const newRow = emptyRow(type, movement)
    onChange([...rows, newRow])
    // Nye rader åpnes ekspandert så brukeren kan fylle inn umiddelbart.
    setExpandedId(newRow.id)
  }

  const isBiathlon = sport === 'biathlon'
  const typeOptions = ACTIVITY_TYPES.filter(t => !t.biathlonOnly || isBiathlon)

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen aktiviteter ennå. Legg til en for å logge bevegelse, pause eller skyting.
        </p>
      )}

      {rows.map((row, idx) => (
        <ActivityRowItem
          key={row.id}
          row={row}
          expanded={expandedId === row.id}
          onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
          onUpdate={patch => updateRow(row.id, patch)}
          onDelete={() => deleteRow(row.id)}
          onMoveUp={idx > 0 ? () => moveRow(row.id, -1) : undefined}
          onMoveDown={idx < rows.length - 1 ? () => moveRow(row.id, 1) : undefined}
          typeOptions={typeOptions}
          sport={sport}
          isPlanMode={isPlanMode}
        />
      ))}

      <button
        type="button"
        onClick={addRow}
        className="mt-3 px-4 py-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#FF4500',
          background: 'none',
          border: '1px dashed #FF4500',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        + Legg til aktivitet
      </button>
    </div>
  )
}

function ActivityRowItem({
  row, expanded, onToggle, onUpdate, onDelete, onMoveUp, onMoveDown,
  typeOptions, sport, isPlanMode,
}: {
  row: ActivityRow
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<ActivityRow>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  typeOptions: typeof ACTIVITY_TYPES
  sport: Sport
  isPlanMode: boolean
}) {
  const meta = findActivityType(row.activity_type)
  const durSec = parseActivityDuration(row.duration)
  const durDisplay = durSec != null ? formatActivityDuration(durSec) : row.duration || '—'
  const isStrength = isStrengthMovement(row.movement_name)
  const isEndurance = isEnduranceMovement(row.movement_name)
  const isCycling = sport === 'cycling' || row.movement_name === 'Sykling'
  const subcatOptions =
    isStrength ? STRENGTH_SUBCATEGORIES :
    (ACTIVITY_SUBCATEGORIES[row.movement_name] ?? [])
  const hasSubcat = meta?.usesMovement && (isStrength || subcatOptions.length > 0)

  // Når bevegelsesform endres → reset subcategory + exercises/zones-kontekst.
  const handleMovementChange = (name: string) => {
    onUpdate({
      movement_name: name,
      movement_subcategory: '',
      // Bytter vi bort fra endurance → null ut zones; bytter vi bort fra strength → null ut exercises.
      zones: isEnduranceMovement(name) ? row.zones : emptyActivityZones(),
      exercises: isStrengthMovement(name) ? row.exercises : [],
    })
  }

  const displayIcon = isStrength ? '🏋' : (meta?.icon ?? '•')

  return (
    <div style={{ border: '1px solid #262629', backgroundColor: '#1A1A1E' }}>
      {/* Compact row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onToggle}
        style={{ userSelect: 'none' }}
      >
        {/* Up/down */}
        <div className="flex flex-col" style={{ width: '18px' }} onClick={e => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} disabled={!onMoveUp}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: onMoveUp ? 'pointer' : 'default',
              color: onMoveUp ? '#8A8A96' : '#2A2A30', fontSize: '10px', lineHeight: 1,
            }}>▲</button>
          <button type="button" onClick={onMoveDown} disabled={!onMoveDown}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: onMoveDown ? 'pointer' : 'default',
              color: onMoveDown ? '#8A8A96' : '#2A2A30', fontSize: '10px', lineHeight: 1,
            }}>▼</button>
        </div>

        {/* Type icon + label */}
        <span style={{ fontSize: '14px' }}>{displayIcon}</span>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#F0F0F2',
          fontSize: '14px',
          fontWeight: 600,
          minWidth: '120px',
        }}>
          {meta?.label ?? row.activity_type}
        </span>

        {/* Movement · subcategory */}
        {meta?.usesMovement && row.movement_name && (
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
            · {row.movement_name}
            {row.movement_subcategory ? ` — ${row.movement_subcategory}` : ''}
          </span>
        )}

        <div className="flex-1" />

        {/* Duration */}
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '15px', letterSpacing: '0.05em' }}>
          {durDisplay}
        </span>

        {/* HR */}
        {row.avg_heart_rate && (
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '12px' }}>
            · {row.avg_heart_rate} bpm
          </span>
        )}

        {/* Expand */}
        <span style={{
          color: '#555560', fontSize: '11px',
          transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 150ms',
          marginLeft: '6px',
        }}>
          ▶
        </span>

        {/* Delete */}
        <button type="button" onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#555560', fontSize: '16px', lineHeight: 1, padding: '0 4px',
          }}
          title="Slett aktivitet">×</button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid #262629' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            <Field label="Aktivitetstype">
              <select value={row.activity_type}
                onChange={e => onUpdate({ activity_type: e.target.value as ActivityType })}
                style={iSt}>
                {typeOptions.map(t => (
                  <option key={t.value} value={t.value}>{t.icon}  {t.label}</option>
                ))}
              </select>
            </Field>

            {meta?.usesMovement && (
              <Field label="Bevegelsesform">
                <select value={row.movement_name}
                  onChange={e => handleMovementChange(e.target.value)}
                  style={iSt}>
                  <option value="">—</option>
                  {MOVEMENT_CATEGORIES.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </Field>
            )}

            {hasSubcat && (
              <Field label={isStrength ? 'Styrke-kategori' : 'Underkategori'}>
                <select value={row.movement_subcategory}
                  onChange={e => onUpdate({ movement_subcategory: e.target.value })}
                  style={iSt}>
                  <option value="">Velg underkategori</option>
                  {subcatOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Klokkeslett start">
              <input type="time" value={row.start_time}
                onChange={e => onUpdate({ start_time: e.target.value })}
                style={iSt} />
            </Field>

            <Field label="Varighet (MM:SS)">
              <input value={row.duration}
                onChange={e => onUpdate({ duration: e.target.value })}
                placeholder="45:30"
                style={iSt} />
            </Field>

            {!meta?.isShooting && !isStrength && (
              <Field label="Distanse (km)">
                <input value={row.distance_km}
                  onChange={e => onUpdate({ distance_km: e.target.value })}
                  placeholder="10.5"
                  inputMode="decimal"
                  style={iSt} />
              </Field>
            )}

            {!isPlanMode && (
              <>
                <Field label="Snittpuls (bpm)">
                  <input value={row.avg_heart_rate}
                    onChange={e => onUpdate({ avg_heart_rate: e.target.value })}
                    inputMode="numeric" placeholder="—"
                    style={iSt} />
                </Field>

                <Field label="Maks puls (bpm)">
                  <input value={row.max_heart_rate}
                    onChange={e => onUpdate({ max_heart_rate: e.target.value })}
                    inputMode="numeric" placeholder="—"
                    style={iSt} />
                </Field>

                {isCycling && !meta?.isShooting && !isStrength && (
                  <Field label="Snittwatt">
                    <input value={row.avg_watts}
                      onChange={e => onUpdate({ avg_watts: e.target.value })}
                      inputMode="numeric" placeholder="—"
                      style={iSt} />
                  </Field>
                )}
              </>
            )}
          </div>

          {/* Sonefordeling — kun utholdenhet (ikke skyting/pause/styrke) */}
          {isEndurance && !meta?.isShooting && (
            <ZoneEditor
              zones={row.zones}
              onChange={z => {
                const total = sumZoneMinutes(z)
                // Når soner summerer > 0, synk totaltid (MM:SS). Tomme soner → la manuell varighet stå.
                const patch: Partial<ActivityRow> = { zones: z }
                if (total > 0) patch.duration = formatActivityDuration(total * 60)
                onUpdate(patch)
              }}
            />
          )}

          {/* Skyting-felt — kun i dagbok-modus (faktiske skudd/treff) */}
          {meta?.isShooting && !isPlanMode && (
            <ShootingFields row={row} onUpdate={onUpdate} />
          )}

          {/* Styrke-felt */}
          {isStrength && (
            <StrengthEditor
              exercises={row.exercises}
              onChange={ex => onUpdate({ exercises: ex })}
            />
          )}

          {/* Laktat — én eller flere målinger (kun dagbok, ikke plan) */}
          {!isPlanMode && (
            <LactateMeasurementsEditor
              measurements={row.lactate_measurements}
              onChange={m => onUpdate({ lactate_measurements: m })}
            />
          )}

          <div className="mt-3">
            <Label>Notat</Label>
            <textarea value={row.notes}
              onChange={e => onUpdate({ notes: e.target.value })}
              rows={2} placeholder="Kort kommentar..."
              style={{ ...iSt, resize: 'vertical' }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sonefordeling ──────────────────────────────────────────

function ZoneEditor({
  zones, onChange,
}: {
  zones: ActivityZoneMinutes
  onChange: (z: ActivityZoneMinutes) => void
}) {
  const keys: (keyof ActivityZoneMinutes)[] = ['I1','I2','I3','I4','I5']
  const total = sumZoneMinutes(zones)
  return (
    <div className="mt-3 p-3" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Sonefordeling (min)
        </span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '15px', letterSpacing: '0.05em' }}>
          Σ {total} min
        </span>
      </div>

      {/* Color bar */}
      <div className="flex mb-2" style={{ height: '6px', border: '1px solid #1E1E22' }}>
        {keys.map(k => {
          const m = parseInt(zones[k]) || 0
          const w = total > 0 ? (m / total) * 100 : 0
          return w > 0 ? (
            <div key={k} style={{ width: `${w}%`, backgroundColor: ZONE_COLORS_BAR[k] }} />
          ) : null
        })}
        {total === 0 && <div style={{ flex: 1, backgroundColor: '#1A1A1E' }} />}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {keys.map(k => (
          <div key={k}>
            <label className="block text-center mb-1 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ZONE_COLORS_BAR[k] }}>
              {k}
            </label>
            <input value={zones[k]}
              onChange={e => onChange({ ...zones, [k]: e.target.value })}
              inputMode="numeric" placeholder="0"
              style={{ ...iSt, textAlign: 'center' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Styrke ─────────────────────────────────────────────────

function StrengthEditor({
  exercises, onChange,
}: {
  exercises: StrengthExerciseRow[]
  onChange: (ex: StrengthExerciseRow[]) => void
}) {
  const addExercise = () => onChange([...exercises, emptyExercise()])
  const updateExercise = (id: string, patch: Partial<StrengthExerciseRow>) =>
    onChange(exercises.map(e => e.id === id ? { ...e, ...patch } : e))
  const deleteExercise = (id: string) =>
    onChange(exercises.filter(e => e.id !== id))

  return (
    <div className="mt-3 p-3" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="text-xs tracking-widest uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Øvelser
      </div>

      {exercises.length === 0 && (
        <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen øvelser. Trykk nedenfor for å legge til første.
        </p>
      )}

      <div className="space-y-3">
        {exercises.map(ex => (
          <ExerciseBlock key={ex.id}
            exercise={ex}
            onUpdate={patch => updateExercise(ex.id, patch)}
            onDelete={() => deleteExercise(ex.id)}
          />
        ))}
      </div>

      <button type="button" onClick={addExercise}
        className="mt-3 px-3 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
          background: 'none', border: '1px dashed #FF4500', cursor: 'pointer', width: '100%',
        }}>
        + Legg til øvelse
      </button>
    </div>
  )
}

function ExerciseBlock({
  exercise, onUpdate, onDelete,
}: {
  exercise: StrengthExerciseRow
  onUpdate: (patch: Partial<StrengthExerciseRow>) => void
  onDelete: () => void
}) {
  const updateSet = (id: string, patch: Partial<StrengthSetRow>) =>
    onUpdate({ sets: exercise.sets.map(s => s.id === id ? { ...s, ...patch } : s) })
  const addSet = () => {
    const n = exercise.sets.length + 1
    onUpdate({ sets: [...exercise.sets, emptySet(n)] })
  }
  const deleteSet = (id: string) => {
    const next = exercise.sets.filter(s => s.id !== id)
      .map((s, i) => ({ ...s, set_number: String(i + 1) }))
    onUpdate({ sets: next })
  }

  return (
    <div style={{ border: '1px solid #262629', backgroundColor: '#1A1A1E', padding: '10px' }}>
      <div className="flex items-center gap-2 mb-2">
        <input value={exercise.exercise_name}
          onChange={e => onUpdate({ exercise_name: e.target.value })}
          placeholder="Øvelsesnavn (f.eks. Knebøy)"
          list="strength-exercise-list"
          style={{ ...iSt, flex: 1, fontWeight: 600 }} />
        <button type="button" onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555560', fontSize: '16px', padding: '0 6px' }}
          title="Slett øvelse">×</button>
      </div>

      {/* Set rows */}
      <div className="space-y-1.5">
        <div className="grid gap-2 px-1 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
            gridTemplateColumns: '40px 1fr 1fr 70px 24px',
          }}>
          <span>Sett</span>
          <span>Reps</span>
          <span>Vekt (kg)</span>
          <span>RPE</span>
          <span></span>
        </div>
        {exercise.sets.map(s => (
          <div key={s.id} className="grid gap-2 items-center"
            style={{ gridTemplateColumns: '40px 1fr 1fr 70px 24px' }}>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", color: '#8A8A96', fontSize: '14px', textAlign: 'center',
            }}>{s.set_number}</span>
            <input value={s.reps}
              onChange={e => updateSet(s.id, { reps: e.target.value })}
              inputMode="numeric" placeholder="—"
              style={{ ...iSt, textAlign: 'center' }} />
            <input value={s.weight_kg}
              onChange={e => updateSet(s.id, { weight_kg: e.target.value })}
              inputMode="decimal" placeholder="—"
              style={{ ...iSt, textAlign: 'center' }} />
            <input value={s.rpe}
              onChange={e => updateSet(s.id, { rpe: e.target.value })}
              inputMode="numeric" placeholder="—"
              style={{ ...iSt, textAlign: 'center' }} />
            <button type="button" onClick={() => deleteSet(s.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555560', fontSize: '14px' }}
              title="Slett sett">×</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addSet}
        className="mt-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
        + Legg til sett
      </button>
    </div>
  )
}

// ── Laktatmålinger ─────────────────────────────────────────

function LactateMeasurementsEditor({
  measurements, onChange,
}: {
  measurements: ActivityLactateMeasurement[]
  onChange: (m: ActivityLactateMeasurement[]) => void
}) {
  const addMeasurement = () => onChange([...measurements, emptyLactateMeasurement()])
  const updateMeasurement = (id: string, patch: Partial<ActivityLactateMeasurement>) =>
    onChange(measurements.map(m => m.id === id ? { ...m, ...patch } : m))
  const deleteMeasurement = (id: string) =>
    onChange(measurements.filter(m => m.id !== id))

  return (
    <div className="mt-3 p-3" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Laktat
      </div>

      {measurements.length > 0 && (
        <div className="grid gap-2 px-1 mb-1 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
            gridTemplateColumns: '1fr 1fr 24px',
          }}>
          <span>mmol/L</span>
          <span>Klokkeslett</span>
          <span></span>
        </div>
      )}

      <div className="space-y-1.5">
        {measurements.map(m => (
          <div key={m.id} className="grid gap-2 items-center"
            style={{ gridTemplateColumns: '1fr 1fr 24px' }}>
            <input value={m.value_mmol}
              onChange={e => updateMeasurement(m.id, { value_mmol: e.target.value })}
              inputMode="decimal" placeholder="—"
              style={{ ...iSt, color: '#FF4500', textAlign: 'center' }} />
            <input type="time" value={m.measured_at}
              onChange={e => updateMeasurement(m.id, { measured_at: e.target.value })}
              style={{ ...iSt, textAlign: 'center' }} />
            <button type="button" onClick={() => deleteMeasurement(m.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555560', fontSize: '14px' }}
              title="Slett måling">×</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addMeasurement}
        className="mt-2 px-3 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
          background: 'none', border: '1px dashed #FF4500', cursor: 'pointer', width: '100%',
        }}>
        + Legg til laktat
      </button>
    </div>
  )
}

// ── Skyting (Liggende/Stående/Kombinert/Innskyting) ────────

function ShootingFields({
  row, onUpdate,
}: {
  row: ActivityRow
  onUpdate: (patch: Partial<ActivityRow>) => void
}) {
  const isInnskyting = row.activity_type === 'skyting_innskyting'
  const isKomb = row.activity_type === 'skyting_kombinert'
  const showProne    = row.activity_type === 'skyting_liggende' || isKomb || isInnskyting
  const showStanding = row.activity_type === 'skyting_staaende' || isKomb || isInnskyting

  const pronePct = computePct(row.prone_shots, row.prone_hits)
  const standingPct = computePct(row.standing_shots, row.standing_hits)

  return (
    <div className="mt-3 p-3" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {isInnskyting ? 'Innskyting' : 'Skyting'}
        {isInnskyting && (
          <span style={{ marginLeft: 8, color: '#8A8A96', textTransform: 'none', letterSpacing: 0 }}>
            · Treff er valgfritt
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showProne && (
          <ShootingBlock
            label="Liggende"
            shots={row.prone_shots} hits={row.prone_hits}
            onShots={v => onUpdate({ prone_shots: v })}
            onHits={v => onUpdate({ prone_hits: v })}
            pct={pronePct}
            hitsOptional={isInnskyting}
          />
        )}
        {showStanding && (
          <ShootingBlock
            label="Stående"
            shots={row.standing_shots} hits={row.standing_hits}
            onShots={v => onUpdate({ standing_shots: v })}
            onHits={v => onUpdate({ standing_hits: v })}
            pct={standingPct}
            hitsOptional={isInnskyting}
          />
        )}
      </div>
    </div>
  )
}

function ShootingBlock({
  label, shots, hits, onShots, onHits, pct, hitsOptional,
}: {
  label: string; shots: string; hits: string
  onShots: (v: string) => void; onHits: (v: string) => void
  pct: number | null
  hitsOptional?: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {label}
        </span>
        {pct != null && (
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: pct >= 80 ? '#28A86E' : pct >= 60 ? '#FF9500' : '#FF4500',
            fontSize: '15px', letterSpacing: '0.05em',
          }}>
            {pct}%
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={shots} onChange={e => onShots(e.target.value)}
          inputMode="numeric" placeholder="Skudd"
          style={iSt} />
        <input value={hits} onChange={e => onHits(e.target.value)}
          inputMode="numeric" placeholder={hitsOptional ? 'Treff (valgfritt)' : 'Treff'}
          style={iSt} />
      </div>
    </div>
  )
}

function computePct(shots: string, hits: string): number | null {
  const s = parseInt(shots)
  const h = parseInt(hits)
  if (!Number.isFinite(s) || !Number.isFinite(h) || s <= 0) return null
  return Math.round((h / s) * 100)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1 text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {children}
    </label>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#16161A',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
}
