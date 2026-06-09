'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveWorkout } from '@/app/actions/workouts'
import { getAltitudePeriodForDate } from '@/app/actions/seasons'
import { saveAsTemplate } from '@/app/actions/templates'
import { setWorkoutEquipment } from '@/app/actions/equipment'
import { replaceWorkoutNutrition } from '@/app/actions/nutrition'
import { toggleAttendanceForWorkout } from '@/app/actions/trainer-calendar'
import {
  WorkoutFormData, MovementRow, LactateRow,
  Sport, SPORTS, DEFAULT_MOVEMENTS_BY_SPORT,
  getWorkoutTypes, WorkoutType, WorkoutTemplate, TEMPLATE_CATEGORIES,
  CompetitionData, emptyCompetitionData, generateCompetitionActivities,
  TestData, emptyTestData,
  ActivityRow, ActivityType, emptyActivityZones, makeActivity,
  NutritionEntryRow, emptyWeatherData,
} from '@/lib/types'
import { parseActivityDuration } from '@/lib/activity-duration'
import type { Equipment } from '@/lib/equipment-types'
import { ActivitiesSection } from './ActivitiesSection'
import { ActivitySummary } from './ActivitySummary'
import { CompetitionModule } from './CompetitionModule'
import { WorkoutKlokkesyncSection } from './WorkoutKlokkesyncSection'
import { LinkWorkoutActions } from './LinkWorkoutActions'
import { PoweredByStravaAttribution } from '@/components/strava/StravaBrand'
import { TestDataModule } from './TestDataModule'
import { PlanVsActualComparison } from './PlanVsActualComparison'
import { NutritionSection } from './NutritionSection'
import { WeatherSection, weatherSummaryLine } from './WeatherSection'
import { EquipmentSelectorInWorkout } from '@/components/equipment/EquipmentSelectorInWorkout'
import { HeartZone } from '@/lib/heart-zones'

// Økttype-velgeren tilbyr kun de FUNKSJONELLE taggene — de som faktisk trigger
// felter/analyse/visning. Generiske kategorier (langtur/intervall/terskel/rolig/
// restitusjon/teknisk/annet) er fjernet fra valget: intensitet måles nå på
// faktisk sonetid (analysis.ts), ikke på en manuell tag. competition/testlop/test
// gir konkurranse-/test-felter; skiskyting-combos driver skiskyting-analysen
// (CustomSkytingChartBuilder). «Vanlig økt» = 'other' (ingen synlig knapp).
// Gamle økter med fjernede typer beholder sin lagrede verdi (ingen migrering).
// Valgbare økttype-tagger i nedtrekkslista (i tillegg til «Vanlig økt» = other).
// Generiske trenings-tagger (intervall/terskel/teknikk/styrke/rolig) brukes til
// manuell klassifisering + analyse-gruppering; competition/testlop/test trigger
// egne felter. Sone-basert intensiv-analyse beholdes som SUPPLEMENT (analysis.ts).
// Generiske tagger i nedtrekkslista. Test/Testløp/Konkurranse er FLYTTET ut til
// egne chips (de endrer skjema: test-/konkurranse-felter) for å skille rene
// kategori-tagger fra de funksjonelle. Verdien lagres fortsatt i workout_type.
const MEANINGFUL_WORKOUT_TYPES: WorkoutType[] = [
  'interval', 'threshold', 'technical', 'strength', 'easy',
  'hard_combo', 'easy_combo', 'basis_shooting',
]
// Spesialtyper med egne skjema-felter — vises som chips, ikke i nedtrekkslista.
const SPECIAL_WORKOUT_TYPES: { value: WorkoutType; label: string; color: string }[] = [
  { value: 'competition', label: '🏁 Konkurranse', color: '#E11D48' },
  { value: 'testlop', label: '⏱️ Testløp', color: '#F59E0B' },
  { value: 'test', label: '🧪 Test', color: '#8B5CF6' },
]

interface WorkoutFormProps {
  initialSport?: Sport
  // Brukerens sporter (primary + secondary). Brukes til å vise/skjule sport-
  // spesifikke kontroller i økt-skjemaet — f.eks. "+ Legg til skyting"-knappen
  // i ActivitiesSection som vises hvis brukeren har biathlon i sine sporter,
  // uavhengig av hvilken sport selve økten føres som. Default: [initialSport].
  userSports?: Sport[]
  // Topp 5 mest brukte aktivitetstyper siste 60 dager. Vises som "Mest brukt"-
  // optgroup øverst i Aktivitetstype-velgeren i ActivitiesSection.
  activityTypeFavorites?: ActivityType[]
  initialDate?: string
  workoutId?: string
  defaultValues?: Partial<WorkoutFormData>
  templates?: WorkoutTemplate[]
  formMode?: 'plan' | 'dagbok'
  heartZones?: HeartZone[]
  onSaved?: () => void
  onCancel?: () => void
  readOnly?: boolean
  // Mal-bygging: fjerner "Lagre økt"-knappen og gjør "Lagre som mal" til primær CTA.
  // Trener-bruk i /app/trener/planlegg.
  templateBuildingMode?: boolean
  onTemplateSaved?: (id: string) => void
  // Fanger form-state uten å lagre til DB (brukes av plan-mal-bygger).
  // Når satt: primær-knapp kaller onCapture(formData) i stedet for saveWorkout.
  captureOnlyMode?: boolean
  onCapture?: (data: WorkoutFormData) => void
  captureSubmitLabel?: string
  // Varsles når form-data er endret fra initial-tilstand. Brukes av modal-foreldre
  // for å vise bekreftelses-dialog på klikk-utenfor / Escape / refresh.
  onDirtyChange?: (dirty: boolean) => void
  // Når satt: trener redigerer utøvers plan. saveWorkout skriver da til utøverens rad,
  // og created_by_coach_id settes til innlogget trener → gir blå markering i Calendar.
  targetUserId?: string
  // Brukerens default pace-enhet (profiles.default_pace_unit). Brukes til å vise
  // pace-felt i ActivitiesSection med riktig enhet ved første visning.
  defaultPaceUnit?: 'min_per_km' | 'km_per_h' | null
  // Utstyr: hvilke ID-er som er valgt i denne økten + tilgjengelig liste.
  // Når satt vises EquipmentSelectorInWorkout. Endringer lagres etter saveWorkout.
  availableEquipment?: Equipment[]
  initialEquipmentIds?: string[]
}

