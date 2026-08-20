'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { saveWorkout, markCompleted } from '@/app/actions/workouts'
import { listMySessionSeries, createSessionSeries, type StandardSessionSeries } from '@/app/actions/standard-sessions'
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
  MOVEMENT_CATEGORIES,
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
import { parseDecimal } from '@/lib/parse-decimal'
import { xpConfirm, xpAlert } from '@/components/ui/ConfirmDialog'
import { OKT_MAL_BIBLIOTEK, OKT_MAL_TYPER } from '@/lib/okt-template-library'
import { oktMalTilWorkoutTemplate, normaliserMalSok } from '@/lib/okt-mal-kopi'
import { showCompletionCheck } from '@/lib/interactions'

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
  // Fra øktoversikten: start «Merk som gjennomført»-flyten automatisk når
  // skjemaet åpnes (planlagt dagbok-økt, i dag/passert).
  autoMarkCompleted?: boolean
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
    shooting_type: a.shooting_type ?? (a.is_dry_training ? 'torrtrening' : ''),
    shooting_is_innskyting: a.shooting_is_innskyting ?? (a.activity_type === 'skyting_innskyting'),
    shooting_is_test: a.shooting_is_test ?? false,
    shooting_surface: a.shooting_surface ?? '',
    shooting_test_ref: a.shooting_test_ref ?? '',
    shooting_series: (a.shooting_series ?? []).map(s => ({
      ...s, id: crypto.randomUUID(), points: s.points ?? '',
      // Kø #49: eldre maler mangler feltene; vind er uansett instansdata
      // og skal aldri følge med fra mal.
      vind_retning: null, vind_styrke: null, sikt: null,
    })),
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

