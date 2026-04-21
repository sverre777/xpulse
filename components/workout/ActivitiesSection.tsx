'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityRow, ActivityType, ACTIVITY_TYPES, findActivityType,
  Sport, DEFAULT_MOVEMENTS_BY_SPORT, MOVEMENT_CATEGORIES,
  STRENGTH_SUBCATEGORIES,
  ActivityZoneMinutes, emptyActivityZones,
  StrengthExerciseRow, StrengthSetRow,
  ActivityLactateMeasurement,
  TUR_SUBCATEGORIES_WITH_SLED, WEATHER_OPTIONS,
} from '@/lib/types'
import { parseActivityDuration, formatActivityDuration } from '@/lib/activity-duration'
import { presetsForCategory } from '@/lib/exercise-presets'
import { getUserExercises, type UserExercise } from '@/app/actions/user-exercises'
import {
  getUserMovementTypes, createUserMovementType,
  type UserMovementType, type UserMovementTypeKind,
} from '@/app/actions/user-movement-types'
import {
  resolveMovementKind, isEnduranceFor, isStrengthFor, isTurFor,
  subcategoriesFor,
} from '@/lib/movement-types'

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
    elevation_gain_m: '',
    elevation_loss_m: '',
    pack_weight_kg: '',
    sled_weight_kg: '',
    weather: '',
    temperature_c: '',
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

const ZONE_KEYS: (keyof ActivityZoneMinutes)[] = ['I1','I2','I3','I4','I5','Hurtighet']

function sumZoneMinutes(z: ActivityZoneMinutes): number {
  return ZONE_KEYS.reduce((s, k) => s + (parseInt(z[k]) || 0), 0)
}

const ZONE_COLORS_BAR: Record<keyof ActivityZoneMinutes, string> = {
  I1: '#28A86E', I2: '#2A7AB8', I3: '#D4B500', I4: '#FF9500', I5: '#FF4500',
  Hurtighet: '#8B5CF6',
}