function makeDefaultMovements(sport: Sport): MovementRow[] {
  return DEFAULT_MOVEMENTS_BY_SPORT[sport].map(name => ({
    id: crypto.randomUUID(), movement_name: name, minutes: '', distance_km: '',
    elevation_meters: '', avg_heart_rate: '', zones: [], exercises: [],
  }))
}

// Mal-snapshots kan mangle nyere felt (zones, exercises, lactate_measurements,
// splits_per_km osv.). Render-koden i ActivitiesSection forventer at disse er
// fylt inn — uten normalisering crasher klikk/expand på en aktivitet etter
// mal-bruk ("Page could not load").
function normalizeActivityRowFromTemplate(a: Partial<ActivityRow>): ActivityRow {
  return {
    id: crypto.randomUUID(),
    activity_type: a.activity_type ?? 'aktivitet',
    movement_name: a.movement_name ?? '',
    movement_subcategory: a.movement_subcategory ?? '',
    start_time: a.start_time ?? '',
    duration: a.duration ?? '',
    distance_km: a.distance_km ?? '',
    avg_heart_rate: a.avg_heart_rate ?? '',
    max_heart_rate: a.max_heart_rate ?? '',
    avg_watts: a.avg_watts ?? '',
    max_watts: a.max_watts ?? '',
    resistance_level: a.resistance_level ?? '',
    avg_pace_seconds_per_km: a.avg_pace_seconds_per_km ?? '',
    pace_unit_preference: a.pace_unit_preference ?? '',
    splits_per_km: a.splits_per_km ?? [],
    prone_shots: a.prone_shots ?? '',
    prone_hits: a.prone_hits ?? '',
    standing_shots: a.standing_shots ?? '',
    standing_hits: a.standing_hits ?? '',
    is_dry_training: a.is_dry_training ?? false,
    elevation_gain_m: a.elevation_gain_m ?? '',
    elevation_loss_m: a.elevation_loss_m ?? '',
    incline_percent: a.incline_percent ?? '',
    pack_weight_kg: a.pack_weight_kg ?? '',
    sled_weight_kg: a.sled_weight_kg ?? '',
    weather: a.weather ?? '',
    temperature_c: a.temperature_c ?? '',
    notes: a.notes ?? '',
    zones: a.zones ?? emptyActivityZones(),
    exercises: (a.exercises ?? []).map(ex => ({
      ...ex,
      id: crypto.randomUUID(),
      sets: (ex.sets ?? []).map(s => ({ ...s, id: crypto.randomUUID() })),
    })),
    lactate_measurements: (a.lactate_measurements ?? []).map(m => ({
      ...m,
      id: crypto.randomUUID(),
    })),
  }
}

