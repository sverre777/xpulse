'use client'

import { StarRating } from '@/components/ui/StarRating'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { saveWorkout, markCompleted } from '@/app/actions/workouts'
import { listMySessionSeries, createSessionSeries, type StandardSessionSeries } from '@/app/actions/standard-sessions'
import { getAltitudePeriodForDate } from '@/app/actions/seasons'
import { saveAsTemplate } from '@/app/actions/templates'
import { flyttHurtigLager } from '@/lib/hurtig-lager'
import { setWorkoutEquipment } from '@/app/actions/equipment'
import { replaceWorkoutNutrition } from '@/app/actions/nutrition'
import { TrenerChip } from '@/components/coach/TrenerChip'
import { toggleAttendanceForWorkout } from '@/app/actions/trainer-calendar'
import {
  WorkoutFormData, MovementRow, LactateRow,
  Sport, SPORTS, DEFAULT_MOVEMENTS_BY_SPORT,
  getWorkoutTypes, WorkoutType, WorkoutTemplate, TEMPLATE_CATEGORIES,
  CompetitionData, emptyCompetitionData, generateCompetitionActivities,
  TestData, emptyTestData, findTestPRSport, type TestPRSport,
  ActivityRow, ActivityType, emptyActivityZones, makeActivity,
  NutritionEntryRow, emptyWeatherData,
  MOVEMENT_CATEGORIES,
} from '@/lib/types'
import { parseActivityDuration } from '@/lib/activity-duration'
import type { Equipment } from '@/lib/equipment-types'
import { ActivitiesSection } from './ActivitiesSection'
import { OktbyggerPopup } from './Oktbygger'
import { PlottTreffPopup } from './PlottTreff'
import { IntervallBygger } from './IntervallBygger'
import { KonkurransePanel, TESTSPORT_TIL_SPORT, type PanelType } from './KonkurransePanel'
import { createPortal } from 'react-dom'
import { OktmalBuilder } from '@/components/coach/OktmalBuilder'
import { getKeyDateForWorkout, updateKeyDatePriority, type WorkoutKeyDateLink } from '@/app/actions/seasons'
import { ActivitySummary } from './ActivitySummary'
import { WorkoutKlokkesyncSection } from './WorkoutKlokkesyncSection'
import { useKlokkedata } from './useKlokkedata'
import { getWorkoutForEdit } from '@/app/actions/workouts'
import { beregnSegmenter } from '@/lib/segmenter'
import { justerEtterVarighetsendring, klokkeslettTilSek } from '@/lib/oktbygger-rader'
import { nyttTidspunktNotat, type TidspunktNotat } from '@/lib/tidspunkt-notater'
import { LinkWorkoutActions } from './LinkWorkoutActions'
import { PoweredByStravaAttribution } from '@/components/strava/StravaBrand'
import { PlanVsActualComparison } from './PlanVsActualComparison'
import { NutritionSection } from './NutritionSection'
import { WeatherSection, weatherSummaryLine } from './WeatherSection'
import { EquipmentSelectorInWorkout } from '@/components/equipment/EquipmentSelectorInWorkout'
import { HeartZone } from '@/lib/heart-zones'
import { parseDecimal } from '@/lib/parse-decimal'
import { xpConfirm, xpAlert } from '@/components/ui/ConfirmDialog'
import { RpeSkala } from '@/components/ui/RpeSkala'
import { OKT_MAL_BIBLIOTEK, OKT_MAL_TYPER, finnOktMal, erTestMal, type OktMalDef } from '@/lib/okt-template-library'
import { oktMalTilWorkoutTemplate, normaliserMalSok, oktMalTilIntervallOppsett, oktTypeToWorkoutType } from '@/lib/okt-mal-kopi'
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
  /** Åpne Øktbyggeren med én gang (fra hovedsidas knapp). */
  apneOktbygger?: boolean
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
  // Utstyr bolk 4: per-aktivitet-overstyringer (⇄), keyet på sort_order
  // (= radindeks) siden DB-idene byttes ved hver lagring.
  initialActivityEquipment?: Record<number, string[]>
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


/** Bolk 26: punktene i økta som PLASSERINGER for en mal — sekund + slag,
    aldri verdiene: laktat uten mmol, ernæring uten gram, notat med teksten
    (teksten er planen). Laktat- og ernæringsrader (klokkeslett / minutt)
    blir planlagte punkter på samme sekund. */
function malPunkter(form: WorkoutFormData): TidspunktNotat[] {
  const start = klokkeslettTilSek(form.time_of_day)
  const ut: TidspunktNotat[] = (form.tidspunkt_notater ?? []).map(p =>
    p.type === 'ernaering'
      ? { ...p, id: crypto.randomUUID(), planlagt: true, ernaering: {} }
      : { ...p, id: crypto.randomUUID(), planlagt: true })
  for (const l of form.lactate ?? []) {
    if (!l.measured_at_time) continue
    const sek = klokkeslettTilSek(l.measured_at_time) - start
    if (sek >= 0) ut.push(nyttTidspunktNotat('laktat', sek, true))
  }
  for (const n of form.nutrition_entries ?? []) {
    const min = Number(n.time_offset_minutes)
    if (n.time_offset_minutes === '' || !Number.isFinite(min)) continue
    ut.push(nyttTidspunktNotat('ernaering', min * 60, true))
  }
  return ut.sort((a, b) => a.sek - b.sek)
}

