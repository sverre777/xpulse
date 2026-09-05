'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AktivitetKnapperad } from './AktivitetKnapperad'
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { fmtKlokkeSek } from '@/lib/segmenter'
import { SamletBryter } from './SamletBryter'
import { nyAktivitetsrad } from '@/lib/aktivitetsrad'
import { sikreKlokkerundeBackup } from '@/app/actions/runder'
import {
  grupperRaderSamlet, skrivTilGruppe, lesVisning, huskVisning, standardVisning, monsterTekst, erSkytingGruppe, skytingGruppeType, skuddSum, fmtSoneFordeling,
  type Visning, type RadGruppe, type GruppeFelt,
} from '@/lib/samlet-visning'
import { SerieListe } from './SerieListe'
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
import { StandardExerciseBrowser } from '@/components/workout/StandardExerciseBrowser'
import { shootingSummary, SHOOTING_TYPES_V2 } from '@/lib/shooting'
import { STANDARD_SHOOTING_TESTS, findStandardTest, expandTestSeries } from '@/lib/shooting-test-templates'
import { listMyShootingTests, saveMyShootingTest, type OwnShootingTest } from '@/app/actions/shooting-tests'
import { xpConfirm } from '@/components/ui/ConfirmDialog'
import type { ShootingSeriesRow } from '@/lib/types'
import { getUserExercises } from '@/app/actions/user-exercises'
import { getLastSessionForExercises, type LastSessionForExercise } from '@/app/actions/strength-session'
import type { UserExercise } from '@/lib/user-exercise-types'
import {
  getUserMovementTypes, createUserMovementType,
  type UserMovementType, type UserMovementTypeKind,
} from '@/app/actions/user-movement-types'
import { parseDecimal } from '@/lib/parse-decimal'
import { UtstyrVelgerPopup } from '@/components/equipment/UtstyrVelgerPopup'
import type { Equipment } from '@/lib/equipment-types'
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
  // Felles knapperad (fasit): ⚡ Øktbygger står alltid; 🎯 Plott treff
  // gjelder kun dagbok — betingelsene ligger i AktivitetKnapperad.
  onOktbygger?: () => void
  onPlottTreff?: () => void
  // Trener-redigering: sonespråket skal være UTØVERENS (fase 111).
  targetUserId?: string
  // Samlet/splittet (bolk 4): huskes per økt; klokkerader samles aldri
  // for alvor. radInfo = proveniens per rad-id fra serveren.
  workoutId?: string | null
  radInfo?: Record<string, { harKlokkeProveniens: boolean }>
  erKlokkeokt?: boolean
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
  // Kø #47: øktas workout_type — driver auto-markeringene 🏁/⏱ på skyteblokker.
  workoutType?: string
  // Utstyr bolk 4: ⇄ per aktivitetsrad — bytte av utstyr KUN der man faktisk
  // byttet (hele økta-arven settes i «Utstyr brukt»-seksjonen). Keyet på
  // ActivityRow.id. Uten disse propene vises ingen ⇄ (trener/plan-mal).
  availableEquipment?: Equipment[]
  activityEquipment?: Record<string, string[]>
  onActivityEquipmentChange?: (rowId: string, ids: string[]) => void
}

function defaultMovementForSport(sport: Sport): string {
  return DEFAULT_MOVEMENTS_BY_SPORT[sport]?.[0] ?? 'Løping'
}

const emptyRow = nyAktivitetsrad

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

// ALLE bøttene (summer/kollaps-visning). Hvilke soner som TILBYS i
// editoren styres av utøverens sonespråk (lib/sonesprak, fase 111).
const ZONE_KEYS: (keyof ActivityZoneMinutes)[] = ['I1','I2','I3','I4','I5','I6','I7','I8','Hurtighet']

// Summen av alle sone-tider i sekunder. Hver verdi i z[k] er en MM:SS-streng
// (eller "60" som tolkes som 60 minutter via parseActivityDuration).
function sumZoneSeconds(z: ActivityZoneMinutes): number {
  // Eldre rader (DB/snapshot) mangler I6–I8-nøklene — null-trygt.
  return ZONE_KEYS.reduce((s, k) => s + (parseActivityDuration(z[k] ?? '') ?? 0), 0)
}

// Sonefarger: ÉN fasit i lib/activity-summary.ts (ZONE_COLORS_V2).
// Ikke gjenta hexene her — I1 grønn, I2 blå, alltid.
import { ZONE_COLORS_V2 as ZONE_COLORS_BAR } from '@/lib/activity-summary'
import { foringsSoner } from '@/lib/sonesprak'
import { hentUtvidetSkalaCached } from '@/lib/sonesprak-klient'