export function WorkoutForm({ initialSport = 'running', userSports, activityTypeFavorites, initialDate, workoutId, defaultValues, templates = [], formMode = 'dagbok', heartZones = [], onSaved, onCancel, readOnly = false, templateBuildingMode = false, onTemplateSaved, captureOnlyMode = false, onCapture, captureSubmitLabel, onDirtyChange, targetUserId, defaultPaceUnit = null, availableEquipment = [], initialEquipmentIds = [] }: WorkoutFormProps) {
  const effectiveUserSports: Sport[] = userSports ?? [initialSport]
  const router = useRouter()
  const isPlanMode = formMode === 'plan'
  // Trener oppretter ny økt for utøver: vis "Skal delta"-chip ved siden av
  // Fellestrening. Etter saveWorkout fires toggleAttendanceForWorkout(id).
  // For redigering håndterer TrainerAttendanceSection i WorkoutModal saken.
  const showCoachAttendChip = !!targetUserId && !workoutId
  const [coachWillAttend, setCoachWillAttend] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateCategory, setTemplateCategory] = useState<string>('Annet')
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  // Aktiveres når bruker trykker "✓ Merk som gjennomført" på en planlagt økt i Dagbok.
  // Viser full dagbok-utfylling med plan-verdier forhåndsutfylt. Ved lagring settes is_completed=true.
  // planReference: frosset kopi av planen som vises read-only øverst mens bruker redigerer actuals.
  const [markingCompleted, setMarkingCompleted] = useState(false)
  const [planReference, setPlanReference] = useState<WorkoutFormData | null>(null)

  const today = initialDate ?? new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<WorkoutFormData>(() => ({
    title:       defaultValues?.title ?? '',
    date:        defaultValues?.date ?? today,
    time_of_day: defaultValues?.time_of_day ?? '',
    sport:       defaultValues?.sport ?? initialSport,
    // Nye økter er «vanlig økt» (other) som standard — økttype-velgeren tilbyr
    // nå bare de funksjonelle taggene (konkurranse/testløp/test + skiskyting-
    // combos). Gamle økter beholder sin lagrede type uendret.
    workout_type: defaultValues?.workout_type ?? 'other',
    is_planned:  formMode === 'plan' ? true : (defaultValues?.is_planned ?? false),
    is_completed: defaultValues?.is_completed ?? false,
    is_important: defaultValues?.is_important ?? false,
    is_group_session: defaultValues?.is_group_session ?? false,
    group_session_label: defaultValues?.group_session_label ?? '',
    movements:   (defaultValues?.movements ?? makeDefaultMovements(defaultValues?.sport ?? initialSport)).map(m => ({
      ...m,
      avg_heart_rate: m.avg_heart_rate ?? '',
      zones: m.zones ?? [],
      exercises: m.exercises ?? [],
    })),
    zones:       [],
    exercises:   [],
    strength_type: defaultValues?.strength_type ?? 'basis',
    lactate:     defaultValues?.lactate ?? [],
    day_form_physical: defaultValues?.day_form_physical ?? null,
    day_form_mental:   defaultValues?.day_form_mental ?? null,
    rpe:         defaultValues?.rpe ?? null,
    notes:       defaultValues?.notes ?? '',
    tags:        defaultValues?.tags ?? [],
    shooting_blocks: defaultValues?.shooting_blocks ?? [],
    // Init med én default aktivitet-rad ved opprettelse (ingen workoutId).
    // Eksisterende økter beholder sine activities (også om tom liste fra DB).
    activities: defaultValues?.activities ?? (
      workoutId
        ? []
        : [makeActivity({
            activity_type: 'aktivitet',
            movement_name: DEFAULT_MOVEMENTS_BY_SPORT[defaultValues?.sport ?? initialSport]?.[0] ?? 'Løping',
          })]
    ),
    planned_activities: defaultValues?.planned_activities,
    competition_data: defaultValues?.competition_data,
    template_id:   defaultValues?.template_id ?? null,
    template_name: defaultValues?.template_name ?? null,
    standard_workout_template_id:   defaultValues?.standard_workout_template_id ?? null,
    standard_workout_template_name: defaultValues?.standard_workout_template_name ?? null,
    test_data:     defaultValues?.test_data,
    nutrition_entries: defaultValues?.nutrition_entries ?? [],
    weather: defaultValues?.weather ?? emptyWeatherData(),
    location: defaultValues?.location ?? '',
    is_altitude_training: defaultValues?.is_altitude_training ?? false,
    altitude_meters: defaultValues?.altitude_meters ?? null,
    is_heat_training: defaultValues?.is_heat_training ?? false,
    body_temperature: defaultValues?.body_temperature ?? null,
  }))

  // Sammenlign-toggle: åpen som standard når økten allerede er gjennomført.
  const [showComparison, setShowComparison] = useState<boolean>(() => !!defaultValues?.is_completed)

  // «Marker som standardøkt»-velger: åpner mal-listen i tagge-modus.
  const [standardPickerOpen, setStandardPickerOpen] = useState(false)

  // Live økt-modus: vises kun for utøvers egne styrkeøkter (ikke trener).
  const [startingLive, setStartingLive] = useState(false)
  const isStrengthWorkout = (form.activities ?? []).some(
    a => (a.exercises?.length ?? 0) > 0 || a.movement_name === 'Styrke',
  )
  const startLiveFlow = async () => {
    if (!workoutId || startingLive) return
    setStartingLive(true)
    const res = await saveWorkout(form, workoutId, targetUserId)
    if (res.error) { setStartingLive(false); window.alert(res.error); return }
    router.push(`/app/okt/${workoutId}`)
  }

  // Fase 77: arv av høyde fra årsplan-periode. Når øktens dato faller i en
  // høyde-periode, arver nye økter automatisk høydetrening + periodens moh
  // (kan overstyres per økt). Eksisterende økter mutéres ikke — men vi viser
  // kontekst-hintet uansett.
  const [inheritedAltitude, setInheritedAltitude] = useState<{ altitude_meters: number | null; period_name: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!form.date) { setInheritedAltitude(null); return }
    getAltitudePeriodForDate(form.date, targetUserId).then(res => {
      if (cancelled) return
      setInheritedAltitude(res)
      if (res && !workoutId) {
        // Auto-arv kun for nye økter, og kun om de ikke alt er markert.
        setForm(f => f.is_altitude_training ? f : {
          ...f,
          is_altitude_training: true,
          altitude_meters: f.altitude_meters ?? res.altitude_meters,
        })
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, targetUserId, workoutId])

  // Utstyr-valg for økten. Endres uavhengig av form-state; lagres separat etter saveWorkout.
  const [equipmentIds, setEquipmentIds] = useState<string[]>(initialEquipmentIds)

  // Dirty-tracking: vi snapshotter første render som "rent" og varsler foreldre
  // når noen form-felt avviker. Brukes av plan-mal-bygger for å vise bekreftelses-
  // dialog på klikk-utenfor/Escape.
  const [initialFormSnapshot] = useState<string>(() => JSON.stringify(form))
  useEffect(() => {
    if (!onDirtyChange) return
    const dirty = JSON.stringify(form) !== initialFormSnapshot
    onDirtyChange(dirty)
  }, [form, initialFormSnapshot, onDirtyChange])

  const set = <K extends keyof WorkoutFormData>(key: K, val: WorkoutFormData[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const handleSportChange = (sport: Sport) => {
    setForm(f => ({ ...f, sport, movements: makeDefaultMovements(sport) }))
  }

  const loadTemplate = (template: WorkoutTemplate) => {
    const d = template.template_data ?? ({} as WorkoutFormData)
    // Generer nye klient-id-er + safe defaults for alle felt så ikke gamle
    // mal-snapshots krasjer render i ActivitiesSection.
    const freshActivities = (template.activities ?? []).map(normalizeActivityRowFromTemplate)
    setForm(f => ({
      ...f,
      // Malens tittel følger med inn i økten (pre-fylt, redigerbar). Malens
      // navn ER tittelen (settes fra øktens tittel når malen lagres).
      title: template.name || f.title,
      sport: template.sport ?? d.sport ?? f.sport,
      workout_type: d.workout_type ?? f.workout_type,
      movements: (d.movements ?? []).map((m: MovementRow) => ({
        ...m,
        id: crypto.randomUUID(),
        avg_heart_rate: m.avg_heart_rate ?? '',
        zones: m.zones ?? [],
        exercises: m.exercises ?? [],
      })),
      zones: [],
      exercises: [],
      strength_type: d.strength_type ?? 'basis',
      notes: d.notes ?? f.notes,
      tags: d.tags ?? [],
      activities: freshActivities.length > 0 ? freshActivities : f.activities,
      location: d.location ?? f.location,
      template_id: template.id,
      template_name: template.name,
      // «Bruk mal» tagger automatisk økten som denne standardøkten.
      standard_workout_template_id: template.id,
      standard_workout_template_name: template.name,
    }))
  }

  // «Marker som standardøkt»: tagg økten som å representere malen UTEN å hente
  // mal-data (økten beholder egne data, f.eks. fra klokkesynk). Brukes til å
  // følge utviklingen av samme standardøkt over tid i analyse.
  const tagAsStandard = (template: WorkoutTemplate) => {
    setForm(f => ({
      ...f,
      standard_workout_template_id: template.id,
      standard_workout_template_name: template.name,
    }))
    setStandardPickerOpen(false)
  }
  const clearStandard = () => {
    setForm(f => ({ ...f, standard_workout_template_id: null, standard_workout_template_name: null }))
  }

  const openTemplateModal = () => {
    // Forhåndsutfyll mal-navnet med øktens tittel — øktens overskrift blir
    // mal-tittel (redigerbar). Tittelen følger så med tilbake når malen brukes.
    setTemplateName(form.title.trim())
    setTemplateDescription('')
    setTemplateCategory('Annet')
    setTemplateError(null)
    setShowTemplateModal(true)
  }

  const handleSaveTemplate = async () => {
    const name = templateName.trim()
    if (!name) { setTemplateError('Navn er påkrevd'); return }
    setSavingTemplate(true)
    setTemplateError(null)
    const result = await saveAsTemplate({
      name,
      description: templateDescription.trim() || undefined,
      category: templateCategory,
      sport: form.sport,
      activities: form.activities,
      templateData: {
        sport: form.sport,
        workout_type: form.workout_type,
        movements: form.movements,
        notes: form.notes,
        tags: form.tags,
        strength_type: form.strength_type,
        location: form.location,
      },
    })
    setSavingTemplate(false)
    if (result.error) {
      setTemplateError(result.error)
      return
    }
    setShowTemplateModal(false)
    if (templateBuildingMode) {
      if (onTemplateSaved && result.id) onTemplateSaved(result.id)
      else if (onSaved) onSaved()
    }
  }

  const toggleTag = (tag: string) => {
    setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }))
  }

  const [newTag, setNewTag] = useState('')
  const addCustomTag = () => {
    const t = newTag.trim()
    if (t && !form.tags.includes(t)) { set('tags', [...form.tags, t]) }
    setNewTag('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Tittel er påkrevd'); return }
    const payload: WorkoutFormData = {
      ...form,
      is_completed: markingCompleted ? true : (isPlanMode ? false : (form.is_planned ? form.is_completed : true)),
    }
    if (captureOnlyMode) {
      if (onCapture) onCapture(payload)
      return
    }
    setSaving(true); setError(null)
    const result = await saveWorkout(payload, workoutId, targetUserId)
    if (result.error) { setError(result.error); setSaving(false) }
    else {
      // Lagre utstyr-koblinger separat. Hopper over for trener-redigering (ikke
      // egen utstyr-tabell) og når formen er i ren plan-modus uten økt-id.
      const savedId = result.id
      if (savedId && !targetUserId && !isPlanMode && availableEquipment.length > 0) {
        await setWorkoutEquipment(savedId, equipmentIds)
      }
      // Lagre ernæring-rader separat (egen tabell, ikke en del av saveWorkout-
      // payloaden). Skip i plan-modus siden plan-økter ikke har ernæring.
      if (savedId && !isPlanMode && (form.nutrition_entries?.length ?? 0) > 0) {
        await replaceWorkoutNutrition(savedId, form.nutrition_entries ?? [], targetUserId)
      } else if (savedId && !isPlanMode) {
        // Tom liste = brukeren har fjernet alle rader; sørg for at gamle rader
        // slettes også.
        await replaceWorkoutNutrition(savedId, [], targetUserId)
      }
      // Trener oppretter for utøver + Skal delta-chip aktiv → toggle attendance
      // direkte etter at workout er lagret. Krever savedId + showCoachAttendChip
      // (som garanterer at vi er i create-flow med targetUserId satt).
      if (savedId && showCoachAttendChip && coachWillAttend) {
        await toggleAttendanceForWorkout(savedId)
      }
      if (onSaved) onSaved()
      else router.push(isPlanMode ? '/app/plan' : '/app/dagbok')
      router.refresh()
    }
  }

  const workoutTypeOptions = getWorkoutTypes(form.sport)
  const isPlanned   = form.is_planned
  const isCompleted = form.is_completed

  // Date-based locking: execution fields only available today or in the past
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const isFutureDate = form.date > todayStr
  // Vis dagbok-spesifikke felt når: økt er gjennomført, eller vi er i markingCompleted-flyten, eller det er en ren dagbok-økt (ikke plan)
  const showExecutionFields = !isPlanMode && !isFutureDate && (isCompleted || markingCompleted || !isPlanned)
  // "Merk som gjennomført"-CTA vises når en planlagt økt åpnes i Dagbok, i dag eller tidligere, og ikke allerede gjennomført
  const showMarkCompletedCTA = !isPlanMode && isPlanned && !isCompleted && !isFutureDate && !markingCompleted

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-4 space-y-0">
      <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0, minInlineSize: 'auto' }}>

      {/* ── KOBLINGS-KNAPPER (høyt plassert: før tittel/dato/sport).
          Kun for eksisterende økter (workoutId finnes), ikke i template-bygging.
          "Marker som fullført" vises kun i Plan-modus — Dagbok-modus har egen
          CTA lenger ned i samme form. Knappene skjuler seg selv hvis dato er
          fremtidig eller ingen kandidater finnes. ── */}
      {workoutId && !templateBuildingMode && defaultValues && (
        <LinkWorkoutActions
          workoutId={workoutId}
          date={form.date}
          isPlanned={form.is_planned}
          isCompleted={form.is_completed}
          importedFrom={defaultValues.imported_from ?? null}
          alreadyLinked={!!defaultValues.linked_workout_id}
          targetUserId={targetUserId}
          formMode={formMode}
        />
      )}

      {/* ── START ØKT (live styrkeøkt) ──
          Kun utøver (ikke trener/targetUserId), eksisterende styrkeøkt som ikke
          er fullført. Lagrer skjemaet først, så åpnes økt-modus. Fullfør der =
          marker som fullført. ── */}
      {workoutId && !targetUserId && !templateBuildingMode && !captureOnlyMode
        && !readOnly && !form.is_completed && isStrengthWorkout && (
        <button type="button" onClick={startLiveFlow} disabled={startingLive}
          className="w-full mb-4 transition-opacity hover:opacity-90"
          style={{
            background: '#FF4500', color: '#0A0A0B', border: 'none',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '0.06em',
            padding: '12px', cursor: startingLive ? 'default' : 'pointer', opacity: startingLive ? 0.6 : 1,
          }}>
          {startingLive ? 'Starter…' : '▶ Start økt (live)'}
        </button>
      )}

      {/* ── MALER ── */}
      {templates.length > 0 && (
        <div className="mb-4 pb-4" style={{ borderBottom: '1px solid #1A1A1E' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Fra mal:
            </span>
            {templates.map(t => (
              <button key={t.id} type="button" onClick={() => loadTemplate(t)}
                className="px-3 py-1 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: '#8A8A96', background: 'none',
                  border: '1px solid #222228', cursor: 'pointer',
                }}>
                {t.name}
              </button>
            ))}
            <button type="button" onClick={() => setStandardPickerOpen(o => !o)}
              className="px-3 py-1 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: standardPickerOpen ? '#FF4500' : '#555560', background: 'none',
                border: `1px solid ${standardPickerOpen ? '#FF4500' : '#222228'}`, cursor: 'pointer',
              }}>
              + Marker som standardøkt
            </button>
          </div>

          {/* Tagge-modus: velg mal KUN for å tagge (henter ikke mal-data). */}
          {standardPickerOpen && (
            <div className="mt-3 p-3" style={{ background: '#0E0E12', border: '1px solid #1E1E22' }}>
              <p className="text-xs mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1.5 }}>
                Velg standardøkten denne økten representerer. Henter <b>ikke</b> mal-data —
                økten beholder sine egne tall (f.eks. fra klokkesynk).
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {templates.map(t => (
                  <button key={t.id} type="button" onClick={() => tagAsStandard(t)}
                    className="px-3 py-1 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: form.standard_workout_template_id === t.id ? '#FF4500' : '#8A8A96',
                      background: 'none',
                      border: `1px solid ${form.standard_workout_template_id === t.id ? '#FF4500' : '#222228'}`,
                      cursor: 'pointer',
                    }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Aktiv standardøkt-tagg + fjern-knapp. */}
          {form.standard_workout_template_id && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 px-3 py-1 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF8A5C', border: '1px solid #3A2418', background: '#1A0F08' }}>
                ⟳ Standardøkt: {form.standard_workout_template_name ?? 'mal'}
              </span>
              <button type="button" onClick={clearStandard}
                className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', background: 'none', border: 'none', cursor: 'pointer' }}>
                Fjern tagg ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── GRUNNINFO ── */}
      <Section label="Grunninfo">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Tittel</Label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="F.eks. 5×5min terskelintervall" required
              className="w-full px-4 py-3"
              style={iSt} onFocus={e => (e.currentTarget.style.borderColor='#FF4500')}
              onBlur={e => (e.currentTarget.style.borderColor='#1E1E22')} />
          </div>
          <div>
            <Label>Dato</Label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              required style={iSt} className="w-full px-4 py-3" />
          </div>
          <div>
            <Label>Klokkeslett (valgfritt)</Label>
            <input type="time" value={form.time_of_day} onChange={e => set('time_of_day', e.target.value)}
              style={iSt} className="w-full px-4 py-3" />
          </div>
          <div className="md:col-span-2">
            <Label>Sted (valgfritt)</Label>
            <input value={form.location ?? ''} onChange={e => set('location', e.target.value)}
              placeholder="F.eks. Sognsvann, Trysil, Sierra Nevada"
              className="w-full px-4 py-3"
              style={iSt} onFocus={e => (e.currentTarget.style.borderColor='#FF4500')}
              onBlur={e => (e.currentTarget.style.borderColor='#1E1E22')} />
          </div>
          <div className="md:col-span-2">
            <Label>Økttype (valgfritt)</Label>
            {/* Kompakt nedtrekksliste — «Vanlig økt» (other) er default. Taggene
                brukes til analyse-gruppering + «Siste hardøkt» på hjem. */}
            <select
              value={MEANINGFUL_WORKOUT_TYPES.includes(form.workout_type) ? form.workout_type : 'other'}
              onChange={e => set('workout_type', e.target.value as WorkoutType)}
              style={iSt} className="w-full px-4 py-3">
              <option value="other">Vanlig økt</option>
              {workoutTypeOptions
                .filter(t => MEANINGFUL_WORKOUT_TYPES.includes(t.value))
                .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <Chip active={form.is_important} onClick={() => set('is_important', !form.is_important)} color="#FF4500">
            ★ Viktig økt
          </Chip>
          <Chip active={form.is_group_session} onClick={() => set('is_group_session', !form.is_group_session)} color="#1A6FD4">
            👥 Fellestrening
          </Chip>
          {showCoachAttendChip && (
            <Chip active={coachWillAttend} onClick={() => setCoachWillAttend(v => !v)} color="#1A6FD4">
              👥 Skal delta
            </Chip>
          )}
          <Chip active={!!form.is_altitude_training} onClick={() => set('is_altitude_training', !form.is_altitude_training)} color="#5B8DEF">
            🏔️ Høydetrening
          </Chip>
          <Chip active={!!form.is_heat_training} onClick={() => set('is_heat_training', !form.is_heat_training)} color="#E0772B">
            🌡️ Varmetrening
          </Chip>
          {SPECIAL_WORKOUT_TYPES.map(s => (
            <Chip key={s.value} active={form.workout_type === s.value}
              onClick={() => set('workout_type', form.workout_type === s.value ? 'other' : s.value)}
              color={s.color}>
              {s.label}
            </Chip>
          ))}
        </div>

        {inheritedAltitude && (
          <p className="text-xs mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#5B8DEF', lineHeight: 1.5 }}>
            🏔️ Datoen er i høyde­perioden «{inheritedAltitude.period_name}»
            {inheritedAltitude.altitude_meters ? ` (${inheritedAltitude.altitude_meters} moh)` : ''}.
            {form.is_altitude_training && form.altitude_meters != null && form.altitude_meters !== inheritedAltitude.altitude_meters
              ? ` Egen høyde for økten: ${form.altitude_meters} moh (overstyrer perioden).`
              : ' Økten arver høyden fra perioden — sett egen moh under for å overstyre.'}
          </p>
        )}

        {(form.is_altitude_training || form.is_heat_training) && (
          <div className="flex flex-wrap gap-4 mt-3">
            {form.is_altitude_training && (
              <div>
                <label className="text-xs tracking-widest uppercase block mb-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  Høyde (moh){inheritedAltitude && form.altitude_meters == null ? ' — arvet' : ''}
                </label>
                <input
                  type="number" inputMode="numeric" min={0} max={9000} step={50}
                  value={form.altitude_meters ?? ''}
                  onChange={e => set('altitude_meters', e.target.value === '' ? null : Math.round(Number(e.target.value)))}
                  placeholder="f.eks. 1800"
                  className="px-3 py-2 text-sm w-40"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#1A1A22', border: '1px solid #1E1E22', color: '#F0F0F2', outline: 'none' }}
                />
              </div>
            )}
            {form.is_heat_training && (
              <div>
                <label className="text-xs tracking-widest uppercase block mb-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  Kroppstemperatur (°C)
                </label>
                <input
                  type="number" inputMode="decimal" min={34} max={43} step={0.1}
                  value={form.body_temperature ?? ''}
                  onChange={e => set('body_temperature', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="f.eks. 38.5"
                  className="px-3 py-2 text-sm w-40"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: '#1A1A22', border: '1px solid #1E1E22', color: '#F0F0F2', outline: 'none' }}
                />
              </div>
            )}
          </div>
        )}
        {form.is_group_session && (
          <div className="mt-3">
            <label className="text-xs tracking-widest uppercase block mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Etikett (valgfri)
            </label>
            <input
              type="text"
              value={form.group_session_label}
              onChange={e => set('group_session_label', e.target.value)}
              placeholder="f.eks. Tirsdagstrening klubb"
              maxLength={120}
              className="px-3 py-2 text-sm w-full max-w-md"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#1A1A22',
                border: '1px solid #1E1E22',
                color: '#F0F0F2',
                outline: 'none',
              }}
            />
            <p className="text-xs mt-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Flere økter med samme etikett = samme fellestrening i trener-oversikt.
            </p>
          </div>
        )}

        {!isPlanMode && !targetUserId && (
          <div className="mt-4">
            <EquipmentSelectorInWorkout
              available={availableEquipment}
              selectedIds={equipmentIds}
              onChange={setEquipmentIds}
            />
          </div>
        )}
      </Section>

      {/* ── OPPSUMMERING (auto — read-only) ── */}
      {form.activities.length > 0 && (
        <div className="mt-4">
          <ActivitySummary
            activities={form.activities}
            heartZones={heartZones}
            sport={form.sport}
            defaultPaceUnit={defaultPaceUnit}
          />
        </div>
      )}

      {/* ── SAMMENLIGN MED PLAN — togglable ── */}
      {!isPlanMode && (form.planned_activities?.length ?? 0) > 0 && form.activities.length > 0 && (
        <div className="mt-3">
          <button type="button"
            onClick={() => setShowComparison(v => !v)}
            className="px-3 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#FF4500', background: 'none',
              border: '1px solid #FF4500', cursor: 'pointer',
            }}>
            {showComparison ? 'Skjul sammenligning' : 'Sammenlign med plan'}
          </button>
          {showComparison && (
            <div className="mt-3">
              <PlanVsActualComparison
                plan={form.planned_activities ?? []}
                actual={form.activities}
              />
            </div>
          )}
        </div>
      )}

      {/* ── AKTIVITETER (kronologisk liste — erstatter Bevegelsesformer + Skyting) ──
          Plassert høyt i skjemaet siden dette er hovedinnsats-feltet. Test/
          Konkurranse-undersettene under setter ekstra-data og kan auto-generere
          aktivitets-struktur. */}
      <Section label="Aktiviteter">
        <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Legg til hver del av økta i kronologisk rekkefølge. Trykk på en rad for å utvide.
        </p>
        <ActivitiesSection
          rows={form.activities}
          onChange={a => set('activities', a)}
          sport={form.sport}
          userSports={effectiveUserSports}
          activityTypeFavorites={activityTypeFavorites}
          mode={isPlanMode ? 'plan' : 'dagbok'}
          defaultPaceUnit={defaultPaceUnit}
        />
      </Section>

      {/* ── TEST (protokoll + resultat — kun for workout_type='test') ── */}
      {form.workout_type === 'test' && (
        <div className="mt-4">
          <TestDataModule
            data={form.test_data ?? emptyTestData()}
            onChange={d => set('test_data', d)}
            mode={isPlanMode ? 'plan' : 'dagbok'}
          />
        </div>
      )}

      {/* ── KONKURRANSE (kontekst + resultat — kun for competition/testlop) ── */}
      {(form.workout_type === 'competition' || form.workout_type === 'testlop') && (
        <div className="mt-4">
          <CompetitionModule
            data={form.competition_data ?? emptyCompetitionData(form.workout_type === 'testlop' ? 'testlop' : 'konkurranse')}
            onChange={d => set('competition_data', d)}
            sport={form.sport}
            onSportChange={s => handleSportChange(s)}
            mode={isPlanMode ? 'plan' : 'dagbok'}
            activityCount={form.activities.length}
            onRequestGenerate={(format, replaceExisting) => {
              const generated = generateCompetitionActivities(form.sport, format)
              if (generated.length === 0) return
              const confirmMsg = replaceExisting
                ? `Erstatt eksisterende aktiviteter med auto-generert struktur for ${format}?`
                : `Auto-generer aktivitets-struktur for ${format}?`
              if (!window.confirm(confirmMsg)) return
              set('activities', generated)
            }}
          />
        </div>
      )}

      {/* ── ERNÆRING — vises i dagbok-modus (gjennomført økt) ── */}
      {showExecutionFields && (
        <Section label="Ernæring">
          <NutritionSection
            entries={form.nutrition_entries ?? []}
            onChange={(next: NutritionEntryRow[]) => set('nutrition_entries', next)}
            durationMinutes={(() => {
              // Beregn fra aktivitets-summen siden enkel-føring er fjernet.
              // Tom liste eller bare 0-varigheter → null (ingen porsjons-anbefaling).
              const sec = form.activities.reduce(
                (s, a) => s + (parseActivityDuration(a.duration) ?? 0),
                0,
              )
              return sec > 0 ? Math.round(sec / 60) : null
            })()}
            readOnly={readOnly}
          />
        </Section>
      )}

      {/* ── VÆR OG FØRE — kollapset som standard; alle sporter, dagbok-modus ── */}
      {showExecutionFields && (
        <Section label="Vær og føre" collapsible defaultCollapsed
          summary={weatherSummaryLine(form.weather)}>
          <WeatherSection
            value={form.weather ?? emptyWeatherData()}
            onChange={next => set('weather', next)}
            readOnly={readOnly}
          />
        </Section>
      )}

      {/* ── PLAN-REFERANSE (read-only) — vises mens bruker registrerer actuals ── */}
      {markingCompleted && planReference && (
        <PlanReferenceCard plan={planReference} />
      )}

      {/* ── MERK SOM GJENNOMFØRT — CTA for planlagt økt åpnet i Dagbok (i dag / tidligere) ── */}
      {showMarkCompletedCTA && (
        <div className="my-4 p-5" style={{ backgroundColor: 'rgba(40, 168, 110, 0.08)', border: '1px solid #28A86E' }}>
          <p className="text-xs tracking-widest uppercase mb-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
            Planlagt økt
          </p>
          <button type="button"
            onClick={() => { setPlanReference(form); setMarkingCompleted(true) }}
            className="w-full py-4 text-lg font-semibold tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500', color: '#F0F0F2',
              border: 'none', cursor: 'pointer',
            }}>
            ✓ Merk som gjennomført
          </button>
          <p className="mt-3 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Planinnholdet nedenfor forhåndsutfylles — juster til faktiske verdier og legg til dagsform, RPE, tagger og laktat.
          </p>
        </div>
      )}

      {/* Allerede gjennomført — vis status */}
      {isPlanned && isCompleted && !isPlanMode && (
        <div className="my-4 p-3" style={{ backgroundColor: 'rgba(40, 168, 110, 0.08)', borderLeft: '3px solid #28A86E' }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', fontSize: '13px', letterSpacing: '0.1em' }}>
            ✓ GJENNOMFØRT — endringer oppdaterer faktiske verdier (planen bevares i Plan-kalenderen)
          </span>
        </div>
      )}

      {/* ── DAGSFORM ── */}
      {showExecutionFields && !isPlanMode && (
        <Section label="Dagsform og belastning">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Fysisk form</Label>
              <StarRating value={form.day_form_physical} onChange={v => set('day_form_physical', v)} />
            </div>
            <div>
              <Label>Mental form</Label>
              <StarRating value={form.day_form_mental} onChange={v => set('day_form_mental', v)} />
            </div>
            <div>
              <Label>RPE (1–10)</Label>
              <RPESelector value={form.rpe} onChange={v => set('rpe', v)} />
            </div>
          </div>
        </Section>
      )}
      {/* ── NOTATER ── */}
      <Section label={isPlanMode ? 'Notater' : 'Notater og tagger'}>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder={isPlanMode ? 'Beskrivelse av planlagt økt, intensjon, fokuspunkter...' : 'Kommentar, observasjoner, følelse...'}
          rows={3} style={{ ...iSt, resize: 'vertical' }} className="w-full px-4 py-3"
          onFocus={e => (e.currentTarget.style.borderColor = '#FF4500')}
          onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')} />

        {!isPlanMode && (
          <>
            {/* Active tags */}
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {form.tags.map(tag => (
                  <Chip key={tag} active onClick={() => toggleTag(tag)}>
                    {tag} ×
                  </Chip>
                ))}
              </div>
            )}

            {/* Add custom tag */}
            <div className="flex gap-2 mt-3">
              <input value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() }}}
                placeholder="Legg til tagg..."
                className="flex-1 px-3 py-2 text-sm"
                style={{ ...iSt, fontSize: '13px', padding: '8px 12px' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FF4500')}
                onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')} />
              <button type="button" onClick={addCustomTag}
                className="px-4 py-2 text-sm tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                  background: 'none', border: '1px solid #222228', cursor: 'pointer',
                }}>
                + Legg til
              </button>
            </div>
          </>
        )}
      </Section>

      {/* ── KLOKKESYNC-DATA — pulskurve + fartsgraf + lap-tabell + dypere analyse.
          Komponenten henter workout_samples + workout_activities for økten
          og rendrer kun hvis det finnes sample-data eller laps fra import.
          Skjules helt for manuelle Dagbok-økter. Krever workoutId. ── */}
      {workoutId && !templateBuildingMode && (
        <WorkoutKlokkesyncSection workoutId={workoutId} importedFrom={defaultValues?.imported_from ?? null} />
      )}

      {/* Strava API Agreement § 2.3 — synlig attribusjon for Strava-data. */}
      {workoutId && defaultValues?.imported_from === 'strava' && (
        <div className="my-4 flex justify-center">
          <PoweredByStravaAttribution />
        </div>
      )}

      {/* ── SUBMIT ── */}
      <div className="pt-4 pb-8" hidden={readOnly}>
        {error && (
          <p className="mb-3 px-3 py-2 text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)' }}>
            {error}
          </p>
        )}

        {/* Mobil: full-bredde primær øverst, avbryt under. Desktop: side om side. */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3">
          {templateBuildingMode ? (
            <button type="button" onClick={openTemplateModal}
              className="flex-1 py-4 text-lg font-semibold tracking-widest uppercase transition-opacity"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#FF4500', color: '#F0F0F2', border: 'none',
                cursor: 'pointer',
              }}>
              Lagre som mal
            </button>
          ) : captureOnlyMode ? (
            <button type="submit"
              className="flex-1 py-4 text-lg font-semibold tracking-widest uppercase transition-opacity"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#1A6FD4', color: '#F0F0F2', border: 'none',
                cursor: 'pointer',
              }}>
              {captureSubmitLabel ?? 'Lagre til mal'}
            </button>
          ) : (
            <button type="submit" disabled={saving}
              className="flex-1 py-4 text-lg font-semibold tracking-widest uppercase transition-opacity"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: saving ? '#7A2200' : '#FF4500',
                color: '#F0F0F2', border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}>
              {saving
                ? 'Lagrer...'
                : markingCompleted
                ? '✓ Lagre som gjennomført'
                : workoutId
                ? 'Lagre endringer'
                : isPlanMode
                ? 'Lagre plan'
                : 'Lagre økt'}
            </button>
          )}
          <button type="button" onClick={() => onCancel ? onCancel() : router.back()}
            className="w-full sm:w-auto px-6 py-4 text-lg tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              backgroundColor: 'transparent', border: '1px solid #222228', cursor: 'pointer',
            }}>
            Avbryt
          </button>
        </div>

        {/* Save as template — sekundær CTA; skjules i template-building/capture-modus. */}
        {!templateBuildingMode && !captureOnlyMode && (
          <button type="button" onClick={openTemplateModal}
            className="w-full flex items-center justify-center gap-2 py-3 text-base tracking-widest uppercase transition-colors hover:bg-[rgba(255,69,0,0.08)]"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
              background: 'transparent', border: '1px solid #FF4500',
              cursor: 'pointer',
            }}>
            <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>🔖</span>
            Lagre som mal
          </button>
        )}
      </div>

      {showTemplateModal && (
        <SaveAsTemplateModal
          name={templateName}
          description={templateDescription}
          category={templateCategory}
          sportLabel={SPORTS.find(s => s.value === form.sport)?.label ?? form.sport}
          onName={setTemplateName}
          onDescription={setTemplateDescription}
          onCategory={setTemplateCategory}
          onCancel={() => setShowTemplateModal(false)}
          onSave={handleSaveTemplate}
          saving={savingTemplate}
          error={templateError}
        />
      )}
      </fieldset>
      {readOnly && (
        <div className="px-4 pb-6">
          <button type="button" onClick={() => onCancel ? onCancel() : router.back()}
            className="w-full sm:w-auto px-6 py-3 text-base tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              backgroundColor: 'transparent', border: '1px solid #222228', cursor: 'pointer',
            }}>
            Lukk
          </button>
        </div>
      )}
    </form>
  )
}