export function WorkoutForm({ initialSport = 'running', userSports, activityTypeFavorites, initialDate, workoutId, defaultValues, templates = [], formMode = 'dagbok', heartZones = [], onSaved, onCancel, readOnly = false, autoMarkCompleted = false, templateBuildingMode = false, onTemplateSaved, captureOnlyMode = false, onCapture, captureSubmitLabel, onDirtyChange, apneOktbygger = false, targetUserId, defaultPaceUnit = null, availableEquipment = [], initialEquipmentIds = [], initialActivityEquipment = {} }: WorkoutFormProps) {
  const effectiveUserSports: Sport[] = userSports ?? [initialSport]
  const router = useRouter()
  const isPlanMode = formMode === 'plan'
  // Trener oppretter ny økt for utøver: vis "Skal delta"-chip ved siden av
  // Fellestrening. Etter saveWorkout fires toggleAttendanceForWorkout(id).
  // For redigering håndterer TrainerAttendanceSection i WorkoutModal saken.
  const showCoachAttendChip = !!targetUserId && !workoutId

  // #50 bolk 1 / SF-2 del 1: er økta koblet fra årsplanen, åpner panelet
  // ferdig koblet — navn/format/prioritet arvet inn i TOMME felt.
  useEffect(() => {
    if (!workoutId) return
    let aktiv = true
    getKeyDateForWorkout(workoutId).then(kd => {
      if (!aktiv || !kd) return
      setKeyDate(kd)
      setForm(f => {
        const cd = f.competition_data ?? emptyCompetitionData()
        return {
          ...f,
          competition_data: {
            ...cd,
            name: cd.name.trim() === '' ? kd.name : cd.name,
            location: cd.location.trim() === '' ? (kd.location ?? '') : cd.location,
            distance_format: cd.distance_format === '' ? (kd.distance_format ?? '') : cd.distance_format,
          },
        }
      })
    })
    return () => { aktiv = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId])
  const [coachWillAttend, setCoachWillAttend] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateCategory, setTemplateCategory] = useState<string>('Annet')
  // Sport i «Lagre som mal» er redigerbar (Sverre 22. aug) — synces til
  // øktas sport når modalen åpnes (form deklareres lenger ned).
  const [templateSport, setTemplateSport] = useState<Sport>(initialSport)
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
    forventet_belastning: defaultValues?.forventet_belastning ?? null,
    tidspunkt_notater: defaultValues?.tidspunkt_notater ?? [],
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
  // ⚡ Øktbygger fra knapperaden — ALLTID: plan og dagbok, med og uten
  // lagret økt. Hurtigoppsettet skriver radene rett i skjemaet.
  // Bolk 20: på en NY økt (plan eller dagbok) er byggeren brukbar uten
  // lagring — radene bygges i minnet og lagres sammen med økta. Den åpner
  // seg IKKE av seg selv på Logg/Planlegg (Sverre 5. sep) — bare fra knappen.
  const [visOktbygger, setVisOktbygger] = useState(!!apneOktbygger)
  // Skyting kun for skiskyttere: mal-linjas «Skyting»-chip bare når personen har skiskyting.
  const harSkiForm = useHarSkiskyting(userSports)
  // Klokkedata hentes ÉN gang for skjemaet og deles av oppsummeringskortet
  // (grafen, live) og klokkeseksjonen (rundetabell). Bumpes når byggeren
  // har skrevet til basen.
  const [klokkeTick, setKlokkeTick] = useState(0)
  const klokke = useKlokkedata(workoutId && !templateBuildingMode ? workoutId : null, klokkeTick)
  // Segmentbåndet LIVE fra skjemaets egne rader: type og varighet herfra,
  // proveniens og lagret vindu fra serveren (radInfo, nøklet på rad-id).
  const liveSegmenter = useMemo(() => {
    const d = klokke.data
    if (!d || d.totalSek <= 0) return []
    return beregnSegmenter(form.activities.map(a => {
      const info = a.db_id ? d.radInfo[a.db_id] : undefined
      const tall = (v: string) => { const n = parseInt(v); return Number.isFinite(n) ? n : null }
      return {
        id: a.db_id ?? a.id,
        activity_type: a.activity_type,
        movement_name: a.movement_name || null,
        duration_seconds: parseActivityDuration(a.duration) ?? 0,
        // Raden eier vinduet sitt (bolk 3); serverens kopi er reserve for
        // rader som ble lastet før feltet fantes på raden.
        window_start_seconds: a.window_start_seconds !== undefined ? a.window_start_seconds : (info?.window_start_seconds ?? null),
        window_duration_seconds: a.window_duration_seconds !== undefined ? a.window_duration_seconds : (info?.window_duration_seconds ?? null),
        prone_shots: tall(a.prone_shots), prone_hits: tall(a.prone_hits),
        standing_shots: tall(a.standing_shots), standing_hits: tall(a.standing_hits),
        harKlokkeProveniens: info?.harKlokkeProveniens ?? false,
        gruppeId: info?.gruppeId ?? null,
      }
    }), d.totalSek)
  }, [form.activities, klokke.data])
  // Grunnlaget byggeren plasserer radene på — samme som båndet.
  const plassGrunnlag = useMemo(() => ({
    totalSek: klokke.data?.totalSek ?? 0,
    harKurve: !!klokke.data?.samples && Object.values(klokke.data.samples).some(v => v && (v as unknown[]).length > 0),
    radInfo: klokke.data?.radInfo ?? {},
  }), [klokke.data])
  /** Skjemaets varighetsfelt og byggerens tall er SAMME grense. */
  const settAktiviteter = (neste: ActivityRow[]) =>
    set('activities', justerEtterVarighetsendring(form.activities, neste, plassGrunnlag))
  /** Etter et rundebytte (skriver til basen) hentes radene inn på nytt —
      resten av utkastet står. */
  const hentRaderFraBasen = async () => {
    if (!workoutId) return
    const d = await getWorkoutForEdit(workoutId, isPlanMode ? 'plan' : 'dagbok', targetUserId)
    if (d?.activities) set('activities', d.activities)
    setKlokkeTick(t => t + 1)
  }
  // «Plott treff» (bolk B) — vises i knapperaden når økta har skyting.
  const [visPlottTreff, setVisPlottTreff] = useState(false)
  // Seriene skrives til basen av pop-upen; skjemaets draft må oppdateres i
  // samme slengen, ellers ville neste «Lagre endringer» skrevet tilbake de
  // gamle seriene (regel 11 — én sannhet, ikke to drafts).
  const flettInnLagredeSerier = (
    lagret: Array<{ activityId: string; serier: ActivityRow['shooting_series'] }>,
  ) => {
    setForm(f => ({
      ...f,
      activities: (f.activities ?? []).map(a => {
        const t = a.db_id ? lagret.find(l => l.activityId === a.db_id) : undefined
        return t ? { ...a, shooting_series: t.serier } : a
      }),
    }))
  }

  // Kø #48 bolk 2: standardøkt-SERIE-velger (erstatter mal-tagge-modusen).
  // Serier lastes lazily første gang seksjonen trengs (forslag/velger).
  const [standardPickerOpen, setStandardPickerOpen] = useState(false)
  // #50: årsplan-kobling — key-daten som peker på økta (SF-2 del 1).
  const [keyDate, setKeyDate] = useState<WorkoutKeyDateLink | null>(null)
  // #50 bolk 2: «+ Ny mal» fra panelet — struktur-byggeren i egen popup.
  // Portal til body: WorkoutForm er selv et <form>, og OktmalBuilder rendrer
  // sitt eget — nøstede skjemaer er ugyldig HTML.
  const [visNyMalBygger, setVisNyMalBygger] = useState(false)
  // Bibliotekmal valgt → generator-dialog forhåndsutfylt fra malens blokker.
  const [malBygger, setMalBygger] = useState<OktMalDef | null>(null)
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
  // #50 bolk 2: hurtigfilter-chips — samme sett som /app/maler + Standardøkt.
  const [malHurtig, setMalHurtig] = useState<'alle' | 'test' | 'skyting' | 'styrke' | 'standard'>('alle')
  // Fase 97: bibliotekets 58 vises SAMMEN med brukerens egne. Stabile id-er
  // (bib_<ref>) så React-keys ikke flakker; sport følger skjemaet.
  // Biblioteket endres ALDRI på plass — valg fyller kun skjemaet.
  // Skyting kun for skiskyttere: komb-/skytemalene i biblioteket (mal.skyting)
  // tilbys bare når personen har skiskyting.
  const bibliotekMaler = useMemo(
    () => OKT_MAL_BIBLIOTEK.filter(m => harSkiForm || !m.skyting).map(m =>
      oktMalTilWorkoutTemplate(m, { sport: form.sport }, { id: `bib_${m.ref}` })),
    [form.sport, harSkiForm])
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
    if (malHurtig !== 'alle') {
      // NB: gamle mal-snapshots kan mangle felter på radene (før fase 85/7.1)
      // — alt må leses null-sikkert, ellers krasjer filteret hele sida.
      const acts = t.activities ?? []
      if (malHurtig === 'test' && !t.is_test) return false
      if (malHurtig === 'skyting' && !acts.some(a =>
        (a?.activity_type ?? '').startsWith('skyting') || (a?.shooting_series?.length ?? 0) > 0)) return false
      if (malHurtig === 'styrke' && !acts.some(a =>
        (a?.exercises?.length ?? 0) > 0 || a?.movement_name === 'Styrke')) return false
      if (malHurtig === 'standard' && !t.standard_session_series_id) return false
    }
    return true
  }), [alleMaler, malMovement, malCategory, malType, malSok, malHurtig])
  const showMalFilters = alleMaler.length > 4

  // Live økt-modus: vises kun for utøvers egne styrkeøkter (ikke trener).
  const [startingLive, setStartingLive] = useState(false)
  const isStrengthWorkout = (form.activities ?? []).some(
    a => (a.exercises?.length ?? 0) > 0 || a.movement_name === 'Styrke',
  )
  const startLiveFlow = async () => {
    if (!workoutId || startingLive) return
    setStartingLive(true)
    const res = await saveWorkout({ ...form, fjernedeAktivitetsIds: beregnFjernedeRadIds() }, workoutId, targetUserId)
    if (res.error) { setStartingLive(false); void xpAlert(res.error); return }
    router.push(`/app/okt/${workoutId}`)
  }

  // Fase 77 + quick fix (Sverre 28. aug): arv av høyde fra årsplan-periode.
  // Når øktens dato faller i en høyde-periode, arver økta automatisk
  // høydetrening + periodens moh — også EKSISTERENDE økter som åpnes:
  // hint-setningen lover at økta arver høyden, og da skal chipen faktisk
  // stå markert og moh være satt (persisteres ved lagring). Egen moh
  // vinner alltid (?? -fallback), og en alt markert økt røres ikke.
  const [inheritedAltitude, setInheritedAltitude] = useState<{ altitude_meters: number | null; period_name: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!form.date) { setInheritedAltitude(null); return }
    getAltitudePeriodForDate(form.date, targetUserId).then(res => {
      if (cancelled) return
      setInheritedAltitude(res)
      if (res) {
        // Auto-arv når økta ikke alt er markert — nye OG eksisterende.
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

  // Valgt test-mal i konkurransepanelets test-fane — gull-markering i
  // velgeren (selve koblingen persisteres via test_data.test_type/tittel).
  const [valgtTestMalId, setValgtTestMalId] = useState<string | null>(null)

  // Utstyr-valg for økten. Endres uavhengig av form-state; lagres separat etter saveWorkout.
  const [equipmentIds, setEquipmentIds] = useState<string[]>(initialEquipmentIds)
  // Bolk 4: ⇄-overstyringer per aktivitetsrad, keyet på radens klient-id.
  // Initialiseres fra sort_order-nøklene (radindeks ved innlasting).
  const [activityEquipment, setActivityEquipment] = useState<Record<string, string[]>>(() => {
    const res: Record<string, string[]> = {}
    for (const [soStr, ids] of Object.entries(initialActivityEquipment)) {
      const row = form.activities[parseInt(soStr)]
      if (row && ids.length > 0) res[row.id] = ids
    }
    return res
  })

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

  // ÉN regel for hva et test-valg gjør med skjemaet — uansett inngang
  // (panelets testvelger, skytetest-biblioteket, mal-velgeren i toppen eller
  // bibliotek-byggeren): 🧪 økt-type, og tittel + testpanelets «Navn på
  // testen» + test_type fra testens navn, så resultatet lagres som resultat
  // AV den testen. Tomme felter fylles — utfylte røres aldri.
  const testFelter = (f: WorkoutFormData, navn: string, sportHint?: Sport | null): Partial<WorkoutFormData> => {
    const td = f.test_data ?? emptyTestData()
    // Protokoll-sporten auto-fylles fra malens/øktas sport (baklengs mapping)
    // — kun når feltet står tomt, som alt annet her.
    const protokollSport = sportHint
      ? (Object.entries(TESTSPORT_TIL_SPORT).find(([, s]) => s === sportHint)?.[0] ?? '')
      : ''
    return {
      workout_type: 'test',
      title: f.title.trim() === '' ? navn : f.title,
      test_data: {
        ...td,
        custom_label: td.custom_label.trim() === '' ? navn : td.custom_label,
        test_type: td.test_type.trim() === '' ? navn : td.test_type,
        sport: td.sport === '' ? (protokollSport as typeof td.sport) : td.sport,
      },
    }
  }

  // Bevegelsesform/underkategori i byggerens rader → testprotokollens
  // sport/underkategori (beste treff mot TestPR-taksonomien; rulleski-
  // variantene mappes til langrenns «Rulleski skøyting/klassisk»).
  const MOVEMENT_TIL_PROTOKOLL: Record<string, TestPRSport> = {
    'Løping': 'lop', 'Langrenn': 'langrenn', 'Rulleski': 'langrenn',
    'Rulleski på mølle': 'langrenn', 'SkiErg': 'langrenn',
    'Sykling': 'sykling', 'Svømming': 'svomming', 'Styrke': 'styrke',
  }
  const protokollFraRader = (rader: ActivityRow[]): { sport: TestPRSport | null; subcategory: string } => {
    const rad = rader.find(r => r.movement_name && MOVEMENT_TIL_PROTOKOLL[r.movement_name])
    if (!rad) return { sport: null, subcategory: '' }
    const sport = MOVEMENT_TIL_PROTOKOLL[rad.movement_name]
    let sub = rad.movement_subcategory || ''
    if (rad.movement_name.startsWith('Rulleski')) {
      sub = sub === 'Skøyting' ? 'Rulleski skøyting' : sub === 'Klassisk' ? 'Rulleski klassisk' : sub
    }
    if (rad.movement_name === 'Sykling' && sub === 'Spinning') sub = 'Innendørs'
    // Kun underkategorier som finnes i protokollens liste — ellers tomt.
    const def = findTestPRSport(sport)
    return { sport, subcategory: def?.subcategories.includes(sub) ? sub : '' }
  }

  const loadTemplate = (template: WorkoutTemplate) => {
    const d = template.template_data ?? ({} as WorkoutFormData)
    // Generer nye klient-id-er + safe defaults for alle felt så ikke gamle
    // mal-snapshots krasjer render i ActivitiesSection.
    const freshActivities = (template.activities ?? []).map(normalizeActivityRowFromTemplate)
    // Test-mal valgt (uansett fra mal-velgeren i toppen eller panelet):
    // testpanelet fylles automatisk og malen gull-markeres i testvelgeren.
    setValgtTestMalId(template.is_test ? template.id : null)
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
      // Bolk 26: malens punkt-plasseringer kommer inn som planlagte punkter
      // (hule markører) — verdiene fylles i økta.
      tidspunkt_notater: (d.tidspunkt_notater ?? []).length > 0
        ? (d.tidspunkt_notater ?? []).map(p => ({ ...p, id: crypto.randomUUID(), planlagt: true }))
        : f.tidspunkt_notater,
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
      // Test-mal: fyll testpanelet (navn/test_type/sport) — tittel settes over.
      ...(template.is_test
        ? testFelter({ ...f, title: template.name || f.title }, template.name,
            template.sport ?? d.sport ?? f.sport)
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
    setTemplateSport(form.sport)
    setShowTemplateModal(true)
  }

  const handleSaveTemplate = async () => {
    const name = templateName.trim()
    if (!name) { setTemplateError('Navn er påkrevd'); return }
    setSavingTemplate(true)
    setTemplateError(null)
    // try/catch: et KASTET unntak fra server-actionen (ikke {error}) lot
    // spinneren stå for alltid uten spor (meldt fra bruk 21. aug).
    let result: Awaited<ReturnType<typeof saveAsTemplate>>
    try {
      // Test-/konkurranse-/testløp-mal: kategori/økttype/standardøkt er ikke
      // valg — typen ER gitt (feltene er skjult i modalen og settes
      // deterministisk her). Test-flagget vinner over konkurranse/testløp.
      const malKind = templateIsTest ? 'test'
        : form.workout_type === 'competition' ? 'konkurranse'
        : form.workout_type === 'testlop' ? 'testlop'
        : null
      result = await saveAsTemplate({
      name,
      description: templateDescription.trim() || undefined,
      category: malKind === 'test' ? 'Test'
        : malKind === 'konkurranse' ? 'Konkurranse'
        : malKind === 'testlop' ? 'Testløp'
        : templateCategory,
      sport: templateSport,
      activities: form.activities,
      templateData: {
        sport: templateSport,
        workout_type: form.workout_type,
        movements: form.movements,
        notes: form.notes,
        tags: form.tags,
        strength_type: form.strength_type,
        location: form.location,
        // Bolk 26: punktene som PLASSERINGER (laktat/ernæring/notat), ikke verdier.
        tidspunkt_notater: malPunkter(form),
      },
      isTest: templateIsTest,
      oktType: malKind === 'test' ? 'test' : (malKind ? null : (templateOktType || null)),
      standardSessionSeriesId: malKind ? null : (templateSerieId || null),
      })
    } catch (e) {
      console.error('saveAsTemplate kastet:', e)
      setTemplateError(e instanceof Error ? e.message : 'Lagringen feilet — prøv igjen')
      setSavingTemplate(false)
      return
    }
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

  // Søkefeltet i mal-velgeren står på filterlinja på desktop og på mal-linja
  // på mobil (SF-16: maks 3 rader). Samme felt, samme state — bare to
  // monteringspunkter, der CSS viser ett av dem.
  const malSokFelt = (className: string, bredde: number) => (
    <input value={malSok} onChange={e => setMalSok(e.target.value)}
      placeholder="Søk (f.eks. 6x6)…"
      className={className}
      style={{
        backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-field)', color: 'var(--tekst-1-app)',
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
        padding: '6px 10px', outline: 'none', minHeight: 34, width: bredde,
      }} />
  )

  const toggleTag = (tag: string) => {
    setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }))
  }

  const [newTag, setNewTag] = useState('')
  const addCustomTag = () => {
    const t = newTag.trim()
    if (t && !form.tags.includes(t)) { set('tags', [...form.tags, t]) }
    setNewTag('')
  }

  // Fase 113/114-vern del 2: hvilke rader brukeren FJERNET (lastet minus
  // nåværende). Sendes alltid (også tom) så saveWorkout sletter målrettet —
  // rader skapt utenfor skjemaet etter innlasting overlever.
  const beregnFjernedeRadIds = (): string[] => {
    const lastet = (defaultValues?.activities ?? []).map(a => a.db_id).filter((id): id is string => !!id)
    const naa = new Set((form.activities ?? []).map(a => a.db_id).filter(Boolean))
    return lastet.filter(id => !naa.has(id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Tittel er påkrevd'); return }
    const payload: WorkoutFormData = {
      ...form,
      is_completed: markingCompleted ? true : (isPlanMode ? false : (form.is_planned ? form.is_completed : true)),
      fjernedeAktivitetsIds: beregnFjernedeRadIds(),
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
      // egen utstyr-tabell) og for mal-/capture-modus (ingen økt å koble til).
      // Plan-modus lagrer også: utstyr kan PLANLEGGES — km/tid telles først når
      // økta markeres gjennomført (lib/equipment-usage).
      const savedId = result.id
      // Husket hurtigoppsett (Sverre 5. sep): en ny økt bygde under «ny» —
      // oppsettet følger økta til id-en så «Endre / opprett på nytt» virker.
      if (savedId && !workoutId) flyttHurtigLager('ny', savedId)
      if (savedId && !targetUserId && !templateBuildingMode && availableEquipment.length > 0) {
        // Bolk 4: arv («hele økta») + ⇄-overstyringer per aktivitet. Radene
        // identifiseres med sort_order = radindeks — samme rekkefølge som
        // insertActivitiesWithChildren skriver dem. I plan-modus viser skjemaet
        // planens frosne aktiviteter, så da skrives kun arven og eksisterende
        // ⇄-overstyringer blir liggende urørt.
        await setWorkoutEquipment(savedId, isPlanMode ? {
          heleOkta: equipmentIds,
          perAktivitet: [],
          bevarOverstyringer: true,
        } : {
          heleOkta: equipmentIds,
          perAktivitet: form.activities
            .map((a, i) => ({ sortOrder: i, equipmentIds: activityEquipment[a.id] ?? [] }))
            .filter(p => p.equipmentIds.length > 0),
        })
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
          alreadyLinked={!!defaultValues.merged_source}
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
                  color: 'var(--tekst-1-ren)', border: '1px solid #28A86E', borderRadius: 12,
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
                  color: 'var(--tekst-1-ren)', border: '1px solid #28A86E', borderRadius: 12,
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
                  color: 'var(--tekst-1-ren)', border: '1px solid var(--accent)', borderRadius: 12,
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
            <p className="mt-2 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              Planinnholdet forhåndsutfylles — juster til faktiske verdier og legg til dagsform, RPE, tagger og laktat.
            </p>
          )}
        </div>
      )}

      {/* ── MALER ── */}
      {(
        <div className="mb-2">
          {/* Kategorisering av mal-lista (bev.form + kategori) ved >4 maler. */}
          {/* Hurtigfilter (#50): samme sett som /app/maler + ⟳ Standardøkt.
              SF-16: toppen skal ta MAKS 3 rader på mobil —
              rad 1 = chips (scroller) + 🔧 til høyre · rad 2 = de tre
              nedtrekkene · rad 3 = søk + FRA MAL-chipsene (scroller).
              🔧-knappen bor nå her i stedet for på filterlinja: den linja
              finnes bare når man har mer enn fire maler, så knappen var
              usynlig for alle andre — den skal alltid være der. */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0 xp-scrollrow xp-scrollfade">
              {([
                { key: 'alle', label: 'Alle' },
                { key: 'test', label: '🧪 Test' },
                ...(harSkiForm ? [{ key: 'skyting' as const, label: 'Skyting' }] : []),
                { key: 'styrke', label: 'Styrke' },
                { key: 'standard', label: '⟳ Standardøkt' },
              ] as const).map(c => (
                <button key={c.key} type="button" onClick={() => setMalHurtig(c.key)}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5,
                    borderRadius: 999, padding: '5px 11px', cursor: 'pointer',
                    color: malHurtig === c.key ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
                    background: malHurtig === c.key ? 'var(--card2)' : 'none',
                    border: `1px solid ${malHurtig === c.key ? 'var(--accent)' : 'var(--line2)'}`,
                    fontWeight: malHurtig === c.key ? 700 : 400,
                  }}>
                  {c.label}
                </button>
              ))}
            </div>
            {/* Bolk 26 (Sverre 5. sep): «Lagre som mal» på mal-linja — økta slik
                den er bygd (rader, soner, punkt-plasseringer, skytinger) blir
                en ny mal via samme mal-modell som ellers. */}
            {!templateBuildingMode && !captureOnlyMode && (
              <button type="button" onClick={openTemplateModal} data-lagre-som-mal
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', borderRadius: 999, padding: '5px 11px', cursor: 'pointer', color: 'var(--accent)', background: 'none', border: '1.5px solid var(--accent)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Lagre som mal
              </button>
            )}
          </div>
          {showMalFilters && (
            <div className="flex items-center gap-1.5 md:gap-2 flex-nowrap md:flex-wrap mb-1.5">
              {malMovementOptions.length > 0 && (
                <select value={malMovement} onChange={e => setMalMovement(e.target.value)}
                  className="flex-1 min-w-0 md:flex-none"
                  style={{
                    backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
                    borderRadius: 'var(--r-field)', color: malMovement ? 'var(--accent)' : 'var(--tekst-5-app)',
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                    padding: '6px 8px', outline: 'none', minHeight: 34,
                  }}>
                  <option value="">Alle bev.former</option>
                  {malMovementOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
              <select value={malType} onChange={e => setMalType(e.target.value)}
                className="flex-1 min-w-0 md:flex-none"
                style={{
                  backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
                  borderRadius: 'var(--r-field)', color: malType ? 'var(--accent)' : 'var(--tekst-5-app)',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                  padding: '6px 8px', outline: 'none', minHeight: 34,
                }}>
                <option value="">Alle økttyper</option>
                {OKT_MAL_TYPER.map(t => <option key={t.verdi} value={t.verdi}>{t.etikett}</option>)}
              </select>
              {malSokFelt('hidden md:block', 150)}
              {malCategoryOptions.length > 1 && (
                <select value={malCategory} onChange={e => setMalCategory(e.target.value)}
                  className="flex-1 min-w-0 md:flex-none"
                  style={{
                    backgroundColor: 'var(--card2)', border: '1px solid var(--line)',
                    borderRadius: 'var(--r-field)', color: malCategory ? 'var(--accent)' : 'var(--tekst-5-app)',
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                    padding: '6px 8px', outline: 'none', minHeight: 34,
                  }}>
                  <option value="">Alle kategorier</option>
                  {malCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          )}
          {/* Rad 3: søket ligger her på mobil (på desktop står det på
              filterlinja over) — resten av linja er mal-chipsene, som
              scroller horisontalt som før. */}
          <div className="flex items-start gap-2">
            {malSokFelt('md:hidden shrink-0', 108)}
            <div className="xp-malrow flex-1 min-w-0" style={{ maxHeight: 150, overflowY: 'auto' }}>
            <span className="xp-mal-label">Fra mal</span>
            {visibleTemplates.length === 0 && (
              <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                Ingen maler matcher filtrene
              </span>
            )}
            {visibleTemplates.map(t => (
              <button key={t.id} type="button"
                onClick={() => {
                  // Bibliotekmal: åpne generator-dialogen (blokker → rader) i
                  // stedet for én aggregert rad. Avbrutt = ingenting settes inn.
                  if (erBibliotekMal(t)) setMalBygger(finnOktMal(t.id.slice(4)) ?? null)
                  else loadTemplate(t)
                }} className="xp-mal"
                style={erBibliotekMal(t) ? { color: 'var(--tekst-4-alt)', borderStyle: 'dashed' } : undefined}
                title={erBibliotekMal(t) ? 'Fra biblioteket — alt kan endres etter valg' : undefined}>
                {erBibliotekMal(t) ? '📚 ' : ''}{t.is_test ? '🧪 ' : ''}{t.standard_session_series_id ? '⟳ ' : ''}{t.name}
              </button>
            ))}
            {/* ⟳ Standardøkt bor i markerings-raden (chip). */}
            </div>
          </div>

        </div>
      )}

      {/* ── GRUNNINFO ── SF-17 (4. sep): komprimert layout etter fasiten
          design/xpulse-grunninfo-design.html (V9). INGENTING fjernes: samme
          felter, samme rekkefølge, samme valgfrihet — tittel alene på full
          bredde, metadata-raden i ett grid (tre trinn), felthøyde 42 px,
          chipsene fast gruppert (linje 1 = hva økta betyr, linje 2 = hva
          den er, forholdene HØYDE/VARME stablet til høyre), utstyr på én
          linje. Tab-rekkefølgen følger den visuelle. */}
      <Section label="Grunninfo">
        {defaultValues?.created_by_coach_id && (
          <div className="mb-1.5"><TrenerChip navn={defaultValues.created_by_coach_name} /></div>
        )}
        <div className="sf17">
          <div className="sf17-tittel">
            <label className="xp-label sf17-label" htmlFor="sf17-tittel">Tittel</label>
            <input id="sf17-tittel" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="F.eks. 5×5min terskelintervall" required
              className="sf17-in sf17-in-tittel" style={iSt} />
          </div>
          <div className="sf17-meta">
            <div>
              <label className="xp-label sf17-label" htmlFor="sf17-dato">Dato</label>
              <input id="sf17-dato" type="date" value={form.date} onChange={e => set('date', e.target.value)}
                required style={iSt} className="sf17-in" />
            </div>
            <div>
              <label className="xp-label sf17-label" htmlFor="sf17-kl">Kl. <span className="xp-opt">(valgfritt)</span></label>
              <input id="sf17-kl" type="time" value={form.time_of_day} onChange={e => set('time_of_day', e.target.value)}
                style={iSt} className="sf17-in" />
            </div>
            <div className="sf17-sted">
              <label className="xp-label sf17-label" htmlFor="sf17-sted">Sted <span className="xp-opt">(valgfritt)</span></label>
              <input id="sf17-sted" value={form.location ?? ''} onChange={e => set('location', e.target.value)}
                placeholder="F.eks. Sognsvann, Trysil, Sierra Nevada"
                className="sf17-in" style={iSt} />
            </div>
            <div className="sf17-type">
              <label className="xp-label sf17-label" htmlFor="sf17-type">Økttype <span className="xp-opt">(valgfritt)</span></label>
              {/* Kompakt nedtrekksliste — «Vanlig økt» (other) er default. Taggene
                  brukes til analyse-gruppering + «Siste hardøkt» på hjem. */}
              <select id="sf17-type"
                value={MEANINGFUL_WORKOUT_TYPES.includes(form.workout_type) ? form.workout_type : 'other'}
                onChange={e => set('workout_type', e.target.value as WorkoutType)}
                style={iSt} className="sf17-in">
                <option value="other">Vanlig økt</option>
                {workoutTypeOptions
                  .filter(t => MEANINGFUL_WORKOUT_TYPES.includes(t.value))
                  .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Chipsene — fast gruppering, aldri fritt flytende (fasiten):
                linje 1: VIKTIG ØKT · FELLESTRENING · (SKAL DELTA) · STANDARDØKT — hva økta BETYR
                linje 2: KONKURRANSE · TESTLØP · TEST — hva den ER
                til høyre, stablet: HØYDE · VARME — FORHOLDENE.
              Begge linjene nowrap; blir det trangt er det teksten som gir
              (11,5 px), aldri grupperingen. Mobil (<560): høyde/varme som
              ikon-knapper 44 × 36 med aria-label, fortsatt til høyre. */}
          <div className="sf17-chips">
            <div className="sf17-chips-venstre">
              <div className="sf17-chiplinje">
                <SfChip active={form.is_important} onClick={() => set('is_important', !form.is_important)} color="#FF4500" ikon="★" tekst="Viktig økt" kort="Viktig" />
                <SfChip active={form.is_group_session} onClick={() => set('is_group_session', !form.is_group_session)} color="#1A6FD4" ikon="👥" tekst="Fellestrening" kort="Felles" />
                {showCoachAttendChip && (
                  <SfChip active={coachWillAttend} onClick={() => setCoachWillAttend(v => !v)} color="#1A6FD4" ikon="👥" tekst="Skal delta" kort="Delta" />
                )}
                {/* Fase 97: standardøkt som markering — én chip blant markeringene,
                    fristilt fra mal-flaten. Virker for alle opphav (manuell, mal,
                    klokkesynk-importert). Trykk = serie-velger; aktiv chip viser
                    serien; trykk på aktiv = fjern kobling (bekreft hvis ført). */}
                <SfChip active={!!form.standard_session_series_id || standardPickerOpen}
                  onClick={() => { void (async () => {
                    if (form.standard_session_series_id) {
                      if (form.is_completed && !await xpConfirm(
                        `Fjerne koblingen til «${form.standard_session_series_name ?? 'serien'}»?`)) return
                      clearSerie()
                    } else {
                      setStandardPickerOpen(o => !o)
                    }
                  })() }}
                  color="#FF8A5C" ikon="⟳"
                  tekst={form.standard_session_series_id ? (form.standard_session_series_name ?? 'Standardøkt') : 'Standardøkt'}
                  kort={form.standard_session_series_id ? (form.standard_session_series_name ?? 'Std.') : 'Std.økt'} />
              </div>
              <div className="sf17-chiplinje">
                {SPECIAL_WORKOUT_TYPES.map(s => (
                  <SfChip key={s.value} active={form.workout_type === s.value}
                    onClick={() => set('workout_type', form.workout_type === s.value ? 'other' : s.value)}
                    color={s.color} tekst={s.label.replace(/^[^A-Za-zÆØÅæøå]+/, '').trim()} ikon={s.label.match(/^[^A-Za-zÆØÅæøå]+/)?.[0]?.trim()}
                    kort={s.value === 'competition' ? 'Konk.' : s.value === 'testlop' ? 'Testløp' : 'Test'} />
                ))}
              </div>
            </div>
            {/* Kort tekst med vilje — ikonet bærer betydningen. Lesevisningene
                (WorkoutOverview, WorkoutCard, Calendar, AltitudeHeatTab) beholder
                «Høydetrening»/«Varmetrening». */}
            <div className="sf17-forhold">
              <SfChip active={!!form.is_altitude_training} onClick={() => set('is_altitude_training', !form.is_altitude_training)} color="#5B8DEF" ikon="🏔️" tekst="Høyde" kort="" forhold />
              <SfChip active={!!form.is_heat_training} onClick={() => set('is_heat_training', !form.is_heat_training)} color="#E0772B" ikon="🌡️" tekst="Varme" kort="" forhold />
            </div>
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
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--flate-3)', background: '#FF8A5C', border: 'none', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}>
                Ja
              </button>
              <button type="button" onClick={() => setSerieSuggestionDismissed(true)}
                className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>
                Nei takk
              </button>
            </div>
          )}

          {/* Serie-velgeren: søkbar liste + opprett ny inline. */}
          {standardPickerOpen && (
            <div className="mt-1 mb-3 p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)' }}>
              <p className="text-xs mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', lineHeight: 1.5 }}>
                Koble økta til en <b>standardøkt-serie</b> — samme økt over tid, sammenlignbar i analysen.
                Henter <b>ikke</b> mal-data; økta beholder sine egne tall.
              </p>
              {(seriesList?.length ?? 0) > 4 && (
                <input value={serieSearch} onChange={e => setSerieSearch(e.target.value)}
                  placeholder="Søk i serier…"
                  className="mb-2 px-3 py-2 w-full text-sm"
                  style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", outline: 'none' }} />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {seriesList === null && (
                  <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>Laster serier…</span>
                )}
                {(seriesList ?? [])
                  .filter(s => !serieSearch.trim() || s.name.toLowerCase().includes(serieSearch.trim().toLowerCase()))
                  .map(s => (
                    <button key={s.id} type="button" onClick={() => selectSerie(s)}
                      className="px-3 py-1.5 text-sm transition-opacity hover:opacity-80"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: form.standard_session_series_id === s.id ? '#FF8A5C' : 'var(--tekst-3-app)',
                        background: form.standard_session_series_id === s.id ? '#1A0F08' : 'none',
                        border: `1px solid ${form.standard_session_series_id === s.id ? '#FF450088' : 'var(--kant-4)'}`,
                        borderRadius: 999, cursor: 'pointer', minHeight: 36,
                      }}>
                      {s.name}
                      <span style={{ color: 'var(--tekst-8-app)', marginLeft: 6, fontSize: 12 }}>
                        {s.workout_count}×{s.location ? ` · ${s.location}` : ''}
                      </span>
                    </button>
                  ))}
                {newSerieName === null ? (
                  <button type="button" onClick={() => setNewSerieName(form.title.trim())}
                    className="px-3 py-1.5 text-sm"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', background: 'none', border: '1px dashed var(--line2)', borderRadius: 999, cursor: 'pointer', minHeight: 36 }}>
                    + Ny serie
                  </button>
                ) : (
                  <span className="flex items-center gap-2 flex-wrap">
                    <input value={newSerieName} onChange={e => setNewSerieName(e.target.value)}
                      placeholder="Navn på serien"
                      style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, padding: '8px 10px', minHeight: 36, width: 170, outline: 'none' }} />
                    <input value={newSerieSted} onChange={e => setNewSerieSted(e.target.value)}
                      placeholder="Sted (valgfritt)"
                      style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, padding: '8px 10px', minHeight: 36, width: 140, outline: 'none' }} />
                    <button type="button" onClick={() => { void createSerie() }}
                      disabled={!(newSerieName ?? '').trim()}
                      className="text-xs tracking-widest uppercase"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--flate-3)', background: '#FF8A5C', border: 'none', borderRadius: 999, padding: '8px 14px', minHeight: 36, cursor: 'pointer', fontWeight: 700 }}>
                      Opprett
                    </button>
                    <button type="button" onClick={() => { setNewSerieName(null); setNewSerieSted('') }} aria-label="Avbryt"
                      style={{ color: 'var(--tekst-5-app)', background: 'none', border: 'none', cursor: 'pointer', minHeight: 36, minWidth: 32 }}>✕</button>
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
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Bytt serie
              </button>
              <button type="button" onClick={clearSerie}
                className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)', background: 'none', border: 'none', cursor: 'pointer' }}>
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
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', border: '1px solid var(--line2)', background: 'none', borderRadius: 999 }}>
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
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                  Høyde (moh){inheritedAltitude && (form.altitude_meters == null || form.altitude_meters === inheritedAltitude.altitude_meters) ? ' — arvet' : ''}
                </label>
                <input
                  type="number" inputMode="numeric" min={0} max={9000} step={50}
                  value={form.altitude_meters ?? ''}
                  onChange={e => set('altitude_meters', e.target.value === '' ? null : Math.round(Number(e.target.value)))}
                  placeholder="f.eks. 1800"
                  className="px-3 py-2 text-sm w-40"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', color: 'var(--tekst-1-app)', outline: 'none' }}
                />
              </div>
            )}
            {form.is_heat_training && (
              <div>
                <label className="text-xs tracking-widest uppercase block mb-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                  Kroppstemperatur (°C)
                </label>
                <input
                  type="number" inputMode="decimal" min={34} max={43} step={0.1}
                  value={form.body_temperature ?? ''}
                  onChange={e => set('body_temperature', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="f.eks. 38.5"
                  className="px-3 py-2 text-sm w-40"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", backgroundColor: 'var(--flate-14)', border: '1px solid var(--kant-3)', color: 'var(--tekst-1-app)', outline: 'none' }}
                />
              </div>
            )}
          </div>
        )}
        {form.is_group_session && (
          <div className="mt-3">
            <label className="text-xs tracking-widest uppercase block mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
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
                backgroundColor: 'var(--flate-14)',
                border: '1px solid var(--kant-3)',
                color: 'var(--tekst-1-app)',
                outline: 'none',
              }}
            />
            <p className="text-xs mt-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              Flere økter med samme etikett = samme fellestrening i trener-oversikt.
            </p>
          </div>
        )}

        {!targetUserId && !templateBuildingMode && !captureOnlyMode && (
          <div className="mt-2">
            <EquipmentSelectorInWorkout
              available={availableEquipment}
              selectedIds={equipmentIds}
              onChange={setEquipmentIds}
              planlagt={isPlanMode}
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
            klokke={workoutId && klokke.data?.samples ? { data: klokke.data, segmenter: liveSegmenter, workoutId } : null}
            rpe={form.rpe}
            onRpe={v => set('rpe', v)}
            forventet={form.forventet_belastning ?? null}
            onForventet={v => set('forventet_belastning', v)}
            tidspunktNotater={form.tidspunkt_notater ?? []}
            erPlanlagt={isPlanMode}
            laktatRader={form.lactate}
            ernaeringRader={form.nutrition_entries}
            timeOfDay={form.time_of_day}
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
      {/* #50 bolk 1: KONKURRANSE-/TESTLØP-/TEST-PANELET — ALLTID over
          aktivitets- og skyteføringen, med auto-stripa synlig FØR føring.
          Type-chips i panelet speiler workout_type (samme felt som chip-raden). */}
      {(form.workout_type === 'competition' || form.workout_type === 'testlop' || form.workout_type === 'test') && (
        <KonkurransePanel
          type={form.workout_type as PanelType}
          onTypeChange={t => set('workout_type', t)}
          data={form.competition_data ?? emptyCompetitionData(form.workout_type === 'testlop' ? 'testlop' : 'konkurranse')}
          onChange={d => set('competition_data', d)}
          sport={form.sport}
          mode={isPlanMode ? 'plan' : 'dagbok'}
          onSportChange={s2 => handleSportChange(s2)}
          activityCount={form.activities.length}
          keyDate={keyDate}
          onPrioritetChange={p => { void (async () => {
            // Alltid inn i øktas eget felt; MED årsplan-kobling skrives den
            // også tilbake dit (samme sannhet begge steder).
            setForm(f => ({
              ...f,
              competition_data: { ...(f.competition_data ?? emptyCompetitionData()), priority: p },
            }))
            if (!keyDate) return
            const forrige = keyDate
            setKeyDate({ ...keyDate, event_type: `competition_${p}` })
            const res = await updateKeyDatePriority(keyDate.key_date_id, p)
            if (res.error) { setKeyDate(forrige); void xpAlert(res.error) }
          })() }}
          testData={form.test_data ?? null}
          onTestDataChange={d => set('test_data', d)}
          aktivSkytetestRef={form.activities.find(a => a.shooting_is_test && a.shooting_test_ref)?.shooting_test_ref ?? null}
          onVelgSkytetest={oppsett => { void (async () => {
            // Genererer serieoppsettet i aktivitetslista (gull-markeringen er
            // shooting_is_test på raden; 🧪 er allerede workout_type='test').
            const nySerier = oppsett.serier.map(f => ({
              id: crypto.randomUUID(), position: f.position, shots: String(f.shots),
              hits: '', time_seconds: '', avg_heart_rate: '', max_heart_rate: '',
              note: '', shot_plot: null, points: '',
              vind_retning: null, vind_styrke: null, sikt: null,
            }))
            const eksisterende = form.activities.find(a => a.shooting_series.length > 0)
            if (eksisterende && eksisterende.shooting_series.some(sr => (parseInt(sr.shots) || 0) > 0)
              && !await xpConfirm(`Erstatte seriene med oppsettet fra «${oppsett.navn}» (${nySerier.length} serier)?`)) return
            setForm(f => {
              // Samme regel som alle andre test-innganger (testFelter).
              // Skytetest er ingen av skiskytingens distanse-underkategorier
              // (Sprint/Jaktstart/…) — protokollen settes til «Egen».
              const medTestBase = testFelter(f, oppsett.navn, 'biathlon')
              const tdSkyte = medTestBase.test_data!
              const medTest = {
                ...medTestBase,
                test_data: {
                  ...tdSkyte,
                  subcategory: tdSkyte.subcategory.trim() === '' ? 'Egen' : tdSkyte.subcategory,
                },
              }
              const rad = f.activities.find(a => a.shooting_series.length > 0)
              if (rad) {
                return { ...f, ...medTest, activities: f.activities.map(a => a.id === rad.id
                  ? { ...a, shooting_is_test: true, shooting_test_ref: oppsett.ref,
                      shooting_surface: (oppsett.surface ?? a.shooting_surface) as ActivityRow['shooting_surface'],
                      shooting_series: nySerier }
                  : a) }
              }
              return { ...f, ...medTest, activities: [...f.activities, {
                ...makeActivity({ activity_type: 'skyting_kombinert' }),
                shooting_is_test: true, shooting_test_ref: oppsett.ref,
                shooting_surface: (oppsett.surface ?? '') as ActivityRow['shooting_surface'],
                shooting_series: nySerier,
              }] }
            })
          })() }}
          testMaler={alleMaler.filter(t => t.is_test).map(t => ({
            id: t.id, navn: t.name, erBibliotek: erBibliotekMal(t), sport: t.sport ?? null,
          }))}
          aktivTestMalId={valgtTestMalId}
          onVelgTestMal={id => {
            // Valgt test skal MARKERES og resultatet KOBLES til testen — ikke
            // bare generere struktur: gull-rad i velgeren, 🧪 test som økt-type,
            // testnavnet inn i tittel + «Navn på testen», og test_type settes
            // til malens navn så resultatet lagres som resultat AV DEN testen
            // (samme mal = samme test i test-/PR-analysen, på tvers av økter).
            setValgtTestMalId(id)
            const bibMal = id.startsWith('bib_') ? finnOktMal(id.slice(4)) : null
            const egenMal = bibMal ? null : templates.find(x => x.id === id)
            const malNavn = bibMal?.navn ?? egenMal?.name ?? ''
            // Bibliotekmaler er sport-nøytrale — kun egne maler bærer sport.
            const malSport = egenMal?.sport ?? null
            setForm(f => ({ ...f, ...testFelter(f, malNavn, malSport ?? f.sport) }))
            if (bibMal) setMalBygger(bibMal)
            else if (egenMal) loadTemplate(egenMal)
          }}
          onNyMal={() => setVisNyMalBygger(true)}
          kanLageNyMal={!templateBuildingMode && !captureOnlyMode}
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
      )}

      <Section label="Aktiviteter">
        <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          Legg til hver del av økta i kronologisk rekkefølge. Trykk på en rad for å utvide.
        </p>
        <ActivitiesSection
          targetUserId={targetUserId}
          onOktbygger={() => setVisOktbygger(true)}
          onPlottTreff={workoutId && !isPlanMode ? () => setVisPlottTreff(true) : undefined}
          rows={form.activities}
          onChange={settAktiviteter}
          workoutId={workoutId ?? null}
          radInfo={plassGrunnlag.radInfo}
          erKlokkeokt={!!(defaultValues?.imported_from || defaultValues?.merged_source)}
          sport={form.sport}
          userSports={effectiveUserSports}
          activityTypeFavorites={activityTypeFavorites}
          mode={isPlanMode ? 'plan' : 'dagbok'}
          defaultPaceUnit={defaultPaceUnit}
          workoutType={form.workout_type}
          availableEquipment={!isPlanMode && !targetUserId ? availableEquipment : undefined}
          activityEquipment={activityEquipment}
          onActivityEquipmentChange={!isPlanMode && !targetUserId
            ? (rowId, ids) => setActivityEquipment(prev => {
                const next = { ...prev }
                if (ids.length === 0) delete next[rowId]
                else next[rowId] = ids
                return next
              })
            : undefined}
        />
      </Section>



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
              <RpeSkala value={form.rpe} onChange={v => set('rpe', v)} etikett="RPE 1–10" />
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
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--kant-3)')} />

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
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--kant-3)')} />
              <button type="button" onClick={addCustomTag}
                className="px-4 py-2 text-sm tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
                  background: 'none', border: '1px solid var(--kant-4)', cursor: 'pointer',
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
        <WorkoutKlokkesyncSection workoutId={workoutId} klokke={klokke} visGraf={false}
          importedFrom={defaultValues?.imported_from ?? defaultValues?.merged_source ?? null} />
      )}

      {visPlottTreff && workoutId && (
        <PlottTreffPopup
          workoutId={workoutId}
          onClose={() => setVisPlottTreff(false)}
          onLagret={flettInnLagredeSerier}
        />
      )}

      {visOktbygger && (
        <OktbyggerPopup
          workoutId={workoutId ?? null}
          sport={form.sport}
          userSports={userSports}
          rader={form.activities}
          onRader={a => set('activities', a)}
          klokke={klokke.data}
          erPlanlagt={isPlanMode}
          heartZones={heartZones}
          rpe={form.rpe}
          timeOfDay={form.time_of_day}
          laktat={form.lactate}
          onLaktat={l => set('lactate', l)}
          ernaering={form.nutrition_entries ?? []}
          onErnaering={n => set('nutrition_entries', n)}
          punkter={form.tidspunkt_notater ?? []}
          onPunkter={p => set('tidspunkt_notater', p)}
          onRaderFraBasen={hentRaderFraBasen}
          onByggTittel={tittel => setForm(f => ({ ...f, title: f.title.trim() === '' ? tittel : f.title }))}
          onBolkTittel={tittel => setForm(f => ({ ...f, title: f.title.trim() === '' ? tittel : `${f.title.trim()} + ${tittel}` }))}
          onSerierLagret={flettInnLagredeSerier}
          onClose={() => setVisOktbygger(false)}
          onOpprett={async (rader, tittel, opts) => {
            // Regenerering fra hurtigoppsettet (flere bolker / endret bolk) er
            // ment å overskrive — bare manuelt innhold får spørsmålet.
            if (!opts?.regenerert && aktivitetslistaHarInnhold(form.activities)
              && !await xpConfirm('Erstatte aktivitetslista med den genererte økta?')) return
            setForm(f => ({
              ...f,
              activities: rader,
              title: f.title.trim() === '' ? tittel : f.title,
            }))
          }}
        />
      )}

      {/* Strava API Agreement § 2.3 — synlig attribusjon for Strava-data. */}
      {workoutId && (defaultValues?.imported_from === 'strava' || defaultValues?.merged_source === 'strava') && (
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


      {visNyMalBygger && typeof document !== 'undefined' && createPortal(
        <OktmalBuilder
          primarySport={form.sport}
          templates={templates}
          defaultValues={{ workout_type: form.workout_type }}
          onClose={() => setVisNyMalBygger(false)}
        />,
        document.body,
      )}

      {malBygger && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
          style={{ backgroundColor: 'var(--scrim-70)' }}
          onClick={() => setMalBygger(null)}>
          <div className="w-full max-w-xl" onClick={e => e.stopPropagation()}>
            <p className="mb-1 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-4-alt)' }}>
              📚 {malBygger.navn}
            </p>
            <IntervallBygger
              sport={form.sport}
              forhandsutfylt={{ ...oktMalTilIntervallOppsett(malBygger), tittel: malBygger.navn }}
              onAvbryt={() => setMalBygger(null)}
              onOpprett={async (rader, tittel) => {
                const mal = malBygger
                if (aktivitetslistaHarInnhold(form.activities)
                  && !await xpConfirm('Erstatte aktivitetslista med den genererte økta?')) return
                if (erTestMal(mal)) setValgtTestMalId(`bib_${mal.ref}`)
                setForm(f => {
                  const base = {
                    ...f,
                    title: tittel,
                    // okt_type fra malen som før (bolk 1): test → 🧪, ellers mappes.
                    workout_type: (erTestMal(mal) ? 'test'
                      : (oktTypeToWorkoutType(mal.type) ?? f.workout_type)) as WorkoutFormData['workout_type'],
                    activities: rader,
                    template_id: null,
                    template_name: mal.navn,
                  }
                  // Test-mal: testpanelet fylles auto — byggerens TITTEL blir
                  // «Navn på testen», bev.form/underkat fra radene blir
                  // protokollsport/underkategori, og malens navn beholdes som
                  // stabil test_type (så samme mal grupperes på tvers av økter
                  // selv om tittelen varieres). Kun tomme felter fylles.
                  if (!erTestMal(mal)) return base
                  const p = protokollFraRader(rader)
                  const felter = testFelter(base, tittel, base.sport)
                  const td = felter.test_data!
                  const forrige = f.test_data ?? emptyTestData()
                  return {
                    ...base, ...felter, title: base.title,
                    test_data: {
                      ...td,
                      test_type: forrige.test_type.trim() === '' ? mal.navn : td.test_type,
                      sport: forrige.sport === '' && p.sport ? p.sport : td.sport,
                      subcategory: forrige.subcategory.trim() === '' ? p.subcategory : td.subcategory,
                    },
                  }
                })
              }} />
          </div>
        </div>
      )}

      {showTemplateModal && (
        <SaveAsTemplateModal
          name={templateName}
          description={templateDescription}
          category={templateCategory}
          sport={templateSport}
          onSport={setTemplateSport}
          malKind={form.workout_type === 'competition' ? 'konkurranse'
            : form.workout_type === 'testlop' ? 'testlop' : null}
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
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
              backgroundColor: 'transparent', border: '1px solid var(--kant-4)', cursor: 'pointer',
            }}>
            Lukk
          </button>
        </div>
      )}
    </form>
  )
}