export function WorkoutForm({ initialSport = 'running', userSports, activityTypeFavorites, initialDate, workoutId, defaultValues, templates = [], formMode = 'dagbok', heartZones = [], onSaved, onCancel, readOnly = false, autoMarkCompleted = false, templateBuildingMode = false, onTemplateSaved, captureOnlyMode = false, onCapture, captureSubmitLabel, onDirtyChange, targetUserId, defaultPaceUnit = null, availableEquipment = [], initialEquipmentIds = [] }: WorkoutFormProps) {
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
  // Kø #49: «Marker som test» — test-mal er vanlig øktmal m/ is_test-flagg.
  const [templateIsTest, setTemplateIsTest] = useState(false)
  // Fase 97: økttype + «mal som standardøkt» (serie-kobling) i lagre-modalen.
  const [templateOktType, setTemplateOktType] = useState('')
  const [templateSerieId, setTemplateSerieId] = useState('')
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  // Aktiveres når bruker trykker "✓ Merk som gjennomført" på en planlagt økt i Dagbok.
  // Viser full dagbok-utfylling med plan-verdier forhåndsutfylt. Ved lagring settes is_completed=true.
  // planReference: frosset kopi av planen som vises read-only øverst mens bruker redigerer actuals.
  const [markingCompleted, setMarkingCompleted] = useState(false)
  // Plan-modus: koblings-status fra LinkWorkoutActions (null = ukjent ennå).
  // Marker-knappen i topp-CTA-raden vises kun når økten IKKE er koblet.
  const [planLinked, setPlanLinked] = useState<boolean | null>(null)
  const [markingBusy, setMarkingBusy] = useState(false)
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
    standard_session_series_id:     defaultValues?.standard_session_series_id ?? null,
    standard_session_series_name:   defaultValues?.standard_session_series_name ?? null,
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

  // Kø #48 bolk 2: standardøkt-SERIE-velger (erstatter mal-tagge-modusen).
  // Serier lastes lazily første gang seksjonen trengs (forslag/velger).
  const [standardPickerOpen, setStandardPickerOpen] = useState(false)
  const [seriesList, setSeriesList] = useState<StandardSessionSeries[] | null>(null)
  const [serieSearch, setSerieSearch] = useState('')
  const [newSerieName, setNewSerieName] = useState<string | null>(null)
  const [newSerieSted, setNewSerieSted] = useState('')
  const [serieSuggestionDismissed, setSerieSuggestionDismissed] = useState(false)
  useEffect(() => {
    if (readOnly) return
    let cancelled = false
    listMySessionSeries()
      .then(res => { if (!cancelled) setSeriesList(Array.isArray(res) ? res : []) })
      .catch(() => { if (!cancelled) setSeriesList([]) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Smart forslag (kjerneprinsipp 2): mal og/eller sted matcher en serie →
  // FORESLÅ, aldri auto-koble. Vises én gang per åpnet skjema.
  const serieSuggestion = useMemo(() => {
    if (!seriesList || form.standard_session_series_id || serieSuggestionDismissed) return null
    const loc = form.location?.trim().toLowerCase()
    return seriesList.find(s =>
      (form.template_id && s.template_id === form.template_id)
      || (loc && s.location && s.location.trim().toLowerCase() === loc)
    ) ?? null
  }, [seriesList, form.standard_session_series_id, form.template_id, form.location, serieSuggestionDismissed])

  // Mal-kategorisering: filtrer «Fra mal»-lista på bevegelsesform og
  // kategori når lista er stor (>4). Union-opsjoner fra malene selv —
  // samme kilde/logikk som /app/maler-filteret.
  const [malMovement, setMalMovement] = useState('')
  const [malCategory, setMalCategory] = useState('')
  const [malType, setMalType] = useState('')
  const [malSok, setMalSok] = useState('')
  // Fase 97: bibliotekets 58 vises SAMMEN med brukerens egne. Stabile id-er
  // (bib_<ref>) så React-keys ikke flakker; sport følger skjemaet.
  // Biblioteket endres ALDRI på plass — valg fyller kun skjemaet.
  const bibliotekMaler = useMemo(
    () => OKT_MAL_BIBLIOTEK.map(m =>
      oktMalTilWorkoutTemplate(m, { sport: form.sport }, { id: `bib_${m.ref}` })),
    [form.sport])
  const erBibliotekMal = (t: WorkoutTemplate) => t.id.startsWith('bib_')
  const alleMaler = useMemo(() => [...templates, ...bibliotekMaler], [templates, bibliotekMaler])
  const malMovementOptions = useMemo(() => {
    // Fasiten for bevegelsesformer er MOVEMENT_CATEGORIES — union med det
    // malene faktisk bruker (dekker egne/eldre navn).
    const s = new Set<string>(MOVEMENT_CATEGORIES.map(c => c.name))
    for (const t of templates) for (const a of t.activities ?? []) {
      if (a.movement_name) s.add(a.movement_name)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'nb'))
  }, [templates])
  const malCategoryOptions = useMemo(() => {
    const s = new Set<string>()
    for (const t of templates) if (t.category) s.add(t.category)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'nb'))
  }, [templates])
  const visibleTemplates = useMemo(() => alleMaler.filter(t => {
    // Bibliotekmaler har åpen bevegelsesform/kategori — de filtreres aldri
    // bort av de to aksene, kun av økttype og søk.
    if (malMovement && !erBibliotekMal(t)
      && !(t.activities ?? []).some(a => a.movement_name === malMovement)) return false
    if (malCategory && !erBibliotekMal(t) && t.category !== malCategory) return false
    if (malType && t.okt_type !== malType) return false
    // Normalisert søk: «6x6» treffer «6 × 6 min / 2 min».
    if (malSok.trim() && !normaliserMalSok(t.name).includes(normaliserMalSok(malSok))) return false
    return true
  }), [alleMaler, malMovement, malCategory, malType, malSok])
  const showMalFilters = alleMaler.length > 4

  // Live økt-modus: vises kun for utøvers egne styrkeøkter (ikke trener).
  const [startingLive, setStartingLive] = useState(false)
  const isStrengthWorkout = (form.activities ?? []).some(
    a => (a.exercises?.length ?? 0) > 0 || a.movement_name === 'Styrke',
  )
  const startLiveFlow = async () => {
    if (!workoutId || startingLive) return
    setStartingLive(true)
    const res = await saveWorkout(form, workoutId, targetUserId)
    if (res.error) { setStartingLive(false); void xpAlert(res.error); return }
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
      // Kø #49: økt fra test-mal får 🧪 forhåndsvalgt (kan fjernes før lagring).
      workout_type: template.is_test ? 'test' : (d.workout_type ?? f.workout_type),
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
      // workouts.template_id er uuid-FK — bibliotekets pseudo-id (bib_<ref>)
      // skal aldri dit. Bibliotekmal gir navn, ikke kobling.
      template_id: erBibliotekMal(template) ? null : template.id,
      template_name: template.name,
      // Kø #48 (kjerneprinsipp 2): mal-bruk gjør ALDRI økta automatisk til
      // standardøkt — MED ETT UNNTAK (fase 97): mal eksplisitt merket som
      // standardøkt forhåndsvelger serien sin. Endrebar/fjernbar som alltid.
      ...(template.standard_session_series_id
        ? {
            standard_session_series_id: template.standard_session_series_id,
            standard_session_series_name:
              seriesList?.find(se => se.id === template.standard_session_series_id)?.name ?? null,
          }
        : {}),
    }))
  }

  // Kø #48 bolk 2: serie-kobling — aldri automatikk, alltid aktivt valg.
  const selectSerie = (s: StandardSessionSeries) => {
    setForm(f => ({ ...f, standard_session_series_id: s.id, standard_session_series_name: s.name }))
    setStandardPickerOpen(false)
  }
  const clearSerie = () => {
    setForm(f => ({ ...f, standard_session_series_id: null, standard_session_series_name: null }))
  }
  const createSerie = async () => {
    const name = (newSerieName ?? '').trim()
    if (!name) return
    const res = await createSessionSeries({
      name,
      location: newSerieSted,
      sport: form.sport,
      template_id: form.template_id ?? null,
    })
    if (res.id) {
      setSeriesList(null)
      const created: StandardSessionSeries = {
        id: res.id, name, sport: form.sport, movement_name: null,
        location: newSerieSted.trim() || null,
        template_id: form.template_id ?? null, description: null,
        workout_count: 0, last_date: null,
      }
      listMySessionSeries().then(r => setSeriesList(Array.isArray(r) ? r : [created]))
      selectSerie(created)
      setNewSerieName(null)
      setNewSerieSted('')
    }
  }

  const openTemplateModal = () => {
    // Forhåndsutfyll mal-navnet med øktens tittel — øktens overskrift blir
    // mal-tittel (redigerbar). Tittelen følger så med tilbake når malen brukes.
    setTemplateName(form.title.trim())
    setTemplateDescription('')
    setTemplateCategory('Annet')
    // 🧪 forhåndsvelges når økta selv er markert som test.
    setTemplateIsTest(form.workout_type === 'test')
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
      isTest: templateIsTest,
      oktType: templateOktType || null,
      standardSessionSeriesId: templateSerieId || null,
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
      if (markingCompleted) showCompletionCheck()
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
  // Start live (styrke): samme vilkår som før — utøver, eksisterende planlagt
  // styrkeøkt som ikke er fullført.
  const showStartLive = !!workoutId && !targetUserId && !templateBuildingMode && !captureOnlyMode
    && !readOnly && form.is_planned && !form.is_completed && isStrengthWorkout
  // Plan-modusens «Marker som fullført» (løftet fra LinkWorkoutActions):
  // samme vilkår som der — planlagt, ikke koblet, ikke fullført, ikke fremtid.
  const showPlanMarkCTA = isPlanMode && !!workoutId && !templateBuildingMode && !captureOnlyMode
    && !readOnly && form.is_planned && !form.is_completed && !isFutureDate && planLinked === false

  // Auto-start markeringsflyten når skjemaet åpnes fra øktoversiktens
  // «Marker som gjennomført» (samme handling som CTA-knappen — én gang).
  useEffect(() => {
    if (!autoMarkCompleted) return
    if (isPlanMode || !isPlanned || isCompleted || isFutureDate || markingCompleted) return
    setPlanReference(form)
    setMarkingCompleted(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMarkCompleted])

  const handlePlanMarkCompleted = async () => {
    if (markingBusy || !workoutId) return
    setMarkingBusy(true)
    setError(null)
    const res = await markCompleted(workoutId, targetUserId)
    if (res.error) { setError(res.error); setMarkingBusy(false); return }
    // Samme oppfølging som LinkWorkoutActions: åpne dagbok-redigering så
    // faktiske verdier kan fylles inn med en gang.
    router.push(`/app/dagbok?edit=${workoutId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="xp-form max-w-3xl mx-auto px-4 py-4 space-y-0">
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
          hideMarkCompleted={isPlanMode}
          onLinkStateChange={setPlanLinked}
        />
      )}

      {/* ── TOPP-CTA-RAD: Merk som gjennomført + Start live (styrke) ──
          Side om side øverst når begge gjelder; ellers alene i full bredde.
          Samme handlere/vilkår som før — kun plassering og stil. ── */}
      {(showMarkCompletedCTA || showStartLive || showPlanMarkCTA) && (
        <div className="mb-4">
          <div className="flex gap-2">
            {showPlanMarkCTA && (
              <button type="button" onClick={handlePlanMarkCompleted} disabled={markingBusy}
                className="transition-opacity hover:opacity-90"
                style={{
                  flex: 1, fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, fontSize: 15, letterSpacing: '0.13em',
                  textTransform: 'uppercase', backgroundColor: '#28A86E',
                  color: '#fff', border: '1px solid #28A86E', borderRadius: 12,
                  padding: '13px 10px',
                  cursor: markingBusy ? 'default' : 'pointer',
                  opacity: markingBusy ? 0.6 : 1,
                  boxShadow: '0 6px 24px rgba(40,168,110,0.18)',
                }}>
                {markingBusy ? 'Markerer…' : '✓ Marker som fullført'}
              </button>
            )}
            {showMarkCompletedCTA && (
              <button type="button"
                onClick={() => { setPlanReference(form); setMarkingCompleted(true) }}
                className="transition-opacity hover:opacity-90"
                style={{
                  flex: 1, fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, fontSize: 15, letterSpacing: '0.13em',
                  textTransform: 'uppercase', backgroundColor: '#28A86E',
                  color: '#fff', border: '1px solid #28A86E', borderRadius: 12,
                  padding: '13px 10px', cursor: 'pointer',
                  boxShadow: '0 6px 24px rgba(40,168,110,0.18)',
                }}>
                ✓ Merk som gjennomført
              </button>
            )}
            {showStartLive && (
              <button type="button" onClick={startLiveFlow} disabled={startingLive}
                className="transition-opacity hover:opacity-90"
                style={{
                  flex: 1, fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, fontSize: 15, letterSpacing: '0.13em',
                  textTransform: 'uppercase', backgroundColor: 'var(--accent)',
                  color: '#fff', border: '1px solid var(--accent)', borderRadius: 12,
                  padding: '13px 10px',
                  cursor: startingLive ? 'default' : 'pointer',
                  opacity: startingLive ? 0.6 : 1,
                  boxShadow: '0 6px 24px var(--accent-soft)',
                }}>
                {startingLive ? 'Starter…' : '▶ Start live'}
              </button>
            )}
          </div>
          {showMarkCompletedCTA && (
            <p className="mt-2 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Planinnholdet forhåndsutfylles — juster til faktiske verdier og legg til dagsform, RPE, tagger og laktat.
            </p>
          )}
        </div>
      )}

      {/* ── MALER ── */}
      {(
        <div className="mb-2">
          {/* Kategorisering av mal-lista (bev.form + kategori) ved >4 maler. */}
          {showMalFilters && (
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {malMovementOptions.length > 0 && (
                <select value={malMovement} onChange={e => setMalMovement(e.target.value)}
                  style={{
                    backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
                    borderRadius: 'var(--r-field)', color: malMovement ? 'var(--accent)' : '#8A8A96',
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                    padding: '6px 8px', outline: 'none', minHeight: 34,
                  }}>
                  <option value="">Alle bev.former</option>
                  {malMovementOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
              <select value={malType} onChange={e => setMalType(e.target.value)}
                style={{
                  backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
                  borderRadius: 'var(--r-field)', color: malType ? 'var(--accent)' : '#8A8A96',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                  padding: '6px 8px', outline: 'none', minHeight: 34,
                }}>
                <option value="">Alle økttyper</option>
                {OKT_MAL_TYPER.map(t => <option key={t.verdi} value={t.verdi}>{t.etikett}</option>)}
              </select>
              <input value={malSok} onChange={e => setMalSok(e.target.value)}
                placeholder="Søk (f.eks. 6x6)…"
                style={{
                  backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
                  borderRadius: 'var(--r-field)', color: '#F0F0F2',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                  padding: '6px 10px', outline: 'none', minHeight: 34, width: 150,
                }} />
              {malCategoryOptions.length > 1 && (
                <select value={malCategory} onChange={e => setMalCategory(e.target.value)}
                  style={{
                    backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
                    borderRadius: 'var(--r-field)', color: malCategory ? 'var(--accent)' : '#8A8A96',
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                    padding: '6px 8px', outline: 'none', minHeight: 34,
                  }}>
                  <option value="">Alle kategorier</option>
                  {malCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          )}
          <div className="xp-malrow" style={{ maxHeight: 150, overflowY: 'auto' }}>
            <span className="xp-mal-label">Fra mal</span>
            {visibleTemplates.length === 0 && (
              <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Ingen maler matcher filtrene
              </span>
            )}
            {visibleTemplates.map(t => (
              <button key={t.id} type="button" onClick={() => loadTemplate(t)} className="xp-mal"
                style={erBibliotekMal(t) ? { color: '#A0A0AC', borderStyle: 'dashed' } : undefined}
                title={erBibliotekMal(t) ? 'Fra biblioteket — alt kan endres etter valg' : undefined}>
                {erBibliotekMal(t) ? '📚 ' : ''}{t.is_test ? '🧪 ' : ''}{t.standard_session_series_id ? '⟳ ' : ''}{t.name}
              </button>
            ))}
            {/* ⟳ Standardøkt bor nå i markerings-raden (chip) — fristilt fra
                mal-flaten. Serie-velgeren under åpnes derfra. */}
          </div>

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
              onBlur={e => (e.currentTarget.style.borderColor='#1F1F26')} />
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
              onBlur={e => (e.currentTarget.style.borderColor='#1F1F26')} />
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

        {/* Chip-raden. DOM-rekkefølgen ER mobil-rekkefølgen: markeringer,
            høyde/varme, så økttypene. Under sm er alle tre gruppene
            `contents` — wrapperne forsvinner ut av layouten og chipene flyter
            i én rad som brytes naturlig, akkurat som før grupperingen fantes.

            Fra sm og opp legger et grid dem på plass:

              [markeringer          ] [høyde]
              [økttyper             ] [varme]

            Grid og ikke `order` på flex, fordi visuell rekkefølge og
            DOM-rekkefølge her IKKE er like — grid plasserer gruppene
            eksplisitt uten å endre rekkefølgen for skjermlesere og
            tastaturnavigasjon.

            RAD 1 HOLDES KORT MED VILJE: «Bygg intervall» og mal-knappene
            skal inn der senere, og da må det være plass igjen. */}
        <div className="flex flex-wrap gap-3 mt-4
                        sm:grid sm:grid-cols-[1fr_auto] sm:gap-x-3 sm:gap-y-2 sm:items-start">
          <div className="contents sm:flex sm:flex-wrap sm:gap-3 sm:col-start-1 sm:row-start-1">
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
          </div>

          {/* Kort tekst med vilje — ikonet bærer betydningen, og plassen
              trengs i rad 1. Lesevisningene (WorkoutOverview, WorkoutCard,
              Calendar, AltitudeHeatTab) beholder «Høydetrening»/«Varmetrening»:
              der står ikonet ikke nødvendigvis ved siden av, og «Høyde» alene
              kan like gjerne bety høydemeter. */}
          <div className="contents sm:flex sm:flex-col sm:gap-2 sm:items-end
                          sm:col-start-2 sm:row-start-1 sm:row-span-2">
            <Chip active={!!form.is_altitude_training} onClick={() => set('is_altitude_training', !form.is_altitude_training)} color="#5B8DEF">
              🏔️ Høyde
            </Chip>
            <Chip active={!!form.is_heat_training} onClick={() => set('is_heat_training', !form.is_heat_training)} color="#E0772B">
              🌡️ Varme
            </Chip>
          </div>

          <div className="contents sm:flex sm:flex-wrap sm:gap-3 sm:col-start-1 sm:row-start-2">
            {SPECIAL_WORKOUT_TYPES.map(s => (
              <Chip key={s.value} active={form.workout_type === s.value}
                onClick={() => set('workout_type', form.workout_type === s.value ? 'other' : s.value)}
                color={s.color}>
                {s.label}
              </Chip>
            ))}
            {/* Fase 97: standardøkt som markering — én chip blant markeringene,
                fristilt fra mal-flaten. Virker for alle opphav (manuell, mal,
                klokkesynk-importert). Trykk = serie-velger; aktiv chip viser
                serien; trykk på aktiv = fjern kobling (bekreft hvis ført). */}
            <Chip active={!!form.standard_session_series_id || standardPickerOpen}
              onClick={() => { void (async () => {
                if (form.standard_session_series_id) {
                  if (form.is_completed && !await xpConfirm(
                    `Fjerne koblingen til «${form.standard_session_series_name ?? 'serien'}»?`)) return
                  clearSerie()
                } else {
                  setStandardPickerOpen(o => !o)
                }
              })() }}
              color="#FF8A5C">
              ⟳ {form.standard_session_series_id
                ? (form.standard_session_series_name ?? 'Standardøkt')
                : 'Standardøkt'}
            </Chip>
          </div>
        </div>

        {/* Serie-UI (velger/aktiv kobling) — åpnes fra ⟳-chipen over. */}
          {/* Kø #48 bolk 2: smart forslag — mal/sted matcher en serie.
              Aldri automatikk; dismissbart, vises én gang per skjema. */}
          {serieSuggestion && !standardPickerOpen && (
            <div className="mt-2 mb-1 p-3 flex flex-wrap items-center gap-2"
              style={{ background: '#1A0F08', border: '1px solid #3A2418', borderRadius: 'var(--r-field)' }}>
              <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF8A5C' }}>
                ⟳ Legg til i serien «{serieSuggestion.name}»?
              </span>
              <button type="button" onClick={() => selectSerie(serieSuggestion)}
                className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#0A0A0B', background: '#FF8A5C', border: 'none', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}>
                Ja
              </button>
              <button type="button" onClick={() => setSerieSuggestionDismissed(true)}
                className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', background: 'none', border: '1px solid var(--line2)', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>
                Nei takk
              </button>
            </div>
          )}

          {/* Serie-velgeren: søkbar liste + opprett ny inline. */}
          {standardPickerOpen && (
            <div className="mt-1 mb-3 p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)' }}>
              <p className="text-xs mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1.5 }}>
                Koble økta til en <b>standardøkt-serie</b> — samme økt over tid, sammenlignbar i analysen.
                Henter <b>ikke</b> mal-data; økta beholder sine egne tall.
              </p>
              {(seriesList?.length ?? 0) > 4 && (
                <input value={serieSearch} onChange={e => setSerieSearch(e.target.value)}
                  placeholder="Søk i serier…"
                  className="mb-2 px-3 py-2 w-full text-sm"
                  style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", outline: 'none' }} />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {seriesList === null && (
                  <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Laster serier…</span>
                )}
                {(seriesList ?? [])
                  .filter(s => !serieSearch.trim() || s.name.toLowerCase().includes(serieSearch.trim().toLowerCase()))
                  .map(s => (
                    <button key={s.id} type="button" onClick={() => selectSerie(s)}
                      className="px-3 py-1.5 text-sm transition-opacity hover:opacity-80"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: form.standard_session_series_id === s.id ? '#FF8A5C' : '#C0C0CC',
                        background: form.standard_session_series_id === s.id ? '#1A0F08' : 'none',
                        border: `1px solid ${form.standard_session_series_id === s.id ? '#FF450088' : '#222228'}`,
                        borderRadius: 999, cursor: 'pointer', minHeight: 36,
                      }}>
                      {s.name}
                      <span style={{ color: '#555560', marginLeft: 6, fontSize: 12 }}>
                        {s.workout_count}×{s.location ? ` · ${s.location}` : ''}
                      </span>
                    </button>
                  ))}
                {newSerieName === null ? (
                  <button type="button" onClick={() => setNewSerieName(form.title.trim())}
                    className="px-3 py-1.5 text-sm"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', background: 'none', border: '1px dashed var(--line2)', borderRadius: 999, cursor: 'pointer', minHeight: 36 }}>
                    + Ny serie
                  </button>
                ) : (
                  <span className="flex items-center gap-2 flex-wrap">
                    <input value={newSerieName} onChange={e => setNewSerieName(e.target.value)}
                      placeholder="Navn på serien"
                      style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, padding: '8px 10px', minHeight: 36, width: 170, outline: 'none' }} />
                    <input value={newSerieSted} onChange={e => setNewSerieSted(e.target.value)}
                      placeholder="Sted (valgfritt)"
                      style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, padding: '8px 10px', minHeight: 36, width: 140, outline: 'none' }} />
                    <button type="button" onClick={() => { void createSerie() }}
                      disabled={!(newSerieName ?? '').trim()}
                      className="text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#0A0A0B', background: '#FF8A5C', border: 'none', borderRadius: 999, padding: '8px 14px', minHeight: 36, cursor: 'pointer', fontWeight: 700 }}>
                      Opprett
                    </button>
                    <button type="button" onClick={() => { setNewSerieName(null); setNewSerieSted('') }} aria-label="Avbryt"
                      style={{ color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer', minHeight: 36, minWidth: 32 }}>✕</button>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Aktiv serie-kobling: fjern / bytt / hopp til sammenligning. */}
          {form.standard_session_series_id && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 px-3 py-1 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF8A5C', border: '1px solid #3A2418', background: '#1A0F08', borderRadius: 999 }}>
                ⟳ Standardøkt: {form.standard_session_series_name ?? 'serie'}
              </span>
              <button type="button" onClick={() => setStandardPickerOpen(true)}
                className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer' }}>
                Bytt serie
              </button>
              <button type="button" onClick={clearSerie}
                className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', background: 'none', border: 'none', cursor: 'pointer' }}>
                Fjern kobling ✕
              </button>
              <a href={`/app/analyse?tab=standardokter&serie=${form.standard_session_series_id}`}
                className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#1A6FD4', textDecoration: 'none' }}>
                Se utvikling →
              </a>
            </div>
          )}

          {/* Legacy-tagg (før serie-modellen) uten serie-kobling — vises
              lesbart til bolk 6-oppryddingen; ny kobling via velgeren over. */}
          {!form.standard_session_series_id && form.standard_workout_template_id && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 px-3 py-1 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', border: '1px solid var(--line2)', background: 'none', borderRadius: 999 }}>
                ⟳ Standardøkt (gammel tagg): {form.standard_workout_template_name ?? 'mal'}
              </span>
            </div>
          )}


        {/* B2 (kø #39): arven kommer fra MARKERINGSLAGET (dag-presis) —
            teksten sier «høyde-oppholdet», ikke belastningsperioden. */}
        {inheritedAltitude && (
          <p className="text-xs mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#5B8DEF', lineHeight: 1.5 }}>
            🏔️ Datoen er i høyde-oppholdet «{inheritedAltitude.period_name}»
            {inheritedAltitude.altitude_meters ? ` (${inheritedAltitude.altitude_meters} moh)` : ''}.
            {form.is_altitude_training && form.altitude_meters != null && form.altitude_meters !== inheritedAltitude.altitude_meters
              ? ` Egen høyde for økten: ${form.altitude_meters} moh (overstyrer oppholdet).`
              : ' Økten arver høyden fra oppholdet — sett egen moh under for å overstyre.'}
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
          workoutType={form.workout_type}
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
            onRequestGenerate={async (format, replaceExisting) => {
              const generated = generateCompetitionActivities(form.sport, format)
              if (generated.length === 0) return
              const confirmMsg = replaceExisting
                ? `Erstatt eksisterende aktiviteter med auto-generert struktur for ${format}?`
                : `Auto-generer aktivitets-struktur for ${format}?`
              if (!await xpConfirm(confirmMsg)) return
              set('activities', generated)
            }}
          />
        </div>
      )}

      {/* ── ERNÆRING — vises i dagbok-modus (gjennomført økt) ── */}
      {showExecutionFields && (
        <Section label="Ernæring" collapsible
          defaultCollapsed={(form.nutrition_entries?.length ?? 0) === 0}
          summary={(form.nutrition_entries?.length ?? 0) > 0 ? `${form.nutrition_entries?.length} rader` : 'Ingen rader'}>
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
      {/* «Merk som gjennomført» ligger nå i topp-CTA-raden øverst i skjemaet. */}

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

      {/* ── SUBMIT — sticky savebar i modalens scroll-container ──
          Sticky MÅ ligge på denne wrapperen: containing block er da hele
          <form>-en, så baren følger med i bunnen av viewporten gjennom hele
          skjemaet. (.xp-savebar sin egen sticky er virkningsløs alene fordi
          forelderen er like høy som baren selv.) ── */}
      <div className="pt-2 pb-2" hidden={readOnly}
        style={{ position: 'sticky', bottom: 0, zIndex: 40 }}>
        {error && (
          <p className="mb-3 px-3 py-2 text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)', borderRadius: 'var(--r-field)' }}>
            {error}
          </p>
        )}

        <div className="xp-savebar">
          <button type="button" onClick={() => onCancel ? onCancel() : router.back()}
            className="xp-btn xp-ghost">
            Avbryt
          </button>
          {templateBuildingMode ? (
            <button type="button" onClick={openTemplateModal} className="xp-btn xp-primary">
              Lagre som mal
            </button>
          ) : captureOnlyMode ? (
            <button type="submit" className="xp-btn xp-primary"
              style={{ backgroundColor: 'var(--blue)', borderColor: 'var(--blue)', boxShadow: '0 6px 24px var(--blue-soft)' }}>
              {captureSubmitLabel ?? 'Lagre til mal'}
            </button>
          ) : (
            <button type="submit" disabled={saving} className="xp-btn xp-primary">
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
          {/* Save as template — sekundær CTA; skjules i template-building/capture-modus. */}
          {!templateBuildingMode && !captureOnlyMode && (
            <button type="button" onClick={openTemplateModal}
              className="xp-btn xp-icon" title="Lagre som mal" aria-label="Lagre som mal">
              🔖
            </button>
          )}
        </div>
      </div>

      {showTemplateModal && (
        <SaveAsTemplateModal
          name={templateName}
          description={templateDescription}
          category={templateCategory}
          sportLabel={SPORTS.find(s => s.value === form.sport)?.label ?? form.sport}
          isTest={templateIsTest}
          oktType={templateOktType}
          serieId={templateSerieId}
          seriesList={seriesList ?? []}
          onOktType={setTemplateOktType}
          onSerieId={setTemplateSerieId}
          onName={setTemplateName}
          onDescription={setTemplateDescription}
          onCategory={setTemplateCategory}
          onIsTest={setTemplateIsTest}
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
  name, description, category, sportLabel, isTest,
  oktType, serieId, seriesList,
  onName, onDescription, onCategory, onIsTest, onOktType, onSerieId,
  onCancel, onSave, saving, error,
}: {
  name: string
  description: string
  category: string
  sportLabel: string
  isTest: boolean
  oktType: string
  serieId: string
  seriesList: StandardSessionSeries[]
  onOktType: (v: string) => void
  onSerieId: (v: string) => void
  onName: (v: string) => void
  onDescription: (v: string) => void
  onCategory: (v: string) => void
  onIsTest: (v: boolean) => void
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

          {/* Kø #49: test-mal = vanlig øktmal m/ flagg. Økt fra test-mal
              får 🧪 forhåndsvalgt (kan fjernes før lagring). */}
          <button type="button" onClick={() => onIsTest(!isTest)}
            className="inline-flex items-center gap-2 mt-3"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
              letterSpacing: '0.05em', borderRadius: 999, padding: '6px 12px',
              minHeight: 36, cursor: 'pointer',
              color: isTest ? '#F0F0F2' : '#8A8A96',
              background: isTest ? '#D4A01722' : 'transparent',
              border: `1px solid ${isTest ? '#D4A017' : '#222228'}`,
            }}>
            🧪 Marker som test
            <span style={{ color: '#555560', fontSize: 12 }}>
              {isTest ? 'økter fra malen får 🧪' : 'valgfritt'}
            </span>
          </button>

          {/* Fase 97: økttype (fasit = OKT_MAL_TYPER) — brukes av filteret i
              mal-velgeren og stempler økter laget fra malen. Valgfritt. */}
          <div className="mt-3">
            <label className="block text-xs mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', letterSpacing: '0.05em' }}>
              Økttype (valgfritt)
            </label>
            <select value={oktType} onChange={e => onOktType(e.target.value)}
              className="w-full px-3 py-2"
              style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, outline: 'none' }}>
              <option value="">— Ingen —</option>
              {OKT_MAL_TYPER.map(t => <option key={t.verdi} value={t.verdi}>{t.etikett}</option>)}
            </select>
          </div>

          {/* Fase 97: mal som standardøkt — økter fra malen får serien
              forhåndsvalgt (endrebar før lagring). Malen viser ⟳-badge. */}
          {seriesList.length > 0 && (
            <div className="mt-3">
              <label className="block text-xs mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF8A5C', letterSpacing: '0.05em' }}>
                ⟳ Standardøkt-serie (valgfritt)
              </label>
              <select value={serieId} onChange={e => onSerieId(e.target.value)}
                className="w-full px-3 py-2"
                style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, outline: 'none' }}>
                <option value="">— Ikke standardøkt —</option>
                {seriesList.map(se => <option key={se.id} value={se.id}>{se.name}</option>)}
              </select>
            </div>
          )}

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
  const totalKm = plan.movements.reduce((s, m) => s + (parseDecimal(m.distance_km) || 0), 0)
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
  backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
  borderRadius: 'var(--r-field)',
  color: 'var(--ink)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', outline: 'none',
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
    <div className="xp-card-h">
      <span className="xp-num xp-num-auto" aria-hidden="true" />
      <h3 className="xp-card-title" style={{ flexShrink: 0 }}>{label}</h3>
      {collapsible && (
        <>
          <span className="xp-card-hint" style={{
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', textAlign: 'right',
          }}>
            {summary || '— ikke satt'}
          </span>
          <span className="xp-chev">▶</span>
        </>
      )}
    </div>
  )
  if (!collapsible) {
    return (
      <div className="xp-card xp-card-form open">
        {header}
        <div className="xp-card-b">{children}</div>
      </div>
    )
  }
  return (
    <div className={`xp-card xp-card-form${open ? ' open' : ''}`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full text-left" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block' }}>
        {header}
      </button>
      {open && <div className="xp-card-b">{children}</div>}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="xp-label" style={{ marginTop: 0 }}>{children}</label>
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
          style={{ fontSize: '26px', color: (value ?? 0) >= n ? 'var(--i3)' : 'var(--line2)', textShadow: (value ?? 0) >= n ? '0 0 12px rgba(232,185,60,.35)' : 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 1 }}>
          ★
        </button>
      ))}
    </div>
  )
}

const RPE_COLORS = ['#28A86E', '#3BA45C', '#63A94A', '#8FAC3C', '#BCA735', '#E8B93C', '#F09A2E', '#FF8C00', '#F0592B', '#E23A5A']

function RPESelector({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
          className="w-8 h-8 text-sm font-bold"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: value === n ? RPE_COLORS[n - 1] : 'var(--card2)',
            color: value === n ? '#fff' : 'var(--mut)',
            border: `1px solid ${value === n ? 'transparent' : 'var(--line2)'}`,
            borderRadius: 8,
            boxShadow: value === n ? '0 0 14px var(--accent-soft)' : 'none',
            cursor: 'pointer',
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
      className="text-sm uppercase transition-colors inline-flex items-center gap-2"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
        backgroundColor: active ? `${color}22` : 'transparent',
        color: active ? color : 'var(--mut)',
        border: `1px solid ${active ? color : 'var(--line2)'}`,
        borderRadius: 999, padding: '9px 14px', letterSpacing: '.09em',
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