export function ActivitiesSection({ rows, onChange, sport, userSports, activityTypeFavorites, mode = 'dagbok', defaultPaceUnit = null, workoutType, availableEquipment, activityEquipment, onActivityEquipmentChange, targetUserId, onOktbygger, onPlottTreff, workoutId = null, radInfo = {}, erKlokkeokt = false }: Props) {
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
  // SAMLET / SPLITTET — ren visning, huskes per økt. Leses etter montering
  // (serveren vet ikke hva som er husket), som tema og vis-plan.
  const [visning, setVisning] = useState<Visning>(() => standardVisning(erKlokkeokt))
  const [visningLest, setVisningLest] = useState<string | null>(null)
  if (visningLest !== (workoutId ?? '')) {
    setVisningLest(workoutId ?? '')
    setVisning(lesVisning(workoutId) ?? standardVisning(erKlokkeokt))
  }
  const velgVisning = (v: Visning) => { setVisning(v); huskVisning(workoutId, v) }
  // Ren visning: grupperingen leser radene, endrer aldri en av dem.
  const grupper = grupperRaderSamlet(rows)

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
        pack_weight_kg: created.type === 'tur' || created.type === 'utholdenhet' ? r.pack_weight_kg : '',
        sled_weight_kg: created.type === 'tur' ? r.sled_weight_kg : '',
        weather: created.type === 'tur' ? r.weather : '',
        temperature_c: created.type === 'tur' ? r.temperature_c : '',
      } : r))
    }
    setCreateModalRowId(null)
  }

  // Rettelse 6: første endring av en KLOKKERAD tar vare på klokkas runder
  // (runde_backup) — rundetabellen viser alltid originalen. Idempotent.
  const kopiSikret = useRef(false)
  const sikreKopiFor = (id: string) => {
    const r = rows.find(x => x.id === id)
    if (!workoutId || !r?.db_id || !radInfo[r.db_id]?.harKlokkeProveniens || kopiSikret.current) return
    kopiSikret.current = true
    void sikreKlokkerundeBackup(workoutId)
  }
  const updateRow = (id: string, patch: Partial<ActivityRow>) => {
    sikreKopiFor(id)
    onChange(rows.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const deleteRow = (id: string) => {
    sikreKopiFor(id)
    onChange(rows.filter(r => r.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // Pkt 18 (Sverre 4. sep): flytting endrer rekkefølgen; på klokkeøkter
  // regnes starten på nytt så KJEDEN holdes (rad n starter der rad n−1
  // slutter). Skyting er et vindu på pulsen og beholder sitt eget vindu.
  const omregnKjede = (liste: ActivityRow[]): ActivityRow[] => {
    if (!liste.some(r => r.window_start_seconds != null && !r.activity_type.startsWith('skyting'))) return liste
    let t = 0
    return liste.map(r => {
      if (r.activity_type.startsWith('skyting')) return r
      const varighet = r.window_duration_seconds ?? parseActivityDuration(r.duration) ?? 0
      const ny = { ...r, window_start_seconds: t, window_duration_seconds: r.window_duration_seconds ?? (varighet > 0 ? varighet : null) }
      t += varighet
      return ny
    })
  }
  const moveRow = (id: string, dir: -1 | 1) => {
    sikreKopiFor(id)
    const i = rows.findIndex(r => r.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= rows.length) return
    onChange(omregnKjede(arrayMove(rows, i, j)))
  }
  // Dra-og-slipp (dnd-kit som i kalenderen, regel 18): mus etter 8 px,
  // langt trykk (250 ms) på mobil. Tastatur: gripepanelet + piltast.
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    const fra = rows.findIndex(r => r.id === e.active.id)
    const til = e.over ? rows.findIndex(r => r.id === e.over!.id) : -1
    if (fra < 0 || til < 0 || fra === til) return
    sikreKopiFor(String(e.active.id))
    onChange(omregnKjede(arrayMove(rows, fra, til)))
  }

  const addRow = () => {
    // SF-18: knappen sier «aktivitet» og skal ALDRI gi en skytetype. Arven
    // tas fra siste rad som IKKE er skyting — type, bevegelsesform OG
    // underkategori fra samme rad (så serier av like rader blir raske).
    // Finnes ingen slik rad: hovedaktivitet med sportens hovedbevegelsesform.
    // Samme sti i plan og dagbok — komponenten er den samme.
    const kilde = [...rows].reverse().find(r => !(r.activity_type ?? '').startsWith('skyting'))
    const type: ActivityType = kilde ? kilde.activity_type : 'aktivitet'
    const movement = kilde ? kilde.movement_name : defaultMovementForSport(sport)
    const newRow = emptyRow(type, movement)
    if (kilde) newRow.movement_subcategory = kilde.movement_subcategory
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
  // Kø #47: kun ÉN «Skyting» i velgeren — legacy-variantene (posisjon/art)
  // skjules, men gamle rader beholder verdi + label (egen option under).
  const typeOptions = ACTIVITY_TYPES.filter(t => (!t.biathlonOnly || userHasBiathlon) && !t.legacy)

  const harSkyting = rows.some(r => (r.activity_type ?? '').startsWith('skyting'))

  return (
    <div className="space-y-2">
      {/* Felles knapperad (regel 11) — over radene, i plan OG dagbok.
          Var tidligere to knapper nederst; fasiten flytter dem hit og
          legger 🎯/⌚-inngangene i samme rad. */}
      <AktivitetKnapperad
        isPlanMode={isPlanMode}
        harSkyting={harSkyting}
        userHasBiathlon={userHasBiathlon}
        onPlottTreff={onPlottTreff}
        onOktbygger={onOktbygger}
        onLeggTilAktivitet={addRow}
        onLeggTilSkyting={addShootingRow}
      />
      {rows.length === 0 && (
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          Ingen aktiviteter ennå. Legg til en for å logge bevegelse, pause eller skyting.
        </p>
      )}

      {rows.length > 1 && (
        <SamletBryter visning={visning} onVisning={velgVisning} />
      )}

      <div className="xp-tl">
      {visning === 'samlet' && grupper.some(g => g.rader.length > 1) ? grupper.map(g => (
        g.rader.length === 1 ? (
          <ActivityRowItem
            targetUserId={targetUserId}
            key={g.rader[0].id}
            row={g.rader[0]}
            expanded={expandedId === g.rader[0].id}
            onToggle={() => setExpandedId(expandedId === g.rader[0].id ? null : g.rader[0].id)}
            onUpdate={patch => updateRow(g.rader[0].id, patch)}
            onDelete={() => deleteRow(g.rader[0].id)}
            onMoveUp={g.fra > 0 ? () => moveRow(g.rader[0].id, -1) : undefined}
            onMoveDown={g.til < rows.length - 1 ? () => moveRow(g.rader[0].id, 1) : undefined}
            typeOptions={typeOptions}
            favoriteTypes={activityTypeFavorites ?? []}
            sport={sport}
            isPlanMode={isPlanMode}
            userMovementTypes={userMovementTypes}
            onRequestCreateMovement={() => setCreateModalRowId(g.rader[0].id)}
            defaultPaceUnit={defaultPaceUnit}
            workoutType={workoutType}
            equipment={availableEquipment}
            equipmentIds={activityEquipment?.[g.rader[0].id] ?? []}
            onEquipmentChange={onActivityEquipmentChange ? ids => onActivityEquipmentChange(g.rader[0].id, ids) : undefined}
          />
        ) : (
          <GruppeRadItem
            key={g.id}
            gruppe={g}
            expanded={expandedId === g.id}
            onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
            onUpdate={patch => onChange(skrivTilGruppe(rows, g, patch))}
            onUpdateRad={(id, patch) => updateRow(id, patch)}
            userMovementTypes={userMovementTypes}
            onSplitt={() => velgVisning('splittet')}
            isPlanMode={isPlanMode}
            workoutType={workoutType}
          />
        )
      )) : (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
            {rows.map((row, idx) => (
              <SorterbarRad key={row.id} id={row.id}>
                {grip => (
                  <ActivityRowItem
                    targetUserId={targetUserId}
                    row={row}
                    dragRef={grip.dragRef} dragListeners={grip.dragListeners} dragAttributes={grip.dragAttributes} dragging={grip.dragging}
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
                    workoutType={workoutType}
                    equipment={availableEquipment}
                    equipmentIds={activityEquipment?.[row.id] ?? []}
                    onEquipmentChange={onActivityEquipmentChange ? ids => onActivityEquipmentChange(row.id, ids) : undefined}
                  />
                )}
              </SorterbarRad>
            ))}
          </SortableContext>
        </DndContext>
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

/** Gripepanelets bindinger (dnd-kit) — som separate felt, slik kalenderens
    chip gjør det (react-compiler-linten leser et samlet objekt som en ref). */
export interface RadGrip {
  dragRef: (el: HTMLElement | null) => void
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
  dragging: boolean
}

// ── Sorterbar rad (pkt 18): dnd-kit sortable rundt hver rad i splittet.
// Wrapperen bærer transform/transition, raden får gripepanelet.
function SorterbarRad({ id, children }: { id: string; children: (grip: RadGrip) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} data-sorterbar-rad={id} data-drar={isDragging || undefined}
      style={{ transform: DndCSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, position: 'relative', zIndex: isDragging ? 5 : undefined }}>
      {children({ dragRef: setActivatorNodeRef, dragListeners: listeners as Record<string, unknown> | undefined, dragAttributes: attributes as unknown as Record<string, unknown>, dragging: isDragging })}
    </div>
  )
}

// ── Gruppe-rad (SAMLET) — flere like rader vist som én. Bev.form og
// underkategori settes på gruppa og skrives til HVER rad; type og sone
// endres per rad i splittet. Sonene vises som FORDELING, aldri én sone.
// Et intervallsett (gruppe_id) leses som mønster: «8 × 4 min I3 · 2 min
// pause». Ingen datamutasjon ved visning.
function GruppeRadItem({ gruppe, expanded, onToggle, onUpdate, onUpdateRad, userMovementTypes, onSplitt, isPlanMode, workoutType }: {
  gruppe: RadGruppe
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<Pick<ActivityRow, GruppeFelt>>) => void
  /** Per-rad-skriving — skytegruppa redigerer skudd m.m. per serie. */
  onUpdateRad: (id: string, patch: Partial<ActivityRow>) => void
  userMovementTypes: UserMovementType[]
  onSplitt: () => void
  isPlanMode: boolean
  workoutType?: string
}) {
  const forste = gruppe.rader[0]
  const meta = findActivityType(forste.activity_type)
  // SKYTEGRUPPE (Sverre 4. sep): samlet per skytetype, og skudd og alt
  // annet redigeres per serie rett her — som i splittet.
  if (erSkytingGruppe(gruppe)) {
    const typeNokkel = skytingGruppeType(gruppe)
    const typeInfo = SHOOTING_TYPES_V2.find(t => t.key === typeNokkel)
    const { skudd, treff } = skuddSum(gruppe)
    const n = gruppe.rader.length
    return (
      <div className="xp-act" data-gruppe-rad data-skyting={typeNokkel || 'uten-type'} data-antall={n}>
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 px-3 py-2 cursor-pointer"
          onClick={onToggle} style={{ userSelect: 'none' }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11,
            letterSpacing: '0.1em', color: typeInfo?.color ?? 'var(--accent)', border: `1px solid ${typeInfo?.color ?? 'var(--accent)'}`,
            borderRadius: 999, padding: '1px 7px', marginLeft: 24,
          }}>
            {n} ×
          </span>
          <span style={{ fontSize: '14px' }}>🎯</span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px', fontWeight: 600 }}>
            {typeInfo?.label ?? 'Skyting'}
          </span>
          {skudd > 0 && (
            <span data-skudd-sum style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '12.5px', letterSpacing: '0.04em' }}>
              · {treff}/{skudd} treff
            </span>
          )}
          <div className="flex-1" style={{ minWidth: '4px' }} />
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '15px', letterSpacing: '0.05em' }}>
            {formatActivityDuration(gruppe.sumSek)}
          </span>
          <span style={{ color: 'var(--tekst-8-app)', fontSize: '12px', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', marginLeft: '4px' }}>
            ›
          </span>
        </div>
        {expanded && (
          <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--kant-5)' }}>
            {gruppe.rader.map((rad, i) => {
              const radMeta = findActivityType(rad.activity_type)
              return (
                <div key={rad.id} data-skyting-serie={rad.id} className="mt-3" style={{ border: '1px solid var(--kant-5)', borderRadius: 10, padding: '8px 10px' }}>
                  <div className="flex items-center gap-2 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-5-app)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    <span style={{ color: 'var(--tekst-1-app)', fontWeight: 700 }}>Serie {i + 1}</span>
                    <span>· {radMeta?.label ?? rad.activity_type}</span>
                    {rad.window_start_seconds != null && <span>· ved {fmtKlokkeSek(rad.window_start_seconds)}</span>}
                    {rad.duration && <span>· {rad.duration}</span>}
                  </div>
                  <ShootingFields row={rad} onUpdate={patch => onUpdateRad(rad.id, patch)} planMode={isPlanMode} workoutType={workoutType} />
                </div>
              )
            })}
            <p className="mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-app)' }}>
              {n} serier av samme skytetype. Type, tid og puls per rad:{' '}
              <button type="button" onClick={e => { e.stopPropagation(); onSplitt() }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit' }}>
                vis splittet
              </button>
            </p>
          </div>
        )}
      </div>
    )
  }
  const isStrength = isStrengthFor(forste.movement_name, userMovementTypes)
  const subcatOptions = isStrength && !userMovementTypes.some(u => u.name === forste.movement_name)
    ? STRENGTH_SUBCATEGORIES
    : subcategoriesFor(forste.movement_name, userMovementTypes)
  const n = gruppe.rader.length
  const monster = monsterTekst(gruppe)
  const fordeling = fmtSoneFordeling(gruppe)
  return (
    <div className="xp-act" data-gruppe-rad data-antall={n} data-monster={monster ?? undefined}>
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 px-3 py-2 cursor-pointer"
        onClick={onToggle} style={{ userSelect: 'none' }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11,
          letterSpacing: '0.1em', color: 'var(--accent)', border: '1px solid var(--accent)',
          borderRadius: 999, padding: '1px 7px', marginLeft: 24,
        }}>
          {monster ? monster : `${n} ×`}
        </span>
        <span style={{ fontSize: '14px' }}>{isStrength ? '🏋' : (meta?.icon ?? '•')}</span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px', fontWeight: 600 }}>
          {monster ? 'Intervaller' : (meta?.label ?? forste.activity_type)}
        </span>
        {fordeling && (
          <span data-sonefordeling style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '12.5px', letterSpacing: '0.04em' }}>
            · {fordeling}
          </span>
        )}
        {meta?.usesMovement && forste.movement_name && (
          <span className="truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '13px', minWidth: 0 }}>
            · {forste.movement_name}{forste.movement_subcategory ? ` — ${forste.movement_subcategory}` : ''}
          </span>
        )}
        <div className="flex-1" style={{ minWidth: '4px' }} />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '15px', letterSpacing: '0.05em' }}>
          {formatActivityDuration(gruppe.sumSek)}
        </span>
        {gruppe.sumKm > 0 && (
          <span className="hidden sm:inline" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', fontSize: '12px' }}>
            · {Math.round(gruppe.sumKm * 10) / 10} km
          </span>
        )}
        {gruppe.snittpuls != null && (
          <span className="hidden sm:inline" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', fontSize: '12px' }}>
            · {gruppe.snittpuls} bpm
          </span>
        )}
        <span style={{ color: 'var(--tekst-8-app)', fontSize: '12px', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', marginLeft: '4px' }}>▶</span>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--kant-5)' }}>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            <Field label="Aktivitetstype">
              <div style={{ ...iSt, display: 'flex', alignItems: 'center', opacity: 0.8 }} title="Type endres per rad i splittet visning">
                {meta?.icon} {meta?.label ?? forste.activity_type}
              </div>
            </Field>
            {meta?.usesMovement && (
              <Field label="Bevegelsesform">
                <select value={forste.movement_name}
                  onChange={e => onUpdate({ movement_name: e.target.value, movement_subcategory: '' })} style={iSt}>
                  <option value="">—</option>
                  {MOVEMENT_CATEGORIES.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                  {userMovementTypes.length > 0 && (
                    <optgroup label="Mine egne">
                      {userMovementTypes.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </Field>
            )}
            {meta?.usesMovement && subcatOptions.length > 0 && (
              <Field label="Underkategori">
                <select value={forste.movement_subcategory}
                  onChange={e => onUpdate({ movement_subcategory: e.target.value })} style={iSt}>
                  <option value="">—</option>
                  {subcatOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}
          </div>
          <p className="mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-app)' }}>
            {n} rader · bev.form og underkategori her skrives til hver av dem. Type, sone, tid, km og puls per rad:{' '}
            <button type="button" onClick={e => { e.stopPropagation(); onSplitt() }}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit' }}>
              vis splittet
            </button>
          </p>
        </div>
      )}
    </div>
  )
}

function ActivityRowItem({
  row, expanded, onToggle, onUpdate, onDelete, onMoveUp, onMoveDown, dragRef, dragListeners, dragAttributes, dragging,
  typeOptions, favoriteTypes, sport, isPlanMode, userMovementTypes, onRequestCreateMovement,
  defaultPaceUnit, workoutType, equipment, equipmentIds = [], onEquipmentChange, targetUserId,
}: {
  targetUserId?: string
  row: ActivityRow
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<ActivityRow>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  /** Gripepanel (⋮⋮) for dra-og-slipp — bare i splittet visning (dragRef satt). */
  dragRef?: (el: HTMLElement | null) => void
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
  dragging?: boolean
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
  workoutType?: string
  equipment?: Equipment[]
  equipmentIds?: string[]
  onEquipmentChange?: (ids: string[]) => void
}) {
  // Utstyr bolk 4: ⇄ åpner utstyr-velgeren for BYTTE på akkurat denne raden.
  const [equipOpen, setEquipOpen] = useState(false)
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
    if (!nextTur && !nextEndurance) {
      patch.pack_weight_kg = ''
    }
    if (!nextTur) {
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
    <div className="xp-act">
      {/* Compact row — flex-wrap så label/bevegelsesform kan gå på linje 2 på smal skjerm,
          mens ikon+type, varighet og kontroller forblir på topp-raden. */}
      <div
        className="flex items-center flex-wrap gap-x-2 gap-y-1 px-3 py-2 cursor-pointer"
        onClick={onToggle}
        style={{ userSelect: 'none' }}
      >
        {/* Gripepanel ⋮⋮ (pkt 18): dra raden opp/ned — mus, langt trykk på
            mobil, eller fokus + piltast (tilgjengelighet). Erstatter pilene. */}
        <div className="flex items-center justify-center" style={{ width: '24px', minHeight: 36 }} onClick={e => e.stopPropagation()}>
          {dragRef ? (
            <button type="button" ref={dragRef as React.Ref<HTMLButtonElement>} {...dragAttributes} {...dragListeners}
              data-grip aria-label="Flytt raden — dra, eller bruk piltastene"
              onKeyDown={e => {
                if (e.key === 'ArrowUp' && onMoveUp) { e.preventDefault(); e.stopPropagation(); onMoveUp() }
                if (e.key === 'ArrowDown' && onMoveDown) { e.preventDefault(); e.stopPropagation(); onMoveDown() }
              }}
              style={{
                background: 'none', border: 'none', padding: '4px 2px', cursor: dragging ? 'grabbing' : 'grab',
                color: 'var(--tekst-5-app)', fontSize: '15px', lineHeight: 1, letterSpacing: '-2px', touchAction: 'none',
                minHeight: 36, minWidth: 22,
              }}>⋮⋮</button>
          ) : null}
        </div>

        {/* Type icon + label */}
        <span style={{ fontSize: '14px' }}>{displayIcon}</span>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: 'var(--tekst-1-app)',
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
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
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
          <span className="hidden sm:inline" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', fontSize: '12px' }}>
            · {row.avg_heart_rate} bpm
          </span>
        )}

        {/* Utstyr-bytte (⇄) — kun der man faktisk byttet fra hele økta-arven */}
        {onEquipmentChange && (equipment?.length ?? 0) > 0 && (
          <button type="button"
            onClick={e => { e.stopPropagation(); setEquipOpen(true) }}
            aria-label="Bytt utstyr for denne aktiviteten"
            title={equipmentIds.length > 0
              ? `Byttet utstyr på denne aktiviteten (${equipmentIds.length})`
              : 'Bytt utstyr for denne aktiviteten'}
            style={{
              background: 'none',
              border: equipmentIds.length > 0 ? '1px solid #FF4500' : '1px solid var(--line2)',
              borderRadius: 6, cursor: 'pointer',
              color: equipmentIds.length > 0 ? '#FF4500' : 'var(--tekst-8-app)',
              fontSize: '12px', lineHeight: 1, padding: '4px 6px',
            }}>
            ⇄{equipmentIds.length > 0 ? equipmentIds.length : ''}
          </button>
        )}

        {/* Expand */}
        <span style={{
          color: 'var(--tekst-8-app)', fontSize: '12px',
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
            color: 'var(--tekst-8-app)', fontSize: '20px', lineHeight: 1,
            padding: '6px 8px', marginRight: '-6px',
          }}>×</button>
      </div>

      {equipOpen && onEquipmentChange && (
        <UtstyrVelgerPopup
          available={equipment ?? []}
          selectedIds={equipmentIds}
          title="Bytt utstyr — denne aktiviteten"
          hint="Overstyrer hele økta-valget kun for denne raden. Tomt valg = arv."
          onDone={onEquipmentChange}
          onClose={() => setEquipOpen(false)}
        />
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--kant-5)' }}>
          {/* 2 kolonner på mobil (kortere liste enn én lang kolonne), 3 fra lg
              (1024px) som på desktop. Field har minWidth:0 og inputene width:100%
              + boxSizing:border-box, så de krymper innenfor cellen uten å kuttes. */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            <Field label="Aktivitetstype">
              <select value={row.activity_type}
                onChange={e => {
                  const nyType = e.target.value as ActivityType
                  // Veksling har NAVN (T1/T2), ikke bevegelsesform. Bytter
                  // man til eller fra veksling, følger ikke navnet med —
                  // ellers ble «Løping» stående som vekslingens navn (og
                  // «T1» som bevegelsesform den andre veien).
                  const bytterVeksling = (nyType === 'veksling') !== (row.activity_type === 'veksling')
                  onUpdate(bytterVeksling
                    ? { activity_type: nyType, movement_name: '', movement_subcategory: '' }
                    : { activity_type: nyType })
                }}
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
                {/* Gamle rader m/ legacy skyting-variant: behold verdien synlig. */}
                {(() => {
                  const cur = meta
                  if (cur?.legacy && !typeOptions.some(t => t.value === cur.value)) {
                    return <option value={cur.value}>{cur.icon}  {cur.label}</option>
                  }
                  return null
                })()}
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

            {/* Veksling har ingen bevegelsesform, men trenger et NAVN —
                T1/T2 i triatlon. Skrives til movement_name, samme felt
                triatlon-malen alltid har brukt (ingen ny kolonne). */}
            {row.activity_type === 'veksling' && (
              <Field label="Navn">
                <input value={row.movement_name}
                  onChange={e => onUpdate({ movement_name: e.target.value })}
                  placeholder="F.eks. T1"
                  style={iSt} />
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
                Indoors/Ergo, Air bike, Tredemølle) der høydemeter ikke er meningsfullt,
                og for skyting: en skyteserie har ingen høydemeter selv om
                bevegelsesformen (f.eks. Langrenn) er en utholdenhetsform. */}
            {(isEndurance || isTur) && !isIndoorActivity && !meta?.isShooting && (
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
                  {/* Uten klokke (bolk 6): en kuttet rad arver ikke pulsen —
                      dragets snitt står som grå plassholder til brukeren
                      fører sitt eget tall, som da merkes M (manuelt vinner). */}
                  <span className="inline-flex items-center gap-1 w-full">
                    <input value={row.avg_heart_rate}
                      onChange={e => onUpdate({ avg_heart_rate: e.target.value })}
                      inputMode="numeric" placeholder={row.arvet_puls || '—'}
                      title={row.arvet_puls ? 'Dragets snitt — vises som hint, lagres ikke' : undefined}
                      data-puls-hint={row.arvet_puls || undefined}
                      style={iSt} />
                    {row.avg_heart_rate.trim() !== '' && (row.arvet_puls || row.window_start_seconds != null) && (
                      <span data-puls-merke title="Manuelt ført — vinner over det målte"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em',
                          fontSize: 10, color: '#E8B93C', border: '1px solid #E8B93C88', borderRadius: 5,
                          padding: '2px 5px', flexShrink: 0,
                        }}>M</span>
                    )}
                  </span>
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

          {/* Vekt (vest/våpen) på utholdenhet — DISKRET tillegg (Sverre 22. aug):
              en liten ghost-knapp til verdien finnes. Skiskyttere får børsa-
              chip (3,5 kg) rett i raden. Lagres i pack_weight_kg (Tur-mønsteret). */}
          {isEndurance && !isTur && !meta?.isShooting && !isAnnet && (
            <VektTillegg row={row} onUpdate={onUpdate} biathlon={sport === 'biathlon'} />
          )}

          {/* Sonefordeling — kun utholdenhet (ikke skyting/pause/styrke) */}
          {isEndurance && !meta?.isShooting && (
            <ZoneEditor
              zones={row.zones}
              targetUserId={targetUserId}
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
            <ShootingFields row={row} onUpdate={onUpdate} planMode={isPlanMode} workoutType={workoutType} />
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
  zones, onChange, targetUserId,
}: {
  zones: ActivityZoneMinutes
  onChange: (z: ActivityZoneMinutes) => void
  targetUserId?: string
}) {
  // Sonespråket (fase 111): null = ikke hentet ennå → standardspråket
  // vises (riktig for de aller fleste; utvidet-brukere får byttet når
  // flagget lander). Hurtighet-feltet vises i utvidet språk KUN når
  // økta har en eldre føring — merket, aldri stille (Sverre-krav 2).
  const [utvidet, setUtvidet] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    hentUtvidetSkalaCached(targetUserId).then(v => { if (!cancelled) setUtvidet(v) })
    return () => { cancelled = true }
  }, [targetUserId])
  const gammelHurtighet = (parseActivityDuration(zones.Hurtighet ?? '') ?? 0) > 0
  const keys = useMemo(() => {
    const base = foringsSoner(utvidet === true) as (keyof ActivityZoneMinutes)[]
    if (utvidet === true && gammelHurtighet) return [...base, 'Hurtighet' as const]
    return base
  }, [utvidet, gammelHurtighet])
  const totalSec = sumZoneSeconds(zones)
  return (
    <div className="mt-3 p-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          Sonefordeling
        </span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '15px', letterSpacing: '0.05em' }}>
          Σ {formatActivityDuration(totalSec) || '0:00'}
        </span>
      </div>

      {/* Color bar — 6 segmenter når Hurtighet > 0, ellers 5 */}
      <div className="flex mb-2" style={{ height: '8px', border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
        {keys.map(k => {
          const sec = parseActivityDuration(zones[k] ?? '') ?? 0
          const w = totalSec > 0 ? (sec / totalSec) * 100 : 0
          return w > 0 ? (
            <div key={k} style={{ width: `${w}%`, backgroundColor: ZONE_COLORS_BAR[k] }} />
          ) : null
        })}
        {totalSec === 0 && <div style={{ flex: 1, backgroundColor: 'var(--kant-2)' }} />}
      </div>

      {/* ÉN grid som pakker N felter — ikke to hardkodede rader. På mobil gir
          ZONE_KEYS-rekkefølgen I1·I2·I3 på rad 1 og I4·I5·Hurt. på rad 2, og
          en utvidet soneskala ville flytt videre av seg selv.
          md: er samme brekkpunkt som sonevisningen i WorkoutOverview, så
          oppsummering og føring aldri står 3-bred og 6-bred samtidig. */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-x-2 gap-y-3">
        {keys.map(k => (
          <div key={k}>
            <label className="block text-center mb-1 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ZONE_COLORS_BAR[k] }}>
              {k === 'Hurtighet' ? (utvidet === true ? 'Hurt. (eldre)' : 'Hurt.') : k}
            </label>
            {/* padding nulles ut fra iSt her — inline style slår Tailwind, så
                padding-klassene ville ikke hatt effekt ellers. Den delte
                iSt-konstanten er urørt; kun denne inputen overstyres.
                min-h-[40px] gir touch-høyde på mobil uansett fontmetrikk, og
                md:min-h-0 + md:py-1.5 beholder dagens høyde fra md og opp. */}
            <input value={zones[k] ?? ''}
              onChange={e => onChange({ ...zones, [k]: e.target.value })}
              inputMode="text" placeholder="MM:SS"
              className="min-h-[40px] py-2.5 px-2 md:min-h-0 md:py-1.5 md:px-2.5"
              style={{ ...iSt, padding: undefined, textAlign: 'center' }} />
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {'Skriv "60" for 60 minutter, eller "1:30" for 1 min 30 sek.'}{' '}
        {utvidet === true
          ? 'I6–I8 føres manuelt (innsats/laktat) — beregnes aldri fra puls.'
          : 'Hurtighet føres manuelt — beregnes ikke fra puls.'}
      </p>
      {utvidet === true && gammelHurtighet && (
        <p className="mt-1 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          Hurtighet-feltet vises fordi økta har en eldre føring — den lagres
          urørt og vises som I7 i fordelinger. Nye føres som I7.
        </p>
      )}
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
    let cancelled = false
    // Marker alle forsøkte navn som hentet (success ELLER feil) så vi ALDRI
    // re-fyrer på samme navn — ellers kan en treg/feilende spørring gi en
    // refire-loop som flommer serveren og gjør alt tregt.
    const settle = (map: Record<string, LastSessionForExercise>) => {
      if (cancelled) return
      setLastByName(prev => {
        const next = { ...prev }
        for (const n of missing) {
          const k = n.toLowerCase()
          next[k] = map[k] ?? null
        }
        return next
      })
    }
    const t = setTimeout(() => {
      getLastSessionForExercises(missing).then(settle).catch(() => settle({}))
    }, 500)
    return () => { cancelled = true; clearTimeout(t) }
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
    <div className="mt-3 p-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)' }}>
      <div className="text-xs tracking-widest uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        Øvelser
      </div>

      {exercises.length === 0 && (
        <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
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
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
            Foreslått
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presetQuickAdds.map(name => (
              <button key={name} type="button" onClick={() => addExercise(name)}
                className="text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)',
                  background: 'none', border: '1px solid var(--kant-5)',
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
    <div style={{ border: '1px solid var(--kant-5)', backgroundColor: 'var(--kant-2)', padding: '10px' }}>
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tekst-8-app)', fontSize: '16px', padding: '0 6px' }}
          title="Slett øvelse">×</button>
      </div>

      {/* Forrige-økt-hint på samme øvelse (nøkles på navn, kontekst-uavhengig)
          + «Gjenta forrige» som fyller alle sett med forrige verdier på ett tap. */}
      {lastSession && (
        <div className="flex items-center gap-2 flex-wrap mb-2" style={{ marginTop: '-2px' }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-7)', fontSize: '12px', fontStyle: 'italic' }}>
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
            fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)',
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
              fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-5-app)', fontSize: '14px', textAlign: 'center',
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tekst-8-app)', fontSize: '14px' }}
              title="Slett sett">×</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addSet}
        className="mt-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
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
  // Bla-modus: kategorichips + øvelsesliste fra standardbiblioteket.
  const [browsing, setBrowsing] = useState(false)
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
    setBrowsing(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1 }}>
      <input value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Øvelsesnavn (f.eks. Knebøy)"
        style={{ ...iSt, width: '100%', fontWeight: 600 }} />

      {open && (suggestions.length > 0 || browsing) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-5)',
          marginTop: '2px', maxHeight: browsing ? '340px' : '260px', overflowY: 'auto',
        }}>
          {suggestions.map((s, i) => (
            <button key={`${s.kind}-${s.name}-${i}`} type="button"
              onClick={() => pick(s)}
              className="w-full flex items-center justify-between px-3 py-1.5 transition-colors hover:bg-[var(--kant-3)]"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)',
                fontSize: '14px', textAlign: 'left',
              }}>
              <span>{s.name}</span>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: s.kind === 'library' ? 'var(--tekst-5-app)' : 'var(--tekst-8-app)',
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
          {/* Bla per kategori (kø #46-oppfølger): toggler kategorichips +
              øvelsesliste fra standardbiblioteket — 287 øvelser. */}
          <button type="button" onClick={() => setBrowsing(b => !b)}
            className="w-full px-3 transition-colors hover:bg-[var(--kant-3)]"
            style={{
              background: 'none', border: 'none', borderTop: '1px solid var(--kant-5)',
              cursor: 'pointer', textAlign: 'left', minHeight: 38, padding: '9px 12px',
              fontFamily: "'Barlow Condensed', sans-serif", color: browsing ? 'var(--accent)' : 'var(--tekst-5-app)',
              fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
            {browsing ? '▾' : '▸'} Bla i biblioteket per kategori
          </button>
          {browsing && (
            <StandardExerciseBrowser onPick={name => { onChange(name); setOpen(false); setBrowsing(false) }} />
          )}
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
    <div className="mt-3 p-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)' }}>
      <div className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        Laktat
      </div>

      {measurements.length > 0 && (
        <div className="grid gap-2 px-1 mb-1 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)',
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tekst-8-app)', fontSize: '14px' }}
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

function VektTillegg({ row, onUpdate, biathlon }: {
  row: ActivityRow
  onUpdate: (patch: Partial<ActivityRow>) => void
  biathlon: boolean
}) {
  const [open, setOpen] = useState(false)
  const val = row.pack_weight_kg
  const erBorsa = val === '3.5'
  const ghost: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
    letterSpacing: '0.06em', color: 'var(--tekst-8-app)', background: 'none',
    border: '1px dashed var(--line2)', borderRadius: 999, padding: '3px 10px',
    cursor: 'pointer',
  }
  if (val === '' && !open) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <button type="button" onClick={() => setOpen(true)} style={ghost}>
          ＋ Vekt (vest/våpen)
        </button>
        {biathlon && (
          <button type="button" onClick={() => onUpdate({ pack_weight_kg: '3.5' })} style={ghost}>
            🔫 Børsa 3,5 kg
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-5-app)', letterSpacing: '0.06em' }}>
        ⚖ Vekt
      </span>
      <input value={val} inputMode="decimal" placeholder="kg" autoFocus={open && val === ''}
        onChange={e => onUpdate({ pack_weight_kg: e.target.value })}
        style={{ ...iSt, width: 64, padding: '3px 8px', fontSize: 13 }} />
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--tekst-8-app)' }}>kg</span>
      {biathlon && (
        <button type="button"
          onClick={() => onUpdate({ pack_weight_kg: erBorsa ? '' : '3.5' })}
          style={{ ...ghost, borderStyle: 'solid',
            color: erBorsa ? 'var(--tekst-1-app)' : 'var(--tekst-8-app)',
            borderColor: erBorsa ? '#FF4500' : 'var(--line2)',
            background: erBorsa ? 'rgba(255,69,0,0.08)' : 'none' }}>
          🔫 Børsa 3,5 kg
        </button>
      )}
      <button type="button" aria-label="Fjern vekt"
        onClick={() => { onUpdate({ pack_weight_kg: '' }); setOpen(false) }}
        style={{ background: 'none', border: 'none', color: 'var(--tekst-8-app)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>
        ✕
      </button>
    </div>
  )
}

function TurFields({
  row, onUpdate,
}: {
  row: ActivityRow
  onUpdate: (patch: Partial<ActivityRow>) => void
}) {
  const showSled = TUR_SUBCATEGORIES_WITH_SLED.has(row.movement_subcategory)
  const pack = parseDecimal(row.pack_weight_kg)
  const sled = parseDecimal(row.sled_weight_kg)
  const total =
    (Number.isFinite(pack) ? pack : 0) +
    (showSled && Number.isFinite(sled) ? sled : 0)
  const hasWeight =
    (Number.isFinite(pack) && pack > 0) ||
    (showSled && Number.isFinite(sled) && sled > 0)

  return (
    <div className="mt-3 p-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)' }}>
      <div className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
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
              style={{ ...iSt, color: 'var(--tekst-5-app)', cursor: 'not-allowed' }} />
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

// ── Skyting: FØRING V2 (kø #47 bolk 2) ─────────────────────
// Type per blokk (fargeprikk-chips) + markeringer (manuelle: innskyting,
// 🧪 skytetest; automatiske: 🏁/⏱ fra øktas konkurranse/testløp-type) +
// serie-rader L/S · skudd · treff · tid · puls på seriemodellen (fase 85).
// Blokk-total skytetid = radens Varighet-felt (utenfor treningstid som før);
// auto-sum-hint fra serie-tidene. Tørrtrening fører KUN skytetid.
// 🎯 skuddplott kommer i bolk 3. Delt beregning: shootingSummary (kun førte).
function ShootingFields({
  row, onUpdate, planMode, workoutType,
}: {
  row: ActivityRow
  onUpdate: (patch: Partial<ActivityRow>) => void
  planMode: boolean
  workoutType?: string
}) {
  // Bolk 4: skytetest-maler — NSSF-standardene bor i kode (låst), egne i DB.
  const [ownTests, setOwnTests] = useState<OwnShootingTest[] | null>(null)
  const [saveTestName, setSaveTestName] = useState<string | null>(null)
  const series = row.shooting_series
  const isDry = row.shooting_type === 'torrtrening'
  const sum = shootingSummary(series)
  const isComp = workoutType === 'competition'
  const isTestlop = workoutType === 'testlop'

  // Lazy-last egne testmaler første gang 🧪 er på.
  useEffect(() => {
    if (!row.shooting_is_test || ownTests !== null) return
    let cancelled = false
    listMyShootingTests()
      .then(res => { if (!cancelled) setOwnTests(Array.isArray(res) ? res : []) })
      .catch(() => { if (!cancelled) setOwnTests([]) })
    return () => { cancelled = true }
  }, [row.shooting_is_test, ownTests])

  const activeStd = findStandardTest(row.shooting_test_ref)
  const activeOwn = ownTests?.find(t => t.id === row.shooting_test_ref) ?? null
  const testScoring: 'treff' | 'ring' = activeStd?.scoring ?? activeOwn?.config.scoring ?? 'treff'
  const showPoints = row.shooting_is_test && testScoring === 'ring' && !planMode

  // Forhåndsutfyll serier/underlag fra mal — destruktivt bekreftes.
  const applyTest = async (ref: string) => {
    if (!ref) { onUpdate({ shooting_test_ref: '' }); return }
    const std = findStandardTest(ref)
    const own = ownTests?.find(t => t.id === ref) ?? null
    const flat = std ? expandTestSeries(std) : (own?.config.series ?? [])
    const name = std?.name ?? own?.name ?? ref
    if (flat.length === 0) { onUpdate({ shooting_test_ref: ref }); return }
    if (series.some(s => (parseInt(s.shots) || 0) > 0)) {
      const ok = await xpConfirm(`Erstatte seriene med oppsettet fra «${name}» (${flat.length} serier)?`)
      if (!ok) return
    }
    onUpdate({
      shooting_test_ref: ref,
      shooting_surface: (std?.surface ?? own?.config.surface ?? row.shooting_surface) as ActivityRow['shooting_surface'],
      shooting_series: flat.map(f => ({
        id: crypto.randomUUID(), position: f.position, shots: String(f.shots),
        hits: '', time_seconds: '', avg_heart_rate: '', max_heart_rate: '',
        note: '', shot_plot: null, points: '',
        vind_retning: null, vind_styrke: null, sikt: null,
      })),
    })
  }

  const saveAsOwnTest = async () => {
    const name = (saveTestName ?? '').trim()
    if (!name) return
    const res = await saveMyShootingTest(name, {
      surface: row.shooting_surface,
      scoring: testScoring,
      series: series
        .filter(s => (parseInt(s.shots) || 0) > 0)
        .map(s => ({ position: s.position, shots: parseInt(s.shots) || 5 })),
    })
    if (!res.error) {
      setOwnTests(null) // re-lastes m/ den nye
      setSaveTestName(null)
      if (res.id) onUpdate({ shooting_test_ref: res.id })
    }
  }


  const chip = (
    label: string, active: boolean, color: string,
    onClick?: () => void, opts?: { dashed?: boolean; title?: string },
  ) => (
    <button key={label} type="button" onClick={onClick} disabled={!onClick}
      title={opts?.title}
      className="inline-flex items-center gap-1.5"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: '0.05em',
        borderRadius: 999, padding: '6px 12px', minHeight: 36,
        cursor: onClick ? 'pointer' : 'default',
        color: active ? 'var(--tekst-1-app)' : 'var(--mut)',
        background: active ? `${color}22` : 'transparent',
        border: `1px ${opts?.dashed ? 'dashed' : 'solid'} ${active ? color : 'var(--line2)'}`,
        opacity: !onClick && !active ? 0.5 : 1,
      }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </button>
  )

  // Auto-sum-hint: serie-tidene summert ≠ radens Varighet → tilby å bruke summen.
  const autoSumLabel = sum.timeSum != null && sum.timeSum > 0
    ? formatActivityDuration(Math.round(sum.timeSum))
    : null
  const showAutoSum = !planMode && autoSumLabel != null && autoSumLabel !== row.duration

  return (
    <div className="mt-3 p-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)' }}>
      {/* Type-chips — én type per blokk. */}
      <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', marginRight: 2 }}>
          Type
        </span>
        {SHOOTING_TYPES_V2.map(t => chip(
          t.label,
          row.shooting_type === t.key,
          t.color,
          () => onUpdate({ shooting_type: row.shooting_type === t.key ? '' : t.key }),
        ))}
      </div>
      {!row.shooting_type && (
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF8C00', marginBottom: 8 }}>
          Velg type for skyteblokken.
        </p>
      )}

      {/* Markeringer: manuelle + automatiske (fra øktas chips). */}
      <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 10 }}>
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', marginRight: 2 }}>
          Markering
        </span>
        {chip('Innskyting', row.shooting_is_innskyting, 'var(--tekst-5-app)',
          () => onUpdate({ shooting_is_innskyting: !row.shooting_is_innskyting }))}
        {chip('🧪 Skytetest', row.shooting_is_test, '#D4A017',
          () => onUpdate({ shooting_is_test: !row.shooting_is_test }))}
        {isComp && chip('🏁 Konkurranse', true, '#D4A017', undefined,
          { dashed: true, title: 'Automatisk — følger øktas konkurranse-markering' })}
        {isTestlop && chip('⏱ Testløp', true, '#1A6FD4', undefined,
          { dashed: true, title: 'Automatisk — følger øktas testløp-markering' })}
      </div>

      {/* Bolk 4: skytetest-mal (🧪) — forhåndsutfyller serier/underlag. */}
      {row.shooting_is_test && (
        <div className="mb-3 p-2" style={{ border: '1px dashed rgba(212,160,23,0.4)', borderRadius: 10 }}>
          <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
            <select
              value={row.shooting_test_ref}
              onChange={e => { void applyTest(e.target.value) }}
              style={{
                backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', borderRadius: 8,
                color: row.shooting_test_ref ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5,
                padding: '8px 8px', minHeight: 40, maxWidth: 260, outline: 'none',
              }}>
              <option value="">Velg testmal…</option>
              <optgroup label="NSSF-standard (låst)">
                {STANDARD_SHOOTING_TESTS.map(t => (
                  <option key={t.ref} value={t.ref}>{t.name}</option>
                ))}
              </optgroup>
              {(ownTests?.length ?? 0) > 0 && (
                <optgroup label="Egne maler">
                  {ownTests!.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <select
              value={row.shooting_surface}
              onChange={e => onUpdate({ shooting_surface: e.target.value as ActivityRow['shooting_surface'] })}
              title="Underlag for testen"
              style={{
                backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', borderRadius: 8,
                color: row.shooting_surface ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5,
                padding: '8px 8px', minHeight: 40, outline: 'none',
              }}>
              <option value="">Underlag…</option>
              <option value="papp">Papp</option>
              <option value="metall">Metall</option>
              <option value="issf">ISSF</option>
            </select>
            {saveTestName === null ? (
              <>
                {series.some(s => (parseInt(s.shots) || 0) > 0) && (
                  <button type="button" onClick={() => setSaveTestName('')}
                    className="text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)', borderRadius: 8, padding: '8px 10px', minHeight: 40, cursor: 'pointer', letterSpacing: '0.05em' }}>
                    Lagre som egen mal
                  </button>
                )}
                {/* Kø #49 bolk 4: NSSF er låst men KOPIERBART — kopien tas fra
                    NSSF-DEFINISJONEN (ikke gjeldende serier) og blir brukerens
                    egen redigerbare test-mal, valgt med én gang. */}
                {activeStd && (
                  <button type="button"
                    onClick={async () => {
                      const flat = expandTestSeries(activeStd)
                      const res = await saveMyShootingTest(`${activeStd.name} (kopi)`, {
                        surface: activeStd.surface ?? row.shooting_surface,
                        scoring: activeStd.scoring,
                        series: flat.map(f => ({ position: f.position, shots: f.shots })),
                      })
                      if (!res.error) {
                        setOwnTests(null)
                        if (res.id) onUpdate({ shooting_test_ref: res.id })
                      }
                    }}
                    title="Lag en egen redigerbar kopi av NSSF-malen (havner under Egne maler)"
                    className="text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017', background: 'none', border: '1px solid #D4A01755', borderRadius: 8, padding: '8px 10px', minHeight: 40, cursor: 'pointer', letterSpacing: '0.05em' }}>
                    Kopier til egen mal
                  </button>
                )}
              </>
            ) : (
              <span className="flex items-center" style={{ gap: 6 }}>
                <input value={saveTestName} onChange={e => setSaveTestName(e.target.value)}
                  placeholder="Navn på malen"
                  style={{ backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', borderRadius: 8, color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, padding: '8px 10px', minHeight: 40, width: 160, outline: 'none' }} />
                <button type="button" onClick={() => { void saveAsOwnTest() }}
                  disabled={!(saveTestName ?? '').trim()}
                  className="text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--flate-3)', background: '#D4A017', border: 'none', borderRadius: 8, padding: '8px 12px', minHeight: 40, cursor: 'pointer', fontWeight: 700 }}>
                  Lagre
                </button>
                <button type="button" onClick={() => setSaveTestName(null)} aria-label="Avbryt"
                  style={{ color: 'var(--tekst-5-app)', background: 'none', border: 'none', cursor: 'pointer', minHeight: 40, minWidth: 32 }}>✕</button>
              </span>
            )}
          </div>
          {(activeStd?.guidance || activeOwn) && (
            <p className="text-xs mt-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', lineHeight: 1.5 }}>
              {activeStd?.guidance ?? 'Egen mal — samme mal gir sammenlignbar testserie over tid.'}
            </p>
          )}
        </div>
      )}

      {isDry ? (
        <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', lineHeight: 1.6 }}>
          Tørrtrening: før kun total skytetid i Varighet-feltet over — ingen
          skudd/treff registreres.
          <span style={{ display: 'block', color: 'var(--tekst-8-app)' }}>
            NSSF-tips: 3×5 min er bedre enn 1×15 min.
          </span>
        </p>
      ) : (
        <SerieListe
          series={series}
          onChange={(next: ShootingSeriesRow[]) => onUpdate({ shooting_series: next })}
          planMode={planMode}
          showPoints={showPoints}
          etterSum={showAutoSum ? (
                <button type="button"
                  onClick={() => onUpdate({ duration: autoSumLabel! })}
                  className="mt-1 text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', letterSpacing: '0.05em' }}>
                  Bruk serie-summen som total skytetid: {autoSumLabel}
                </button>
          ) : null}
        />
      )}
    </div>
  )
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
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
      {children}
    </label>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: 'var(--card2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-field)',
  color: 'var(--ink)',
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
        backgroundColor: 'var(--scrim-70)', padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-5)',
          width: '100%', maxWidth: '480px', padding: '20px',
        }}
      >
        <h3 style={{
          fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)',
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
                      color: active ? '#FF4500' : 'var(--tekst-3-app)',
                      background: active ? 'var(--kant-2)' : 'none',
                      border: '1px solid ' + (active ? '#FF4500' : 'var(--kant-5)'),
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
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
              background: 'none', border: '1px solid var(--kant-5)',
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
  const km = parseDecimal(row.distance_km)
  const durSec = parseActivityDuration(row.duration) ?? 0
  const computed = paceFromDistanceDuration(km, durSec)
  const computedRounded = computed != null ? Math.round(computed) : null

  const currentSeconds = (() => {
    const v = parseInt(row.avg_pace_seconds_per_km)
    return Number.isFinite(v) && v > 0 ? v : null
  })()

  return (
    <div className="mt-3 p-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)' }}>
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