function SaveAsTemplateModal({
  name, description, category, sport, isTest, malKind,
  oktType, serieId, seriesList,
  onName, onDescription, onCategory, onSport, onIsTest, onOktType, onSerieId,
  onCancel, onSave, saving, error,
}: {
  name: string
  description: string
  category: string
  sport: Sport
  onSport: (v: Sport) => void
  isTest: boolean
  // Konkurranse-/testløp-økt: kategorien er gitt av typen — som for test.
  malKind: 'konkurranse' | 'testlop' | null
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
  // Skyting kun for skiskyttere: «Skiskyting» som mal-sport bare når brukeren har det (eller malen alt er det).
  const harSki = useHarSkiskyting()
  // Typen er gitt (test vinner over konkurranse/testløp): kategori, økttype
  // og standardøkt er ikke valg — de settes deterministisk ved lagring.
  const typeGitt = isTest ? 'Test' : malKind === 'konkurranse' ? 'Konkurranse' : malKind === 'testlop' ? 'Testløp' : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--scrim-70)' }}
      onClick={onCancel}>
      <div className="w-full max-w-md p-5"
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)' }}>
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
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              Navn *
            </label>
            <input value={name} onChange={e => onName(e.target.value)}
              placeholder="F.eks. 5×5min terskel"
              autoFocus
              style={iSt} className="w-full px-3 py-2" />
          </div>

          <div>
            <label className="block mb-1 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              Beskrivelse
            </label>
            <textarea value={description} onChange={e => onDescription(e.target.value)}
              rows={2} placeholder="Valgfri kort beskrivelse"
              style={{ ...iSt, resize: 'vertical' }} className="w-full px-3 py-2" />
          </div>

          <div className={typeGitt ? '' : 'grid grid-cols-2 gap-3'}>
            {/* Typen gitt (test/konkurranse/testløp): kategorien skjules. */}
            {!typeGitt && (
            <div>
              <label className="block mb-1 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                Kategori
              </label>
              <select value={category} onChange={e => onCategory(e.target.value)}
                style={iSt} className="w-full px-3 py-2">
                {TEMPLATE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            )}
            <div>
              <label className="block mb-1 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                Sport
              </label>
              <select value={sport} onChange={e => onSport(e.target.value as Sport)}
                style={iSt} className="w-full px-3 py-2">
                {SPORTS.filter(s => s.value !== 'biathlon' || harSki || sport === 'biathlon').map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
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
              color: isTest ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
              background: isTest ? '#D4A01722' : 'transparent',
              border: `1px solid ${isTest ? '#D4A017' : 'var(--kant-4)'}`,
            }}>
            🧪 Marker som test
            <span style={{ color: 'var(--tekst-8-app)', fontSize: 12 }}>
              {isTest ? 'økter fra malen får 🧪' : 'valgfritt'}
            </span>
          </button>

          {typeGitt && !isTest && (
            <p className="text-xs mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              {typeGitt === 'Konkurranse' ? '🏁' : '⏱'} Lagres som {typeGitt.toLowerCase()}-mal — kategorien følger økt-typen.
            </p>
          )}

          {/* Fase 97: økttype (fasit = OKT_MAL_TYPER) — brukes av filteret i
              mal-velgeren og stempler økter laget fra malen. Valgfritt.
              Typen gitt: skjult — kategorien følger typen. */}
          {!typeGitt && (
          <div className="mt-3">
            <label className="block text-xs mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', letterSpacing: '0.05em' }}>
              Økttype (valgfritt)
            </label>
            <select value={oktType} onChange={e => onOktType(e.target.value)}
              className="w-full px-3 py-2"
              style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, outline: 'none' }}>
              <option value="">— Ingen —</option>
              {OKT_MAL_TYPER.map(t => <option key={t.verdi} value={t.verdi}>{t.etikett}</option>)}
            </select>
          </div>
          )}

          {/* Fase 97: mal som standardøkt — økter fra malen får serien
              forhåndsvalgt (endrebar før lagring). Malen viser ⟳-badge.
              Typen gitt: skjult — konkurranse/testløp/test er ikke standardøkt. */}
          {!typeGitt && seriesList.length > 0 && (
            <div className="mt-3">
              <label className="block text-xs mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF8A5C', letterSpacing: '0.05em' }}>
                ⟳ Standardøkt-serie (valgfritt)
              </label>
              <select value={serieId} onChange={e => onSerieId(e.target.value)}
                className="w-full px-3 py-2"
                style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 'var(--r-field)', color: 'var(--tekst-1-app)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, outline: 'none' }}>
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
              backgroundColor: saving ? '#7A2200' : '#FF4500', color: 'var(--tekst-1-app)',
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            }}>
            {saving ? 'Lagrer...' : 'Lagre mal'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
              background: 'none', border: '1px solid var(--kant-4)', cursor: 'pointer',
            }}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared helpers ──

