'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveWorkout } from '@/app/actions/workouts'
import { saveTemplate } from '@/app/actions/health'
import {
  WorkoutFormData, MovementRow, ZoneRow, ExerciseRow, LactateRow,
  Sport, WorkoutType, SPORTS, INTENSITY_ZONES, DEFAULT_MOVEMENTS_BY_SPORT,
  getWorkoutTypes, WorkoutTemplate,
} from '@/lib/types'
import { MovementTable } from './MovementTable'
import { ZoneTable } from './ZoneTable'
import { ExercisesSection } from './ExercisesSection'
import { LactateTable } from './LactateTable'

interface WorkoutFormProps {
  initialSport?: Sport
  initialDate?: string
  workoutId?: string
  defaultValues?: Partial<WorkoutFormData>
  templates?: WorkoutTemplate[]
}

function makeDefaultMovements(sport: Sport): MovementRow[] {
  return DEFAULT_MOVEMENTS_BY_SPORT[sport].map(name => ({
    id: crypto.randomUUID(), movement_name: name, minutes: '', distance_km: '', elevation_meters: ''
  }))
}

function makeDefaultZones(): ZoneRow[] {
  return INTENSITY_ZONES.slice(0, 5).map(z => ({ zone_name: z, minutes: '' }))
}

const SHOOTING_TYPES: WorkoutType[] = ['hard_combo','easy_combo','basis_shooting','warmup_shooting']
const ENDURANCE_TYPES: WorkoutType[] = ['endurance','technical','competition','hard_combo','easy_combo']

