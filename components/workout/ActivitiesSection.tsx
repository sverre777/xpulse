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
import { PaceInput } from '@/components/pace/PaceInput'
import { SplitsTable } from '@/components/pace/SplitsTable'
import { resolvePaceUnit } from '@/components/pace/PaceDisplay'
import {
  paceFromDistanceDuration, type PaceUnit,
} from '@/lib/pace-utils'
import { presetsForCategory } from '@/lib/exercise-presets'
import { searchStandardExercises } from '@/lib/standard-exercises'
import { getUserExercises } from '@/app/actions/user-exercises'
import { getLastSessionForExercises, type LastSessionForExercise } from '@/app/actions/strength-session'
import type { UserExercise } from '@/lib/user-exercise-types'
import {
  getUserMovementTypes, createUserMovementType,
  type UserMovementType, type UserMovementTypeKind,
} from '@/app/actions/user-movement-types'
import {
  resolveMovementKind, isEnduranceFor, isStrengthFor, isTurFor,
  subcategoriesFor,
} from '@/lib/movement-types'

// Innendørs-maskiner med motstand-skala 1-10. Watt + resistance_level vises;
// høydemeter skjules (gir ikke mening). Tredemølle har egen incline-felt og
// regnes ikke som motstand-maskin.
function isResistanceMachineFor(name: string, subcategory: string): boolean {
  if (name === 'SkiErg') return true
  if (name === 'Stairmaster') return true
  if (name === 'Ellipsemaskin') return true
  if (name === 'Roing' && subcategory === 'Romaskin') return true
  if (name === 'Sykling' && (
    subcategory === 'Spinning' ||
    subcategory === 'Indoors/Ergo' ||
    subcategory === 'Air bike'
  )) return true
  return false
}

// Alle innendørs-aktiviteter — inkluderer tredemølle (har incline_percent
// men ingen høydemeter). Brukes for å skjule elevation-feltene.
function isIndoorActivityFor(name: string, subcategory: string): boolean {
  if (isResistanceMachineFor(name, subcategory)) return true
  if (name === 'Løping' && subcategory === 'Tredemølle') return true
  return false
}

interface Props {
  rows: ActivityRow[]
  onChange: (rows: ActivityRow[]) => void
  sport: Sport
  // Brukerens sporter (primary + secondary). Avgjør tilgjengelighet av
  // sport-spesifikke aktivitets-typer (f.eks. skyting når brukeren har
  // biathlon i sin profil), uavhengig av økt-sporten. Default: [sport].
  userSports?: Sport[]
  // Topp 5 mest brukte aktivitetstyper siste 60 dager (server-beregnet).
  // Vises som "Mest brukt"-optgroup øverst i Aktivitetstype-dropdownen.
  activityTypeFavorites?: ActivityType[]
  // I plan-modus skjules rene måleverdier (puls, laktat, treff) — plan fokuserer
  // på intensjon (type, bevegelsesform, varighet, soner/målpuls).
  mode?: 'plan' | 'dagbok'
  // Brukerens default pace-enhet fra profiles.default_pace_unit. null = min_per_km.
  defaultPaceUnit?: PaceUnit | null
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
    max_watts: '',
    resistance_level: '',
    avg_pace_seconds_per_km: '',
    pace_unit_preference: '',
    splits_per_km: [],
    prone_shots: '',
    prone_hits: '',
    standing_shots: '',
    standing_hits: '',
    is_dry_training: false,
    elevation_gain_m: '',
    elevation_loss_m: '',
    incline_percent: '',
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
    duration: '',
    rpe: '',
    notes: '',
  }
}

const ZONE_KEYS: (keyof ActivityZoneMinutes)[] = ['I1','I2','I3','I4','I5','Hurtighet']

