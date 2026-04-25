'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveWorkout } from '@/app/actions/workouts'
import { saveAsTemplate } from '@/app/actions/templates'
import { setWorkoutEquipment } from '@/app/actions/equipment'
import {
  WorkoutFormData, MovementRow, LactateRow,
  Sport, SPORTS, DEFAULT_MOVEMENTS_BY_SPORT,
  getWorkoutTypes, WorkoutTemplate, TEMPLATE_CATEGORIES,
  CompetitionData, emptyCompetitionData, generateCompetitionActivities,
  TestData, emptyTestData,
} from '@/lib/types'
import type { Equipment } from '@/lib/equipment-types'
import { ActivitiesSection } from './ActivitiesSection'
import { ActivitySummary } from './ActivitySummary'
import { CompetitionModule } from './CompetitionModule'
import { TestDataModule } from './TestDataModule'
import { PlanVsActualComparison } from './PlanVsActualComparison'
import { EquipmentSelectorInWorkout } from '@/components/equipment/EquipmentSelectorInWorkout'
import { HeartZone } from '@/lib/heart-zones'

interface WorkoutFormProps {
  initialSport?: Sport
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

export function WorkoutForm({ initialSport = 'running', initialDate, workoutId, defaultValues, templates = [], formMode = 'dagbok', heartZones = [], onSaved, onCancel, readOnly = false, templateBuildingMode = false, onTemplateSaved, captureOnlyMode = false, onCapture, captureSubmitLabel, onDirtyChange, targetUserId, defaultPaceUnit = null, availableEquipment = [], initialEquipmentIds = [] }: WorkoutFormProps) {
  const router = useRouter()
  const isPlanMode = formMode === 'plan'
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
    workout_type: defaultValues?.workout_type ?? 'long_run',
    is_planned:  formMode === 'plan' ? true : (defaultValues?.is_planned ?? false),
    is_completed: defaultValues?.is_completed ?? false,
    is_important: defaultValues?.is_important ?? false,
    simple_duration_minutes: defaultValues?.simple_duration_minutes ?? '',
    simple_distance_km:      defaultValues?.simple_distance_km ?? '',
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
    activities:  defaultValues?.activities ?? [],
    planned_activities: defaultValues?.planned_activities,
    competition_data: defaultValues?.competition_data,
    template_id:   defaultValues?.template_id ?? null,
    template_name: defaultValues?.template_name ?? null,
    test_data:     defaultValues?.test_data,
  }))

  // Sammenlign-toggle: åpen som standard når økten allerede er gjennomført.
  const [showComparison, setShowComparison] = useState<boolean>(() => !!defaultValues?.is_completed)

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
    // Generer nye klient-id-er så innholdet ikke kolliderer med eksisterende rader.
    const freshActivities = (template.activities ?? []).map(a => ({
      ...a,
      id: crypto.randomUUID(),
      exercises: (a.exercises ?? []).map(ex => ({
        ...ex,
        id: crypto.randomUUID(),
        sets: (ex.sets ?? []).map(s => ({ ...s, id: crypto.randomUUID() })),
      })),
      lactate_measurements: (a.lactate_measurements ?? []).map(m => ({
        ...m,
        id: crypto.randomUUID(),
      })),
    }))
    setForm(f => ({
      ...f,
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
      template_id: template.id,
      template_name: template.name,
    }))
  }

  const openTemplateModal = () => {
    setTemplateName('')
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
      if (savedId && !targetUserId && availableEquipment.length > 0) {
        await setWorkoutEquipment(savedId, equipmentIds)
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
          <div>
            <Label>Sport</Label>
            <select value={form.sport} onChange={e => handleSportChange(e.target.value as Sport)}
              style={iSt} className="w-full px-4 py-3">
              {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Økttype</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {workoutTypeOptions.filter(t => t.value !== 'warmup_shooting').map(t => (
                <button key={t.value} type="button" onClick={() => set('workout_type', t.value)}
                  className="px-3 py-1.5 text-sm tracking-widest uppercase transition-colors"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    backgroundColor: form.workout_type === t.value ? '#FF4500' : 'transparent',
                    color: form.workout_type === t.value ? '#F0F0F2' : '#555560',
                    border: `1px solid ${form.workout_type === t.value ? '#FF4500' : '#222228'}`,
                    cursor: 'pointer',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Enkel føring: totaltid + km direkte på økta. Brukes når brukeren ikke vil bryte
            ned i aktiviteter, eller for raske importer. Aktiviteter overstyrer disse
            verdiene i summeringer — da vises en varsel. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <Label>Totaltid (min)</Label>
            <input type="number" inputMode="numeric" min="0" step="1"
              value={form.simple_duration_minutes}
              onChange={e => set('simple_duration_minutes', e.target.value)}
              placeholder="f.eks. 60"
              className="w-full px-4 py-3"
              style={iSt} onFocus={e => (e.currentTarget.style.borderColor='#FF4500')}
              onBlur={e => (e.currentTarget.style.borderColor='#1E1E22')} />
          </div>
          <div>
            <Label>Distanse (km)</Label>
            <input type="number" inputMode="decimal" min="0" step="0.1"
              value={form.simple_distance_km}
              onChange={e => set('simple_distance_km', e.target.value)}
              placeholder="f.eks. 10"
              className="w-full px-4 py-3"
              style={iSt} onFocus={e => (e.currentTarget.style.borderColor='#FF4500')}
              onBlur={e => (e.currentTarget.style.borderColor='#1E1E22')} />
          </div>
        </div>
        {form.activities.length > 0 && (form.simple_duration_minutes || form.simple_distance_km) && (
          <p className="mt-2 text-[11px]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
            ⚠ Totaltid/distanse regnes nå fra aktiviteter. Feltene over brukes kun som fallback når økten ikke har aktiviteter.
          </p>
        )}

        <div className="flex gap-3 mt-4">
          <Chip active={form.is_important} onClick={() => set('is_important', !form.is_important)} color="#FF4500">
            ★ Viktig økt
          </Chip>
        </div>
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

      {/* ── AKTIVITETER (kronologisk liste — erstatter Bevegelsesformer + Skyting) ── */}
      <Section label="Aktiviteter">
        <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Legg til hver del av økta i kronologisk rekkefølge. Trykk på en rad for å utvide.
        </p>
        <ActivitiesSection
          rows={form.activities}
          onChange={a => set('activities', a)}
          sport={form.sport}
          mode={isPlanMode ? 'plan' : 'dagbok'}
          defaultPaceUnit={defaultPaceUnit}
        />
      </Section>

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

      {/* ── UTSTYR ── */}
      {availableEquipment.length > 0 && !targetUserId && (
        <Section label="Utstyr">
          <EquipmentSelectorInWorkout
            available={availableEquipment}
            selectedIds={equipmentIds}
            onChange={setEquipmentIds}
          />
        </Section>
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
        style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
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
  backgroundColor: '#16161A', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', outline: 'none',
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-3 py-4" style={{ borderBottom: '1px solid #1E1E22' }}>
        <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.1em' }}>
          {label}
        </h3>
      </div>
      <div className="py-5">{children}</div>
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