function SaveAsTemplateModal({
  name, description, category, sportLabel,
  onName, onDescription, onCategory,
  onCancel, onSave, saving, error,
}: {
  name: string
  description: string
  category: string
  sportLabel: string
  onName: (v: string) => void
  onDescription: (v: string) => void
  onCategory: (v: string) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  error: string | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onCancel}>
      <div className="w-full max-w-md p-5"
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
        <div className="flex items-center gap-2 mb-4">
          <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
            Lagre som mal
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block mb-1 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Navn *
            </label>
            <input value={name} onChange={e => onName(e.target.value)}
              placeholder="F.eks. 5×5min terskel"
              autoFocus
              style={iSt} className="w-full px-3 py-2" />
          </div>

          <div>
            <label className="block mb-1 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Beskrivelse
            </label>
            <textarea value={description} onChange={e => onDescription(e.target.value)}
              rows={2} placeholder="Valgfri kort beskrivelse"
              style={{ ...iSt, resize: 'vertical' }} className="w-full px-3 py-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Kategori
              </label>
              <select value={category} onChange={e => onCategory(e.target.value)}
                style={iSt} className="w-full px-3 py-2">
                {TEMPLATE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Sport
              </label>
              <div className="w-full px-3 py-2"
                style={{
                  ...iSt, color: '#8A8A96',
                  display: 'flex', alignItems: 'center', height: '100%',
                }}>
                {sportLabel}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
                backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)',
              }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onSave} disabled={saving}
            className="flex-1 py-2 text-sm tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: saving ? '#7A2200' : '#FF4500', color: '#F0F0F2',
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            }}>
            {saving ? 'Lagrer...' : 'Lagre mal'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #222228', cursor: 'pointer',
            }}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared helpers ──