// Summen av alle sone-tider i sekunder. Hver verdi i z[k] er en MM:SS-streng
// (eller "60" som tolkes som 60 minutter via parseActivityDuration).
function sumZoneSeconds(z: ActivityZoneMinutes): number {
  return ZONE_KEYS.reduce((s, k) => s + (parseActivityDuration(z[k]) ?? 0), 0)
}

const ZONE_COLORS_BAR: Record<keyof ActivityZoneMinutes, string> = {
  I1: '#28A86E', I2: '#2A7AB8', I3: '#D4B500', I4: '#FF9500', I5: '#FF4500',
  Hurtighet: '#8B5CF6',
}

export function ActivitiesSection({ rows, onChange, sport, userSports, activityTypeFavorites, mode = 'dagbok', defaultPaceUnit = null }: Props) {
  const effectiveUserSports: Sport[] = userSports && userSports.length > 0 ? userSports : [sport]
  const userHasBiathlon = effectiveUserSports.includes('biathlon')
  const isPlanMode = mode === 'plan'
  // Når formen er initialisert med én default-rad (ny økt) skal den være åpen
  // for utfylling med en gang. Ekspander første rad ved mount.
  const [expandedId, setExpandedId] = useState<string | null>(() =>
    rows.length === 1 ? rows[0].id : null,
  )
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
    // kopierer type + bevegelsesform + underkategori fra forrige (så serier av
    // like økter blir raske). Bruker kan endre underkategori manuelt etterpå.
    const type: ActivityType = last ? last.activity_type : 'aktivitet'
    const movement = last ? last.movement_name : defaultMovementForSport(sport)
    const newRow = emptyRow(type, movement)
    if (last) newRow.movement_subcategory = last.movement_subcategory
    onChange([...rows, newRow])
    // Nye rader åpnes ekspandert så brukeren kan fylle inn umiddelbart.
    setExpandedId(newRow.id)
  }

  // Legger til en skyte-rad uavhengig av eksisterende aktiviteter eller
  // bevegelsesformer. Plasseres sist; brukeren flytter den til riktig
  // kronologisk plass via opp/ned-pilene.
  const addShootingRow = () => {
    const newRow = emptyRow('skyting_kombinert', '')
    onChange([...rows, newRow])
    setExpandedId(newRow.id)
  }

  // Skyte-typer er tilgjengelig når brukeren har biathlon i sine sporter
  // (primær eller sekundær), uansett hvilken sport selve økta føres som.
  // Dette gjør at f.eks. en langrenns-langtur eller styrkeøkt kan inneholde
  // basisskyting/tørrtrening som egen rad.
  const typeOptions = ACTIVITY_TYPES.filter(t => !t.biathlonOnly || userHasBiathlon)

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
          favoriteTypes={activityTypeFavorites ?? []}
          sport={sport}
          isPlanMode={isPlanMode}
          userMovementTypes={userMovementTypes}
          onRequestCreateMovement={() => setCreateModalRowId(row.id)}
          defaultPaceUnit={defaultPaceUnit}
        />
      ))}

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={addRow}
          className="px-4 py-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#FF4500',
            background: 'none',
            border: '1px dashed #FF4500',
            cursor: 'pointer',
            flex: 1,
          }}
        >
          + Legg til aktivitet
        </button>
        {userHasBiathlon && (
          <button
            type="button"
            onClick={addShootingRow}
            className="px-4 py-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#FF4500',
              background: 'none',
              border: '1px dashed #FF4500',
              cursor: 'pointer',
              flex: 1,
            }}
          >
            🎯 + Legg til skyting
          </button>
        )}
      </div>

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
  typeOptions, favoriteTypes, sport, isPlanMode, userMovementTypes, onRequestCreateMovement,
  defaultPaceUnit,
}: {
  row: ActivityRow
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<ActivityRow>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  typeOptions: typeof ACTIVITY_TYPES
  // Topp 5 mest brukte aktivitetstyper siste 60 dager. Filtreres mot
  // typeOptions før render (skjuler favoritter som ikke er tilgjengelige
  // for brukerens sport-profil).
  favoriteTypes: ActivityType[]
  sport: Sport
  isPlanMode: boolean
  userMovementTypes: UserMovementType[]
  onRequestCreateMovement: () => void
  defaultPaceUnit: PaceUnit | null
}) {
  // Beregn hvilke favoritter som er tilgjengelige for denne brukeren
  // (typeOptions er allerede filtrert på userSports). Skjul Mest brukt-
  // optgruppen helt hvis ingen treff — én entry-favoritt er ikke verdt
  // visuell støy.
  const availableTypeValues = new Set(typeOptions.map(t => t.value))
  const visibleFavorites = favoriteTypes.filter(v => availableTypeValues.has(v))
  const showFavoritesGroup = visibleFavorites.length >= 2
  const meta = findActivityType(row.activity_type)
  const durSec = parseActivityDuration(row.duration)
  const durDisplay = durSec != null ? formatActivityDuration(durSec) : row.duration || '—'
  const kind = resolveMovementKind(row.movement_name, userMovementTypes)
  const isStrength = isStrengthFor(row.movement_name, userMovementTypes)
  const isEndurance = isEnduranceFor(row.movement_name, userMovementTypes)
  const isTur = isTurFor(row.movement_name, userMovementTypes)
  const isAnnet = kind === 'annet'
  const isCycling = sport === 'cycling' || row.movement_name === 'Sykling'
  const isResistanceMachine = isResistanceMachineFor(row.movement_name, row.movement_subcategory)
  const isIndoorActivity = isIndoorActivityFor(row.movement_name, row.movement_subcategory)
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
    // Resistance er bevegelses- + subkategori-styrt. Etter movement-change er
    // subcategory tom (settes på linje over via patch.movement_subcategory='').
    // Sjekk om navnet alene fortsatt kvalifiserer (SkiErg/Stairmaster/Ellipsemaskin
    // har subcategory=null/'' så de fortsatt regnes som resistance) — hvis ikke,
    // null resistance.
    if (!isResistanceMachineFor(name, '')) {
      patch.resistance_level = ''
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
    // Når brukeren bytter til en sub som ikke lenger er resistance-maskin
    // (f.eks. Sykling: Spinning → Landevei), null resistance_level.
    if (!isResistanceMachineFor(row.movement_name, sub)) {
      patch.resistance_level = ''
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
              color: onMoveUp ? '#8A8A96' : '#2A2A30', fontSize: '13px', lineHeight: 1,
            }}>▲</button>
          <button type="button" onClick={onMoveDown} disabled={!onMoveDown} aria-label="Flytt ned"
            style={{
              background: 'none', border: 'none', padding: '2px 0', cursor: onMoveDown ? 'pointer' : 'default',
              color: onMoveDown ? '#8A8A96' : '#2A2A30', fontSize: '13px', lineHeight: 1,
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
          {/* 2 kolonner på mobil (kortere liste enn én lang kolonne), 3 fra lg
              (1024px) som på desktop. Field har minWidth:0 og inputene width:100%
              + boxSizing:border-box, så de krymper innenfor cellen uten å kuttes. */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            <Field label="Aktivitetstype">
              <select value={row.activity_type}
                onChange={e => onUpdate({ activity_type: e.target.value as ActivityType })}
                style={iSt}>
                {showFavoritesGroup && (
                  <optgroup label="Mest brukt">
                    {visibleFavorites.map(v => {
                      const opt = typeOptions.find(t => t.value === v)
                      if (!opt) return null
                      return (
                        <option key={`fav-${v}`} value={v}>{opt.icon}  {opt.label}</option>
                      )
                    })}
                  </optgroup>
                )}
                {showFavoritesGroup ? (
                  <optgroup label="Alle">
                    {typeOptions.map(t => (
                      <option key={t.value} value={t.value}>{t.icon}  {t.label}</option>
                    ))}
                  </optgroup>
                ) : (
                  typeOptions.map(t => (
                    <option key={t.value} value={t.value}>{t.icon}  {t.label}</option>
                  ))
                )}
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

            {row.movement_name === 'Løping' && row.movement_subcategory === 'Tredemølle' && (
              <Field label="Stigning (%)">
                <input value={row.incline_percent}
                  onChange={e => onUpdate({ incline_percent: e.target.value })}
                  placeholder="0.0"
                  inputMode="decimal"
                  style={iSt} />
              </Field>
            )}

            {/* Høydemeter — utholdenhet + tur. Skjules for innendørs-aktiviteter
                (SkiErg, Romaskin, Stairmaster, Ellipsemaskin, Spinning,
                Indoors/Ergo, Air bike, Tredemølle) der høydemeter ikke er meningsfullt. */}
            {(isEndurance || isTur) && !isIndoorActivity && (
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

                {/* Watt (snitt + maks) — sykling, motstands-maskiner OG utholdenhets-
                    former (SkiErg, Ellipsemaskin, Roing osv. har watt-måling).
                    Valgfritt, så det skader ikke å tilby det for løp/ski også. */}
                {(isCycling || isResistanceMachine || isEndurance) && !meta?.isShooting && !isStrength && !isAnnet && (
                  <>
                    <Field label="Snittwatt">
                      <input value={row.avg_watts}
                        onChange={e => onUpdate({ avg_watts: e.target.value })}
                        inputMode="numeric" placeholder="—"
                        style={iSt} />
                    </Field>
                    <Field label="Makswatt">
                      <input value={row.max_watts}
                        onChange={e => onUpdate({ max_watts: e.target.value })}
                        inputMode="numeric" placeholder="—"
                        style={iSt} />
                    </Field>
                  </>
                )}

                {/* Motstand 1-10 — kun for innendørs-maskiner med motstand-skala
                    (SkiErg, Romaskin, Stairmaster, Ellipsemaskin, Spinning,
                    Indoors/Ergo, Air bike). Tredemølle har incline_percent. */}
                {isResistanceMachine && (
                  <Field label="Motstand (1-10)">
                    <select value={row.resistance_level}
                      onChange={e => onUpdate({ resistance_level: e.target.value })}
                      style={iSt}>
                      <option value="">—</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}
          </div>

          {/* Pace per km — utholdenhet + tur. Brukeren ser min/km eller km/t
              (lokal toggle), kanonisk lagring er sekunder per km. Auto-forslag
              fra distanse + varighet vises når feltet er tomt. */}
          {(isEndurance || isTur) && !meta?.isShooting && !isAnnet && (
            <PaceField row={row} onUpdate={onUpdate} defaultPaceUnit={defaultPaceUnit} />
          )}

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
                const totalSec = sumZoneSeconds(z)
                // Når soner summerer > 0, synk totaltid (MM:SS). Tomme soner → la manuell varighet stå.
                const patch: Partial<ActivityRow> = { zones: z }
                if (totalSec > 0) patch.duration = formatActivityDuration(totalSec)
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
  const totalSec = sumZoneSeconds(zones)
  return (
    <div className="mt-3 p-3" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Sonefordeling
        </span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '15px', letterSpacing: '0.05em' }}>
          Σ {formatActivityDuration(totalSec) || '0:00'}
        </span>
      </div>

      {/* Color bar — 6 segmenter når Hurtighet > 0, ellers 5 */}
      <div className="flex mb-2" style={{ height: '6px', border: '1px solid #1E1E22' }}>
        {keys.map(k => {
          const sec = parseActivityDuration(zones[k]) ?? 0
          const w = totalSec > 0 ? (sec / totalSec) * 100 : 0
          return w > 0 ? (
            <div key={k} style={{ width: `${w}%`, backgroundColor: ZONE_COLORS_BAR[k] }} />
          ) : null
        })}
        {totalSec === 0 && <div style={{ flex: 1, backgroundColor: '#1A1A1E' }} />}
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
              inputMode="text" placeholder="MM:SS"
              style={{ ...iSt, textAlign: 'center' }} />
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Skriv "60" for 60 minutter, eller "1:30" for 1 min 30 sek. Hurtighet føres manuelt — beregnes ikke fra puls.
      </p>
    </div>
  )
}

// ── Styrke ─────────────────────────────────────────────────
// Autocomplete henter brukerens personlige øvelsesbibliotek (last_used_at desc)
// ved mount og slår sammen med preset-forslag basert på valgt underkategori.
// Quick-add-knappene over "+ Legg til øvelse" hopper rett til en ny rad med navnet
// forhåndsutfylt.

// «for X dager siden» fra en YYYY-MM-DD-dato.
function daysAgoLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return 'i dag'
  if (diff === 1) return 'i går'
  if (diff < 7) return `for ${diff} dager siden`
  if (diff < 14) return 'for 1 uke siden'
  if (diff < 60) return `for ${Math.round(diff / 7)} uker siden`
  return `for ${Math.round(diff / 30)} mnd siden`
}

// Kompakt sammendrag av forrige økts sett, f.eks. «4×5 @ 82.5 kg» når uniformt,
// ellers «4 sett · 5/5/3 @ 82.5».
function summarizeLastSession(ls: LastSessionForExercise): string {
  const sets = ls.sets
  if (sets.length === 0) return '—'
  const w = sets[0].weight_kg
  const allSameW = sets.every(s => s.weight_kg === w)
  const r = sets[0].reps
  const allSameR = sets.every(s => s.reps === r)
  const wPart = w != null ? ` @ ${w} kg` : ''
  if (allSameR && r != null) return `${sets.length}×${r}${allSameW ? wPart : ''}`
  const reps = sets.map(s => s.reps ?? '–').join('/')
  return `${sets.length} sett · ${reps}${allSameW ? wPart : ''}`
}

function StrengthEditor({
  exercises, onChange, category,
}: {
  exercises: StrengthExerciseRow[]
  onChange: (ex: StrengthExerciseRow[]) => void
  category: string
}) {
  const [library, setLibrary] = useState<UserExercise[]>([])
  // Forrige-økt per øvelsesnavn (lower). null = hentet, ingen historikk.
  const [lastByName, setLastByName] = useState<Record<string, LastSessionForExercise | null>>({})

  useEffect(() => {
    let cancelled = false
    getUserExercises().then(data => {
      if (!cancelled) setLibrary(data)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Hent forrige-økt for øvelser vi ikke har slått opp ennå (debounced).
  const exerciseNames = useMemo(
    () => exercises.map(e => e.exercise_name.trim()).filter(Boolean),
    [exercises],
  )
  useEffect(() => {
    const missing = exerciseNames.filter(n => !(n.toLowerCase() in lastByName))
    if (missing.length === 0) return
    const t = setTimeout(() => {
      getLastSessionForExercises(missing).then(map => {
        setLastByName(prev => {
          const next = { ...prev }
          for (const n of missing) {
            const k = n.toLowerCase()
            next[k] = map[k] ?? null
          }
          return next
        })
      }).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [exerciseNames, lastByName])

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
    <div className="mt-3 p-3" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
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
            lastSession={ex.exercise_name.trim() ? (lastByName[ex.exercise_name.trim().toLowerCase()] ?? null) : null}
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
  exercise, onUpdate, onDelete, library, presets, libraryNames, lastSession,
}: {
  exercise: StrengthExerciseRow
  onUpdate: (patch: Partial<StrengthExerciseRow>) => void
  onDelete: () => void
  library: UserExercise[]
  presets: string[]
  libraryNames: Set<string>
  lastSession: LastSessionForExercise | null
}) {
  const updateSet = (id: string, patch: Partial<StrengthSetRow>) =>
    onUpdate({ sets: exercise.sets.map(s => s.id === id ? { ...s, ...patch } : s) })

  // «Gjenta forrige»: fyll alle sett med forrige økts verdier på ett tap.
  const repeatLast = () => {
    if (!lastSession || lastSession.sets.length === 0) return
    onUpdate({
      sets: lastSession.sets.map((s, i) => ({
        ...emptySet(i + 1),
        reps: s.reps != null ? String(s.reps) : '',
        weight_kg: s.weight_kg != null ? String(s.weight_kg) : '',
        duration: s.duration_seconds != null ? String(s.duration_seconds) : '',
        rpe: s.rpe != null ? String(s.rpe) : '',
      })),
    })
  }
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

      {/* Forrige-økt-hint på samme øvelse (nøkles på navn, kontekst-uavhengig)
          + «Gjenta forrige» som fyller alle sett med forrige verdier på ett tap. */}
      {lastSession && (
        <div className="flex items-center gap-2 flex-wrap mb-2" style={{ marginTop: '-2px' }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#6E6E78', fontSize: '12px', fontStyle: 'italic' }}>
            Sist: {summarizeLastSession(lastSession)} ({daysAgoLabel(lastSession.date)})
          </span>
          <button type="button" onClick={repeatLast}
            className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', background: 'none', border: '1px solid #3A2418', padding: '2px 8px', cursor: 'pointer' }}>
            ↺ Gjenta forrige
          </button>
        </div>
      )}

      {/* Set rows — Tid-kolonnen er for isometriske hold (planke, statisk
          muskeldraining). Bruker kan fylle reps/kg/tid uavhengig. */}
      <div className="space-y-1.5">
        <div className="grid gap-2 px-1 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
            gridTemplateColumns: '36px 1fr 1fr 1fr 60px 22px',
          }}>
          <span>Sett</span>
          <span>Reps</span>
          <span>Vekt (kg)</span>
          <span>Tid (s/m:ss)</span>
          <span>RPE</span>
          <span></span>
        </div>
        {exercise.sets.map(s => (
          <div key={s.id} className="grid gap-2 items-center"
            style={{ gridTemplateColumns: '36px 1fr 1fr 1fr 60px 22px' }}>
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
            <input value={s.duration}
              onChange={e => updateSet(s.id, { duration: e.target.value })}
              inputMode="numeric" placeholder="—"
              title="Sekunder (90) eller MM:SS (1:30)"
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
  | { kind: 'standard'; name: string; category: string }

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

    // Standardbiblioteket søkes kun når man har skrevet noe — ekskluder navn
    // som allerede vises fra eget bibliotek eller kategoriforslag.
    const shown = new Set<string>([
      ...libMatches.map(s => s.name.toLowerCase()),
      ...presetMatches.map(s => s.name.toLowerCase()),
    ])
    const standardMatches = q
      ? searchStandardExercises(q, shown, 8)
          .map<SuggestionItem>(ex => ({ kind: 'standard', name: ex.name, category: ex.category }))
      : []

    return [...libMatches, ...presetMatches, ...standardMatches]
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
          backgroundColor: '#1A1A22', border: '1px solid #262629',
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
                fontSize: '13px', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {s.kind === 'library'
                  ? `brukt ${s.item.times_used}×`
                  : s.kind === 'standard'
                    ? 'bibliotek'
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
    <div className="mt-3 p-3" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
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
    <div className="mt-3 p-3" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
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
    <div className="mt-3 p-3" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {heading}
          {!planMode && !row.is_dry_training && (
            <span style={{ marginLeft: 8, color: '#8A8A96', textTransform: 'none', letterSpacing: 0 }}>
              · Treff er valgfritt
            </span>
          )}
          {row.is_dry_training && (
            <span style={{ marginLeft: 8, color: '#FF8C00', textTransform: 'none', letterSpacing: 0 }}>
              · Uten skarp ammunisjon
            </span>
          )}
        </div>
        {/* Tørrtrening — ortogonalt til posisjon. Kan slås på selv for konkurranse-/
            kombinert-typer; brukes til å skille tørr-skyting fra skarp ammunisjon i
            analyse. Når aktiv: skjules skudd/treff-felt og kun varighet + posisjon
            beholdes (varighet ligger på selve aktivitets-raden). */}
        <button
          type="button"
          onClick={() => onUpdate({ is_dry_training: !row.is_dry_training })}
          className="px-2 py-1 text-xs tracking-widest uppercase transition-colors"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: row.is_dry_training ? 'rgba(255,140,0,0.18)' : 'transparent',
            color: row.is_dry_training ? '#FF8C00' : '#555560',
            border: `1px solid ${row.is_dry_training ? '#FF8C00' : '#222228'}`,
            cursor: 'pointer',
          }}
          aria-pressed={row.is_dry_training}
        >
          {row.is_dry_training ? '✓ Tørrtrening' : 'Tørrtrening'}
        </button>
      </div>
      {row.is_dry_training ? (
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Tørrtrening — registrér kun varighet og posisjon. Skudd/treff-statistikk hoppes over for denne raden.
        </p>
      ) : (
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
      )}
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
  // minWidth:0 lar grid-cellen krympe under innholdets min-content (default er
  // auto) — nødvendig for at 2-kolonners mobil-layout ikke skal sprenge bredden.
  return (
    <div style={{ minWidth: 0 }}>
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
  backgroundColor: '#1A1A22',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  minWidth: 0,
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
          backgroundColor: '#13131A', border: '1px solid #262629',
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

// ── Pace per km ─────────────────────────────────────────────
//
// Eier av canonical-verdien (sekunder per km) er ActivityRow.avg_pace_seconds_per_km.
// Vi lagrer som strenger i form-radens felt for konsistens med øvrige tall-felt;
// parsing/visning skjer via helpers i lib/pace-utils.ts.
//
// Visningsenhet: rader uten preferanse arver brukerens default. Når bruker
// endrer toggle på radnivå skrives det til pace_unit_preference. Dette gjør at
// to radtyper (f.eks. løpetur i min/km og sykkeløkt i km/t) kan sameksistere.

function PaceField({
  row, onUpdate, defaultPaceUnit,
}: {
  row: ActivityRow
  onUpdate: (patch: Partial<ActivityRow>) => void
  defaultPaceUnit: PaceUnit | null
}) {
  const unit = resolvePaceUnit(row.pace_unit_preference, defaultPaceUnit)

  // Auto-forslag: distance × duration → s/km. Tomme felt ⇒ ingen forslag.
  const km = parseFloat(row.distance_km)
  const durSec = parseActivityDuration(row.duration) ?? 0
  const computed = paceFromDistanceDuration(km, durSec)
  const computedRounded = computed != null ? Math.round(computed) : null

  const currentSeconds = (() => {
    const v = parseInt(row.avg_pace_seconds_per_km)
    return Number.isFinite(v) && v > 0 ? v : null
  })()

  return (
    <div className="mt-3 p-3" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <PaceInput
        value={currentSeconds}
        onChange={next => onUpdate({
          avg_pace_seconds_per_km: next != null ? String(next) : '',
        })}
        unit={unit}
        onUnitChange={u => onUpdate({ pace_unit_preference: u })}
        computedSuggestion={computedRounded}
        onAcceptSuggestion={() => {
          if (computedRounded != null) {
            onUpdate({ avg_pace_seconds_per_km: String(computedRounded) })
          }
        }}
      />

      <div className="mt-3">
        <SplitsTable
          splits={row.splits_per_km}
          onChange={s => onUpdate({ splits_per_km: s })}
          unit={unit}
        />
      </div>
    </div>
  )
}