/** Har lista noe brukeren har FØRT? En ny økt starter med én tom rad som
    bare bærer sportens standard-bevegelsesform — det er ikke innhold, og
    skal ikke utløse «erstatte lista?» når hurtigoppsettet brukes. */
function aktivitetslistaHarInnhold(activities: ActivityRow[]): boolean {
  return activities.some(a =>
    a.duration.trim() !== '' || a.notes.trim() !== '' || a.distance_km.trim() !== ''
    || a.shooting_series.length > 0 || a.exercises.length > 0)
}

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
    <div className="my-4 p-4" style={{ border: '1px solid var(--kant-4)', backgroundColor: 'var(--flate-6-alt)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: '12px', height: '2px', backgroundColor: 'var(--tekst-8-app)', display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          Plan (referanse)
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', fontSize: '13px' }}>
        <div>
          <div className="text-xs" style={{ color: 'var(--tekst-8-app)' }}>Varighet</div>
          <div>{totalMinutes > 0 ? `${totalMinutes} min` : '—'}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--tekst-8-app)' }}>Distanse</div>
          <div>{totalKm > 0 ? `${totalKm.toFixed(1)} km` : '—'}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--tekst-8-app)' }}>Type</div>
          <div>{plan.workout_type}</div>
        </div>
      </div>
      {movements.length > 0 && (
        <div className="mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', fontSize: '13px' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--tekst-8-app)' }}>Bevegelsesformer</div>
          <div className="flex flex-wrap gap-2">
            {movements.map((m, i) => (
              <span key={i} style={{ border: '1px solid var(--kant-4)', padding: '2px 8px' }}>
                {m.movement_name}
                {m.minutes ? ` · ${m.minutes} min` : ''}
                {m.distance_km ? ` · ${m.distance_km} km` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {zones.length > 0 && (
        <div className="mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', fontSize: '13px' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--tekst-8-app)' }}>Soner</div>
          <div className="flex flex-wrap gap-2">
            {zones.map(([name, mins]) => (
              <span key={name} style={{ border: '1px solid var(--kant-4)', padding: '2px 8px' }}>
                {name} · {mins} min
              </span>
            ))}
          </div>
        </div>
      )}
      {plan.notes && (
        <div className="mt-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)', fontSize: '13px' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--tekst-8-app)' }}>Notater</div>
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

// StarRating er flyttet til components/ui/StarRating.tsx — ÉN følelses-
// skala i hele appen (regel 11), delt med den daglige energiføringen.

/** SF-17: chip med fast høyde 36 px, kort tekst under 560 px, og ikon-knapp
    (44 × 36) for forholdene HØYDE/VARME på mobil. aria-label bærer hele
    teksten uansett. */
function SfChip({ active, onClick, color = 'var(--tekst-8-app)', ikon, tekst, kort, forhold = false }: {
  active: boolean; onClick: () => void; color?: string; ikon?: string; tekst: string; kort?: string; forhold?: boolean
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={tekst}
      className={`sf17-chip${forhold ? ' sf17-chip-forhold' : ''}`}
      style={{
        backgroundColor: active ? `${color}22` : 'transparent',
        color: active ? color : 'var(--mut)',
        border: `1px solid ${active ? color : 'var(--line2)'}`,
      }}>
      {ikon && <span aria-hidden className="sf17-chip-ikon">{ikon}</span>}
      <span className="sf17-chip-lang">{tekst}</span>
      {kort !== undefined && kort !== '' && <span className="sf17-chip-kort" aria-hidden>{kort}</span>}
    </button>
  )
}

function Chip({ active, onClick, children, color = 'var(--tekst-8-app)' }: {
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