export function ActivitiesSection({ rows, onChange, sport, mode = 'dagbok' }: Props) {
  const isPlanMode = mode === 'plan'
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [userMovementTypes, setUserMovementTypes] = useState<UserMovementType[]>([])
  const [createModalRowId, setCreateModalRowId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getUserMovementTypes().then(data => {
      if (!cancelled) setUserMovementTypes(data)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const handleCreated = (created: UserMovementType, rowId: string | null) => {
    setUserMovementTypes(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    // Hvis modalet ble åpnet fra en rad sin dropdown, sett formen på den raden.
    if (rowId) {
      onChange(rows.map(r => r.id === rowId ? {
        ...r,
        movement_name: created.name,
        movement_subcategory: '',
        zones: created.type === 'utholdenhet' ? r.zones : emptyActivityZones(),
        exercises: created.type === 'styrke' ? r.exercises : [],
        elevation_gain_m: created.type === 'utholdenhet' || created.type === 'tur' ? r.elevation_gain_m : '',
        elevation_loss_m: created.type === 'utholdenhet' || created.type === 'tur' ? r.elevation_loss_m : '',
        pack_weight_kg: created.type === 'tur' ? r.pack_weight_kg : '',
        sled_weight_kg: created.type === 'tur' ? r.sled_weight_kg : '',
        weather: created.type === 'tur' ? r.weather : '',
        temperature_c: created.type === 'tur' ? r.temperature_c : '',
      } : r))
    }
    setCreateModalRowId(null)
  }

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
          userMovementTypes={userMovementTypes}
          onRequestCreateMovement={() => setCreateModalRowId(row.id)}
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

      {createModalRowId !== null && (
        <CreateMovementTypeModal
          onClose={() => setCreateModalRowId(null)}
          onCreated={u => handleCreated(u, createModalRowId)}
        />
      )}
    </div>
  )
}

const CREATE_MOVEMENT_SENTINEL = '__create_new_movement__'

function ActivityRowItem({
  row, expanded, onToggle, onUpdate, onDelete, onMoveUp, onMoveDown,
  typeOptions, sport, isPlanMode, userMovementTypes, onRequestCreateMovement,
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
  userMovementTypes: UserMovementType[]
  onRequestCreateMovement: () => void
}) {
  const meta = findActivityType(row.activity_type)
  const durSec = parseActivityDuration(row.duration)
  const durDisplay = durSec != null ? formatActivityDuration(durSec) : row.duration || '—'
  const kind = resolveMovementKind(row.movement_name, userMovementTypes)
  const isStrength = isStrengthFor(row.movement_name, userMovementTypes)
  const isEndurance = isEnduranceFor(row.movement_name, userMovementTypes)
  const isTur = isTurFor(row.movement_name, userMovementTypes)
  const isAnnet = kind === 'annet'
  const isCycling = sport === 'cycling' || row.movement_name === 'Sykling'
  const isUserMovement = userMovementTypes.some(u => u.name === row.movement_name)
  const subcatOptions = isStrength && !isUserMovement
    ? STRENGTH_SUBCATEGORIES
    : subcategoriesFor(row.movement_name, userMovementTypes)
  const hasSubcat = meta?.usesMovement && subcatOptions.length > 0

  // Når bevegelsesform endres → reset subcategory + exercises/zones-kontekst.
  // Høydemeter er tilgjengelig for utholdenhet + tur; nulles når vi forlater dem.
  // Tur-spesifikke felt nulles når vi bytter bort fra 'Tur' (standard eller bruker-definert).
  const handleMovementChange = (name: string) => {
    if (name === CREATE_MOVEMENT_SENTINEL) {
      onRequestCreateMovement()
      return
    }
    const nextKind = resolveMovementKind(name, userMovementTypes)
    const nextEndurance = nextKind === 'utholdenhet'
    const nextStrength = nextKind === 'styrke'
    const nextTur = nextKind === 'tur'
    const patch: Partial<ActivityRow> = {
      movement_name: name,
      movement_subcategory: '',
      zones: nextEndurance ? row.zones : emptyActivityZones(),
      exercises: nextStrength ? row.exercises : [],
    }
    if (!nextEndurance && !nextTur) {
      patch.elevation_gain_m = ''
      patch.elevation_loss_m = ''
    }
    if (!nextTur) {
      patch.pack_weight_kg = ''
      patch.sled_weight_kg = ''
      patch.weather = ''
      patch.temperature_c = ''
    }
    onUpdate(patch)
  }

  // Når underkategori endres bort fra en pulk-type på standard 'Tur', fjern pulkvekt.
  // Brukerens egne tur-former har ikke faste pulk-kategorier — vi nulstiller ikke da.
  const handleSubcategoryChange = (sub: string) => {
    const patch: Partial<ActivityRow> = { movement_subcategory: sub }
    if (row.movement_name === 'Tur' && !TUR_SUBCATEGORIES_WITH_SLED.has(sub)) {
      patch.sled_weight_kg = ''
    }
    onUpdate(patch)
  }

  const displayIcon = isStrength ? '🏋' : (meta?.icon ?? '•')

  return (
    <div style={{ border: '1px solid #262629', backgroundColor: '#1A1A1E' }}>
      {/* Compact row — flex-wrap så label/bevegelsesform kan gå på linje 2 på smal skjerm,
          mens ikon+type, varighet og kontroller forblir på topp-raden. */}
      <div
        className="flex items-center flex-wrap gap-x-2 gap-y-1 px-3 py-2 cursor-pointer"
        onClick={onToggle}
        style={{ userSelect: 'none' }}
      >
        {/* Up/down — touch-vennlig bredde */}
        <div className="flex flex-col items-center justify-center" style={{ width: '24px' }} onClick={e => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} disabled={!onMoveUp} aria-label="Flytt opp"
            style={{
              background: 'none', border: 'none', padding: '2px 0', cursor: onMoveUp ? 'pointer' : 'default',
              color: onMoveUp ? '#8A8A96' : '#2A2A30', fontSize: '11px', lineHeight: 1,
            }}>▲</button>
          <button type="button" onClick={onMoveDown} disabled={!onMoveDown} aria-label="Flytt ned"
            style={{
              background: 'none', border: 'none', padding: '2px 0', cursor: onMoveDown ? 'pointer' : 'default',
              color: onMoveDown ? '#8A8A96' : '#2A2A30', fontSize: '11px', lineHeight: 1,
            }}>▼</button>
        </div>

        {/* Type icon + label */}
        <span style={{ fontSize: '14px' }}>{displayIcon}</span>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#F0F0F2',
          fontSize: '14px',
          fontWeight: 600,
        }}>
          {meta?.label ?? row.activity_type}
        </span>

        {/* Movement · subcategory */}
        {meta?.usesMovement && row.movement_name && (
          <span
            className="truncate"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              fontSize: '13px', minWidth: 0,
            }}>
            · {row.movement_name}
            {row.movement_subcategory ? ` — ${row.movement_subcategory}` : ''}
          </span>
        )}

        <div className="flex-1" style={{ minWidth: '4px' }} />

        {/* Duration */}
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '15px', letterSpacing: '0.05em' }}>
          {durDisplay}
        </span>

        {/* HR — skjules på aller smaleste skjermer for å unngå wrap-bloat */}
        {row.avg_heart_rate && (
          <span className="hidden sm:inline" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '12px' }}>
            · {row.avg_heart_rate} bpm
          </span>
        )}

        {/* Expand */}
        <span style={{
          color: '#555560', fontSize: '12px',
          transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 150ms',
          marginLeft: '4px',
        }}>
          ▶
        </span>

        {/* Delete — større touch-mål */}
        <button type="button" onClick={e => { e.stopPropagation(); onDelete() }}
          aria-label="Slett aktivitet"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#555560', fontSize: '20px', lineHeight: 1,
            padding: '6px 8px', marginRight: '-6px',
          }}>×</button>
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
                  {userMovementTypes.length > 0 && (
                    <optgroup label="Mine egne">
                      {userMovementTypes.map(u => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </optgroup>
                  )}
                  <option value={CREATE_MOVEMENT_SENTINEL}>+ Lag ny bevegelsesform…</option>
                </select>
              </Field>
            )}

            {hasSubcat && (
              <Field label={isStrength ? 'Styrke-kategori' : 'Underkategori'}>
                <select value={row.movement_subcategory}
                  onChange={e => handleSubcategoryChange(e.target.value)}
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

            {!meta?.isShooting && !isStrength && !isAnnet && (
              <Field label="Distanse (km)">
                <input value={row.distance_km}
                  onChange={e => onUpdate({ distance_km: e.target.value })}
                  placeholder="10.5"
                  inputMode="decimal"
                  style={iSt} />
              </Field>
            )}

            {/* Høydemeter — utholdenhet + tur. Valgfrie. */}
            {(isEndurance || isTur) && (
              <>
                <Field label="Høydemeter opp (m)">
                  <input value={row.elevation_gain_m}
                    onChange={e => onUpdate({ elevation_gain_m: e.target.value })}
                    placeholder="—"
                    inputMode="numeric"
                    style={iSt} />
                </Field>
                <Field label="Høydemeter ned (m)">
                  <input value={row.elevation_loss_m}
                    onChange={e => onUpdate({ elevation_loss_m: e.target.value })}
                    placeholder="—"
                    inputMode="numeric"
                    style={iSt} />
                </Field>
              </>
            )}

            {!isPlanMode && (
              <>
                <Field label="Snittpuls (bpm)">
                  <input value={row.avg_heart_rate}
                    onChange={e => onUpdate({ avg_heart_rate: e.target.value })}
                    inputMode="numeric" placeholder="—"
                    style={iSt} />
                </Field>

                {!isAnnet && (
                  <Field label="Maks puls (bpm)">
                    <input value={row.max_heart_rate}
                      onChange={e => onUpdate({ max_heart_rate: e.target.value })}
                      inputMode="numeric" placeholder="—"
                      style={iSt} />
                  </Field>
                )}

                {isCycling && !meta?.isShooting && !isStrength && !isAnnet && (
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

          {/* Tur-spesifikke felt — vises for standard 'Tur' og bruker-definerte
              tur-former. Pulkvekt vises bare når underkategori matcher pulk-liste. */}
          {isTur && (
            <TurFields row={row} onUpdate={onUpdate} />
          )}

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

          {/* Skyting-felt — dagbok viser skudd + treff + %, plan viser kun
              planlagt antall skudd. Treff er alltid valgfritt. */}
          {meta?.isShooting && (
            <ShootingFields row={row} onUpdate={onUpdate} planMode={isPlanMode} />
          )}

          {/* Styrke-felt */}
          {isStrength && (
            <StrengthEditor
              exercises={row.exercises}
              onChange={ex => onUpdate({ exercises: ex })}
              category={row.movement_subcategory}
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
  const keys = ZONE_KEYS
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

      {/* Color bar — 6 segmenter når Hurtighet > 0, ellers 5 */}
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

      <div className="grid grid-cols-6 gap-2">
        {keys.map(k => (
          <div key={k}>
            <label className="block text-center mb-1 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ZONE_COLORS_BAR[k] }}>
              {k === 'Hurtighet' ? 'Hurt.' : k}
            </label>
            <input value={zones[k]}
              onChange={e => onChange({ ...zones, [k]: e.target.value })}
              inputMode="numeric" placeholder="0"
              style={{ ...iSt, textAlign: 'center' }} />
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Hurtighet føres manuelt — beregnes ikke fra puls.
      </p>
    </div>
  )
}

// ── Styrke ─────────────────────────────────────────────────
// Autocomplete henter brukerens personlige øvelsesbibliotek (last_used_at desc)
// ved mount og slår sammen med preset-forslag basert på valgt underkategori.
// Quick-add-knappene over "+ Legg til øvelse" hopper rett til en ny rad med navnet
// forhåndsutfylt.

function StrengthEditor({
  exercises, onChange, category,
}: {
  exercises: StrengthExerciseRow[]
  onChange: (ex: StrengthExerciseRow[]) => void
  category: string
}) {
  const [library, setLibrary] = useState<UserExercise[]>([])

  useEffect(() => {
    let cancelled = false
    getUserExercises().then(data => {
      if (!cancelled) setLibrary(data)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const presets = presetsForCategory(category)
  const libraryNames = useMemo(
    () => new Set(library.map(e => e.name.toLowerCase())),
    [library],
  )
  const presetQuickAdds = useMemo(
    () => presets.filter(p => !exercises.some(e => e.exercise_name.trim().toLowerCase() === p.toLowerCase())),
    [presets, exercises],
  )

  const addExercise = (seedName?: string, seedFromLibrary?: UserExercise) => {
    const base = emptyExercise()
    if (seedName) base.exercise_name = seedName
    if (seedFromLibrary) {
      base.exercise_name = seedFromLibrary.name
      // Forhåndsutfyll default reps/vekt på første sett.
      base.sets = [{
        ...base.sets[0],
        reps: seedFromLibrary.default_reps != null ? String(seedFromLibrary.default_reps) : '',
        weight_kg: seedFromLibrary.default_weight_kg != null ? String(seedFromLibrary.default_weight_kg) : '',
      }]
    }
    onChange([...exercises, base])
  }
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
            library={library}
            presets={presets}
            libraryNames={libraryNames}
          />
        ))}
      </div>

      {presetQuickAdds.length > 0 && (
        <div className="mt-3">
          <div className="text-xs tracking-widest uppercase mb-1.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Foreslått
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presetQuickAdds.map(name => (
              <button key={name} type="button" onClick={() => addExercise(name)}
                className="text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC',
                  background: 'none', border: '1px solid #262629',
                  padding: '4px 10px', cursor: 'pointer',
                }}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={() => addExercise()}
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
  exercise, onUpdate, onDelete, library, presets, libraryNames,
}: {
  exercise: StrengthExerciseRow
  onUpdate: (patch: Partial<StrengthExerciseRow>) => void
  onDelete: () => void
  library: UserExercise[]
  presets: string[]
  libraryNames: Set<string>
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

  // Fyll inn default reps/vekt fra biblioteket — men bare hvis første sett
  // fortsatt er tomt (ikke overskriv det brukeren allerede har skrevet).
  const applyLibraryDefaults = (item: UserExercise) => {
    const first = exercise.sets[0]
    const shouldFill =
      !!first && !first.reps && !first.weight_kg && !first.rpe
    const patch: Partial<StrengthExerciseRow> = { exercise_name: item.name }
    if (shouldFill && (item.default_reps != null || item.default_weight_kg != null)) {
      patch.sets = exercise.sets.map((s, i) => i === 0 ? {
        ...s,
        reps: item.default_reps != null ? String(item.default_reps) : s.reps,
        weight_kg: item.default_weight_kg != null ? String(item.default_weight_kg) : s.weight_kg,
      } : s)
    }
    onUpdate(patch)
  }

  return (
    <div style={{ border: '1px solid #262629', backgroundColor: '#1A1A1E', padding: '10px' }}>
      <div className="flex items-center gap-2 mb-2">
        <ExerciseNameAutocomplete
          value={exercise.exercise_name}
          onChange={name => onUpdate({ exercise_name: name })}
          onPickLibrary={applyLibraryDefaults}
          library={library}
          presets={presets}
          libraryNames={libraryNames}
        />
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

// Autocomplete for styrke-øvelsesnavn.
// Primærkilde: brukerens personlige bibliotek (sortert sist brukt først).
// Sekundær: preset-navn for valgt underkategori som ikke allerede finnes i
// biblioteket. Listen filtreres case-insensitive på tekst brukeren skriver.

type SuggestionItem =
  | { kind: 'library'; name: string; item: UserExercise }
  | { kind: 'preset'; name: string }

function ExerciseNameAutocomplete({
  value, onChange, onPickLibrary, library, presets, libraryNames,
}: {
  value: string
  onChange: (name: string) => void
  onPickLibrary: (item: UserExercise) => void
  library: UserExercise[]
  presets: string[]
  libraryNames: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const q = value.trim().toLowerCase()
  const suggestions = useMemo<SuggestionItem[]>(() => {
    const libMatches = library
      .filter(e => !q || e.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map<SuggestionItem>(item => ({ kind: 'library', name: item.name, item }))

    const presetMatches = presets
      .filter(p => !libraryNames.has(p.toLowerCase()))
      .filter(p => !q || p.toLowerCase().includes(q))
      .slice(0, 8)
      .map<SuggestionItem>(name => ({ kind: 'preset', name }))

    return [...libMatches, ...presetMatches]
  }, [library, presets, libraryNames, q])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const pick = (s: SuggestionItem) => {
    if (s.kind === 'library') {
      onPickLibrary(s.item)
    } else {
      onChange(s.name)
    }
    setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1 }}>
      <input value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Øvelsesnavn (f.eks. Knebøy)"
        style={{ ...iSt, width: '100%', fontWeight: 600 }} />

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          backgroundColor: '#16161A', border: '1px solid #262629',
          marginTop: '2px', maxHeight: '220px', overflowY: 'auto',
        }}>
          {suggestions.map((s, i) => (
            <button key={`${s.kind}-${s.name}-${i}`} type="button"
              onClick={() => pick(s)}
              className="w-full flex items-center justify-between px-3 py-1.5 transition-colors hover:bg-[#1E1E22]"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2',
                fontSize: '14px', textAlign: 'left',
              }}>
              <span>{s.name}</span>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: s.kind === 'library' ? '#8A8A96' : '#555560',
                fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {s.kind === 'library'
                  ? `brukt ${s.item.times_used}×`
                  : 'forslag'}
              </span>
            </button>
          ))}
        </div>
      )}
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

// ── Tur-spesifikke felt ────────────────────────────────────
// Pakkevekt, pulkvekt, total (read-only sum), værforhold og temperatur.
// Pulkvekt vises kun når underkategori tilsier det (f.eks. "Fjellski med pulk").

function TurFields({
  row, onUpdate,
}: {
  row: ActivityRow
  onUpdate: (patch: Partial<ActivityRow>) => void
}) {
  const showSled = TUR_SUBCATEGORIES_WITH_SLED.has(row.movement_subcategory)
  const pack = parseFloat(row.pack_weight_kg)
  const sled = parseFloat(row.sled_weight_kg)
  const total =
    (Number.isFinite(pack) ? pack : 0) +
    (showSled && Number.isFinite(sled) ? sled : 0)
  const hasWeight =
    (Number.isFinite(pack) && pack > 0) ||
    (showSled && Number.isFinite(sled) && sled > 0)

  return (
    <div className="mt-3 p-3" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Tur
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Sekkvekt (kg)">
          <input value={row.pack_weight_kg}
            onChange={e => onUpdate({ pack_weight_kg: e.target.value })}
            placeholder="—" inputMode="decimal"
            style={iSt} />
        </Field>

        {showSled && (
          <Field label="Pulkvekt (kg)">
            <input value={row.sled_weight_kg}
              onChange={e => onUpdate({ sled_weight_kg: e.target.value })}
              placeholder="—" inputMode="decimal"
              style={iSt} />
          </Field>
        )}

        {hasWeight && (
          <Field label="Total vekt (kg)">
            <input value={total ? total.toFixed(1) : ''}
              readOnly
              style={{ ...iSt, color: '#8A8A96', cursor: 'not-allowed' }} />
          </Field>
        )}

        <Field label="Værforhold">
          <select value={row.weather}
            onChange={e => onUpdate({ weather: e.target.value })}
            style={iSt}>
            <option value="">—</option>
            {WEATHER_OPTIONS.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </Field>

        <Field label="Temperatur (°C)">
          <input value={row.temperature_c}
            onChange={e => onUpdate({ temperature_c: e.target.value })}
            placeholder="—" inputMode="decimal"
            style={iSt} />
        </Field>
      </div>
    </div>
  )
}

// ── Skyting (Liggende/Stående/Kombinert/Innskyting/Basisskyting) ────────
// Treff er alltid valgfritt — brukeren kan registrere kun antall skudd for
// øvelser der treff ikke telles. Treff%-statistikk beregnes kun der treff er
// fylt inn.
// I plan-modus vises kun "Antall skudd planlagt" (ingen treff, ingen %).

function ShootingFields({
  row, onUpdate, planMode,
}: {
  row: ActivityRow
  onUpdate: (patch: Partial<ActivityRow>) => void
  planMode: boolean
}) {
  const isInnskyting = row.activity_type === 'skyting_innskyting'
  const isBasis = row.activity_type === 'skyting_basis'
  const isKombOrBasis = row.activity_type === 'skyting_kombinert' || isBasis
  const showProne    = row.activity_type === 'skyting_liggende' || isKombOrBasis || isInnskyting
  const showStanding = row.activity_type === 'skyting_staaende' || isKombOrBasis || isInnskyting

  const pronePct = planMode ? null : computePct(row.prone_shots, row.prone_hits)
  const standingPct = planMode ? null : computePct(row.standing_shots, row.standing_hits)

  const heading =
    isInnskyting ? 'Innskyting' :
    isBasis      ? 'Basisskyting' :
                   'Skyting'

  return (
    <div className="mt-3 p-3" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {heading}
        {!planMode && (
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
            planMode={planMode}
          />
        )}
        {showStanding && (
          <ShootingBlock
            label="Stående"
            shots={row.standing_shots} hits={row.standing_hits}
            onShots={v => onUpdate({ standing_shots: v })}
            onHits={v => onUpdate({ standing_hits: v })}
            pct={standingPct}
            planMode={planMode}
          />
        )}
      </div>
    </div>
  )
}

function ShootingBlock({
  label, shots, hits, onShots, onHits, pct, planMode,
}: {
  label: string; shots: string; hits: string
  onShots: (v: string) => void; onHits: (v: string) => void
  pct: number | null
  planMode: boolean
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
      {planMode ? (
        <input value={shots} onChange={e => onShots(e.target.value)}
          inputMode="numeric" placeholder="Antall skudd planlagt"
          style={iSt} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input value={shots} onChange={e => onShots(e.target.value)}
            inputMode="numeric" placeholder="Skudd"
            style={iSt} />
          <input value={hits} onChange={e => onHits(e.target.value)}
            inputMode="numeric" placeholder="Treff (valgfritt)"
            style={iSt} />
        </div>
      )}
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

// ── Modal: Lag ny bevegelsesform ───────────────────────────
// Enkel modal med navn, type (4 valg), valgfrie kommaseparerte underkategorier,
// og valgfritt notat. Brukes fra bevegelsesform-dropdown-en i aktivitetsraden.

const KIND_LABELS: Record<UserMovementTypeKind, string> = {
  utholdenhet: 'Utholdenhet',
  styrke: 'Styrke-spenst',
  tur: 'Tur',
  annet: 'Annet',
}

function CreateMovementTypeModal({
  onClose, onCreated,
}: {
  onClose: () => void
  onCreated: (u: UserMovementType) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<UserMovementTypeKind>('utholdenhet')
  const [subcatsText, setSubcatsText] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    const subcategories = subcatsText
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '')
    const res = await createUserMovementType({ name, type, subcategories, notes })
    if (res.error) {
      setError(res.error)
      setSaving(false)
      return
    }
    if (res.data) onCreated(res.data)
    setSaving(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)', padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#111113', border: '1px solid #262629',
          width: '100%', maxWidth: '480px', padding: '20px',
        }}
      >
        <h3 style={{
          fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
          fontSize: '22px', letterSpacing: '0.05em', margin: 0, marginBottom: '16px',
        }}>
          NY BEVEGELSESFORM
        </h3>

        <div className="space-y-3">
          <div>
            <Label>Navn *</Label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="F.eks. Innebandy, Kiting"
              autoFocus
              style={iSt} />
          </div>

          <div>
            <Label>Type *</Label>
            <div className="flex flex-wrap gap-1.5">
              {(['utholdenhet', 'styrke', 'tur', 'annet'] as const).map(k => {
                const active = type === k
                return (
                  <button key={k} type="button" onClick={() => setType(k)}
                    className="text-xs tracking-widest uppercase transition-opacity"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: active ? '#FF4500' : '#C0C0CC',
                      background: active ? '#1A1A1E' : 'none',
                      border: '1px solid ' + (active ? '#FF4500' : '#262629'),
                      padding: '6px 12px', cursor: 'pointer',
                    }}>
                    {KIND_LABELS[k]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label>Underkategorier (valgfritt — kommaseparert)</Label>
            <input value={subcatsText} onChange={e => setSubcatsText(e.target.value)}
              placeholder="F.eks. Teknisk, Taktisk, Styrke"
              style={iSt} />
          </div>

          <div>
            <Label>Notat (valgfritt)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Kort beskrivelse..."
              style={{ ...iSt, resize: 'vertical' }} />
          </div>

          {error && (
            <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #262629',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}>
            Avbryt
          </button>
          <button type="button" onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
              background: 'none', border: '1px solid #FF4500',
              cursor: (saving || !name.trim()) ? 'not-allowed' : 'pointer',
              opacity: (saving || !name.trim()) ? 0.5 : 1,
            }}>
            {saving ? 'Lagrer…' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  )
}