export function WorkoutForm({ initialSport = 'running', initialDate, workoutId, defaultValues, templates = [] }: WorkoutFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [showTemplateInput, setShowTemplateInput] = useState(false)

  const today = initialDate ?? new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<WorkoutFormData>(() => ({
    title:       defaultValues?.title ?? '',
    date:        defaultValues?.date ?? today,
    time_of_day: defaultValues?.time_of_day ?? '',
    sport:       defaultValues?.sport ?? initialSport,
    workout_type: defaultValues?.workout_type ?? 'endurance',
    is_planned:  defaultValues?.is_planned ?? false,
    is_important: defaultValues?.is_important ?? false,
    movements:   defaultValues?.movements ?? makeDefaultMovements(defaultValues?.sport ?? initialSport),
    zones:       defaultValues?.zones ?? makeDefaultZones(),
    exercises:   defaultValues?.exercises ?? [],
    strength_type: defaultValues?.strength_type ?? 'basis',
    lactate:     defaultValues?.lactate ?? [],
    day_form_physical: defaultValues?.day_form_physical ?? null,
    day_form_mental:   defaultValues?.day_form_mental ?? null,
    rpe:         defaultValues?.rpe ?? null,
    notes:       defaultValues?.notes ?? '',
    tags:        defaultValues?.tags ?? [],
    shooting_prone_shots:   defaultValues?.shooting_prone_shots ?? '',
    shooting_prone_hits:    defaultValues?.shooting_prone_hits ?? '',
    shooting_standing_shots: defaultValues?.shooting_standing_shots ?? '',
    shooting_standing_hits:  defaultValues?.shooting_standing_hits ?? '',
    shooting_warmup_shots:  defaultValues?.shooting_warmup_shots ?? '',
  }))

  const set = <K extends keyof WorkoutFormData>(key: K, val: WorkoutFormData[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const handleSportChange = (sport: Sport) => {
    setForm(f => ({ ...f, sport, movements: makeDefaultMovements(sport) }))
  }

  const loadTemplate = (template: WorkoutTemplate) => {
    const d = template.template_data
    setForm(f => ({
      ...f,
      sport: d.sport ?? f.sport,
      workout_type: d.workout_type ?? f.workout_type,
      movements: (d.movements ?? []).map((m: MovementRow) => ({ ...m, id: crypto.randomUUID() })),
      zones: d.zones ?? makeDefaultZones(),
      exercises: (d.exercises ?? []).map((e: ExerciseRow) => ({ ...e, id: crypto.randomUUID() })),
      strength_type: d.strength_type ?? 'basis',
      notes: d.notes ?? '',
      tags: d.tags ?? [],
    }))
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    const templateData = {
      sport: form.sport, workout_type: form.workout_type,
      movements: form.movements, zones: form.zones,
      exercises: form.exercises, strength_type: form.strength_type,
      notes: form.notes, tags: form.tags,
    }
    await saveTemplate(templateName.trim(), templateData as Record<string, unknown>)
    setSavingTemplate(false)
    setShowTemplateInput(false)
    setTemplateName('')
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
    setSaving(true); setError(null)
    const result = await saveWorkout(form, workoutId)
    if (result.error) { setError(result.error); setSaving(false) }
    else {
      const dateForCalendar = form.date
      router.push(`/athlete/calendar/${dateForCalendar}`)
      router.refresh()
    }
  }

  const isStrength  = form.workout_type === 'strength'
  const isBiathlon  = form.sport === 'biathlon'
  const isShooting  = SHOOTING_TYPES.includes(form.workout_type)
  const isEndurance = ENDURANCE_TYPES.includes(form.workout_type)
  const showZones   = isEndurance && !isStrength
  const workoutTypeOptions = getWorkoutTypes(form.sport)

  // Shooting stats
  const pronePct    = form.shooting_prone_shots ? Math.round((parseInt(form.shooting_prone_hits)||0) / parseInt(form.shooting_prone_shots) * 100) : null
  const standingPct = form.shooting_standing_shots ? Math.round((parseInt(form.shooting_standing_hits)||0) / parseInt(form.shooting_standing_shots) * 100) : null

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-4 space-y-0">

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
              {workoutTypeOptions.map(t => (
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

        <div className="flex gap-3 mt-4">
          <Chip active={form.is_planned} onClick={() => set('is_planned', !form.is_planned)}>
            Planlagt økt
          </Chip>
          <Chip active={form.is_important} onClick={() => set('is_important', !form.is_important)} color="#FF4500">
            ★ Viktig økt
          </Chip>
        </div>
      </Section>

      {/* ── BEVEGELSESFORMER ── */}
      {form.workout_type !== 'warmup_shooting' && (
        <Section label="Bevegelsesformer">
          <MovementTable
            rows={form.movements}
            onChange={rows => set('movements', rows)}
            defaultMovements={DEFAULT_MOVEMENTS_BY_SPORT[form.sport]}
          />
        </Section>
      )}

      {/* ── INTENSITETSSONER ── */}
      {showZones && (
        <Section label="Intensitetssoner">
          <ZoneTable rows={form.zones} onChange={rows => set('zones', rows)} />
        </Section>
      )}

      {/* ── STYRKEØVELSER ── */}
      {isStrength && (
        <Section label="Styrkeøvelser">
          <ExercisesSection
            rows={form.exercises}
            strengthType={form.strength_type}
            onChange={rows => set('exercises', rows)}
            onStrengthTypeChange={t => set('strength_type', t)}
          />
        </Section>
      )}

      {/* ── SKISKYTING ── */}
      {isBiathlon && (
        <Section label="Skyting">
          {form.workout_type === 'warmup_shooting' ? (
            <SmallField label="Antall innskytingsskudd" value={form.shooting_warmup_shots}
              onChange={v => set('shooting_warmup_shots', v)} />
          ) : form.workout_type === 'basis_shooting' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <span className="text-xs tracking-widest uppercase" style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>Liggende</span>
              </div>
              <SmallField label="Skudd" value={form.shooting_prone_shots} onChange={v => set('shooting_prone_shots', v)} />
              <SmallField label="Treff" value={form.shooting_prone_hits} onChange={v => set('shooting_prone_hits', v)} />
              {pronePct !== null && <StatBadge label="Treff%" value={`${pronePct}%`} />}
              <div className="md:col-span-3">
                <span className="text-xs tracking-widest uppercase" style={{ color: '#555560', fontFamily: "'Barlow Condensed', sans-serif" }}>Stående</span>
              </div>
              <SmallField label="Skudd" value={form.shooting_standing_shots} onChange={v => set('shooting_standing_shots', v)} />
              <SmallField label="Treff" value={form.shooting_standing_hits} onChange={v => set('shooting_standing_hits', v)} />
              {standingPct !== null && <StatBadge label="Treff%" value={`${standingPct}%`} />}
              <SmallField label="Innskyting (skudd)" value={form.shooting_warmup_shots} onChange={v => set('shooting_warmup_shots', v)} />
            </div>
          ) : (isShooting || isBiathlon) ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SmallField label="Liggende — skudd" value={form.shooting_prone_shots} onChange={v => set('shooting_prone_shots', v)} />
              <SmallField label="Liggende — treff" value={form.shooting_prone_hits} onChange={v => set('shooting_prone_hits', v)} />
              {pronePct !== null && <StatBadge label="Liggende %" value={`${pronePct}%`} />}
              <div />
              <SmallField label="Stående — skudd" value={form.shooting_standing_shots} onChange={v => set('shooting_standing_shots', v)} />
              <SmallField label="Stående — treff" value={form.shooting_standing_hits} onChange={v => set('shooting_standing_hits', v)} />
              {standingPct !== null && <StatBadge label="Stående %" value={`${standingPct}%`} />}
              <div />
              <SmallField label="Innskyting" value={form.shooting_warmup_shots} onChange={v => set('shooting_warmup_shots', v)} />
            </div>
          ) : null}
        </Section>
      )}

      {/* ── DAGSFORM ── */}
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

      {/* ── LAKTAT ── */}
      <Section label="Laktat (valgfritt)">
        <LactateTable rows={form.lactate} onChange={rows => set('lactate', rows)} />
      </Section>

      {/* ── NOTATER ── */}
      <Section label="Notater og tagger">
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Kommentar, observasjoner, følelse..."
          rows={3} style={{ ...iSt, resize: 'vertical' }} className="w-full px-4 py-3"
          onFocus={e => (e.currentTarget.style.borderColor = '#FF4500')}
          onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')} />

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
      </Section>

      {/* ── SUBMIT ── */}
      <div className="pt-4 pb-8">
        {error && (
          <p className="mb-3 px-3 py-2 text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3 mb-3">
          <button type="submit" disabled={saving}
            className="flex-1 py-4 text-lg font-semibold tracking-widest uppercase transition-opacity"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: saving ? '#7A2200' : '#FF4500',
              color: '#F0F0F2', border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
            {saving ? 'Lagrer...' : workoutId ? 'Lagre endringer' : form.is_planned ? 'Lagre plan' : 'Lagre økt'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-6 py-4 text-lg tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              backgroundColor: 'transparent', border: '1px solid #222228', cursor: 'pointer',
            }}>
            Avbryt
          </button>
        </div>

        {/* Save as template */}
        {!showTemplateInput ? (
          <button type="button" onClick={() => setShowTemplateInput(true)}
            className="text-sm tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>
            Lagre som mal →
          </button>
        ) : (
          <div className="flex gap-2">
            <input value={templateName} onChange={e => setTemplateName(e.target.value)}
              placeholder="Navn på mal..."
              className="flex-1 px-3 py-2 text-sm"
              style={{ ...iSt, fontSize: '13px', padding: '8px 12px' }} />
            <button type="button" onClick={handleSaveTemplate} disabled={savingTemplate}
              className="px-4 py-2 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#FF4500', color: '#F0F0F2', border: 'none', cursor: 'pointer',
              }}>
              {savingTemplate ? '...' : 'Lagre'}
            </button>
            <button type="button" onClick={() => setShowTemplateInput(false)}
              style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
              ×
            </button>
          </div>
        )}
      </div>
    </form>
  )
}

// ── Shared helpers ──

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

function SmallField({ label, value, onChange, type = 'number', step }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; step?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)}
        placeholder="—" min="0"
        style={{ ...iSt, width: '100%', padding: '8px 12px', fontSize: '14px' }}
        onFocus={e => (e.currentTarget.style.borderColor = '#FF4500')}
        onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')} />
    </div>
  )
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-end">
      <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>{label}</span>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500', fontSize: '22px', lineHeight: 1 }}>{value}</span>
    </div>
  )
}