function PlanReferenceCard({ plan }: { plan: WorkoutFormData }) {
  const totalMinutes = plan.movements.reduce((s, m) => s + (parseInt(m.minutes) || 0), 0)
  const totalKm = plan.movements.reduce((s, m) => s + (parseFloat(m.distance_km) || 0), 0)
  const zoneTotals: Record<string, number> = {}
  for (const m of plan.movements) {
    for (const z of m.zones ?? []) {
      const n = parseInt(z.minutes) || 0
      if (n > 0) zoneTotals[z.zone_name] = (zoneTotals[z.zone_name] ?? 0) + n
    }
  }
  const zones = Object.entries(zoneTotals)
  const movements = plan.movements.filter(m => m.movement_name && (m.minutes || m.distance_km))
  return (
    <div className="my-4 p-4" style={{ border: '1px solid #222228', backgroundColor: '#0D0D11' }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: '12px', height: '2px', backgroundColor: '#555560', display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Plan (referanse)
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '13px' }}>
        <div>
          <div className="text-xs" style={{ color: '#555560' }}>Varighet</div>
          <div>{totalMinutes > 0 ? `${totalMinutes} min` : '—'}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: '#555560' }}>Distanse</div>
          <div>{totalKm > 0 ? `${totalKm.toFixed(1)} km` : '—'}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: '#555560' }}>Type</div>
          <div>{plan.workout_type}</div>
        </div>
      </div>
      {movements.length > 0 && (
        <div className="mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '13px' }}>
          <div className="text-xs mb-1" style={{ color: '#555560' }}>Bevegelsesformer</div>
          <div className="flex flex-wrap gap-2">
            {movements.map((m, i) => (
              <span key={i} style={{ border: '1px solid #222228', padding: '2px 8px' }}>
                {m.movement_name}
                {m.minutes ? ` · ${m.minutes} min` : ''}
                {m.distance_km ? ` · ${m.distance_km} km` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {zones.length > 0 && (
        <div className="mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '13px' }}>
          <div className="text-xs mb-1" style={{ color: '#555560' }}>Soner</div>
          <div className="flex flex-wrap gap-2">
            {zones.map(([name, mins]) => (
              <span key={name} style={{ border: '1px solid #222228', padding: '2px 8px' }}>
                {name} · {mins} min
              </span>
            ))}
          </div>
        </div>
      )}
      {plan.notes && (
        <div className="mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC', fontSize: '13px' }}>
          <div className="text-xs mb-1" style={{ color: '#555560' }}>Notater</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{plan.notes}</div>
        </div>
      )}
    </div>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', outline: 'none',
}

function Section({ label, children, collapsible = false, defaultCollapsed = false, summary }: {
  label: string
  children: React.ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
  summary?: string | null
}) {
  const [open, setOpen] = useState(!defaultCollapsed)
  const header = (
    <div className="flex items-center gap-3 py-4" style={{ borderBottom: '1px solid #1E1E22' }}>
      <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block', flexShrink: 0 }} />
      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.1em', flexShrink: 0 }}>
        {label}
      </h3>
      {collapsible && (
        <>
          <span className="text-xs" style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {summary || '— ikke satt'}
          </span>
          <span style={{ color: '#8A8A96', fontSize: 12, flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
        </>
      )}
    </div>
  )
  if (!collapsible) {
    return (
      <div className="mb-1">
        {header}
        <div className="py-5">{children}</div>
      </div>
    )
  }
  return (
    <div className="mb-1">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full text-left" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        {header}
      </button>
      {open && <div className="py-5">{children}</div>}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1.5 text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {children}
    </label>
  )
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
          style={{ fontSize: '22px', color: (value ?? 0) >= n ? '#FF4500' : '#2A2A30', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 1 }}>
          ★
        </button>
      ))}
    </div>
  )
}

function RPESelector({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-0.5 flex-wrap mt-1">
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
          className="w-7 h-7 text-xs font-semibold"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            backgroundColor: value === n ? '#FF4500' : '#1C1C21',
            color: value === n ? '#F0F0F2' : '#555560',
            border: `1px solid ${value === n ? '#FF4500' : '#222228'}`, cursor: 'pointer',
          }}>
          {n}
        </button>
      ))}
    </div>
  )
}

function Chip({ active, onClick, children, color = '#555560' }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string
}) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1 text-sm tracking-widest uppercase transition-colors"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: active ? `${color}22` : 'transparent',
        color: active ? color : '#555560',
        border: `1px solid ${active ? color : '#222228'}`, cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

