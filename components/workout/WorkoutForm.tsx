'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveWorkout } from '@/app/actions/workouts'
import {
  WorkoutFormData, MovementRow, ZoneRow, ExerciseRow,
  Sport, WorkoutType, SPORTS, WORKOUT_TYPES, DEFAULT_MOVEMENTS_BY_SPORT, SURFACE_TAGS, INTENSITY_ZONES
} from '@/lib/types'
import { MovementTable } from './MovementTable'
import { ZoneTable } from './ZoneTable'
import { ExercisesSection } from './ExercisesSection'

interface WorkoutFormProps {
  initialSport?: Sport
  initialDate?: string
  workoutId?: string
  defaultValues?: Partial<WorkoutFormData>
}

function makeDefaultMovements(sport: Sport): MovementRow[] {
  return DEFAULT_MOVEMENTS_BY_SPORT[sport].map(name => ({
    id: crypto.randomUUID(), movement_name: name, minutes: '', distance_km: '', elevation_meters: ''
  }))
}

function makeDefaultZones(): ZoneRow[] {
  return INTENSITY_ZONES.slice(0, 5).map(z => ({ zone_name: z, minutes: '' }))
}

export function WorkoutForm({ initialSport = 'running', initialDate, workoutId, defaultValues }: WorkoutFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = initialDate ?? new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<WorkoutFormData>({
    title: defaultValues?.title ?? '',
    date: defaultValues?.date ?? today,
    time_of_day: defaultValues?.time_of_day ?? '',
    sport: defaultValues?.sport ?? initialSport,
    workout_type: defaultValues?.workout_type ?? 'endurance',
    is_planned: defaultValues?.is_planned ?? false,
    is_important: defaultValues?.is_important ?? false,
    movements: defaultValues?.movements ?? makeDefaultMovements(defaultValues?.sport ?? initialSport),
    zones: defaultValues?.zones ?? makeDefaultZones(),
    exercises: defaultValues?.exercises ?? [],
    strength_type: defaultValues?.strength_type ?? 'base',
    day_form_physical: defaultValues?.day_form_physical ?? null,
    day_form_mental: defaultValues?.day_form_mental ?? null,
    sleep_hours: defaultValues?.sleep_hours ?? '',
    sleep_quality: defaultValues?.sleep_quality ?? null,
    resting_hr: defaultValues?.resting_hr ?? '',
    rpe: defaultValues?.rpe ?? null,
    lactate_warmup: defaultValues?.lactate_warmup ?? '',
    lactate_during: defaultValues?.lactate_during ?? '',
    lactate_after: defaultValues?.lactate_after ?? '',
    notes: defaultValues?.notes ?? '',
    tags: defaultValues?.tags ?? [],
    shooting_basis_rounds: defaultValues?.shooting_basis_rounds ?? '',
    shooting_basis_hits: defaultValues?.shooting_basis_hits ?? '',
    shooting_easy_combo_rounds: defaultValues?.shooting_easy_combo_rounds ?? '',
    shooting_hard_combo_rounds: defaultValues?.shooting_hard_combo_rounds ?? '',
    shooting_prone_pct: defaultValues?.shooting_prone_pct ?? '',
    shooting_standing_pct: defaultValues?.shooting_standing_pct ?? '',
  })

  const set = <K extends keyof WorkoutFormData>(key: K, value: WorkoutFormData[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const handleSportChange = (sport: Sport) => {
    setForm(f => ({
      ...f,
      sport,
      movements: makeDefaultMovements(sport),
    }))
  }

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) { setError('Tittel er påkrevd'); return }
    setSaving(true)
    setError(null)
    const result = await saveWorkout(form, workoutId)
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/athlete/week')
      router.refresh()
    }
  }

  const isStrength = form.workout_type === 'strength'
  const isBiathlon = form.sport === 'biathlon'

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-8 space-y-0">

      {/* ── GRUNNINFO ── */}
      <Section label="Grunninfo">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Tittel</Label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="F.eks. 5×5min terskelintervall"
              required
              style={inputSt}
              className="w-full px-4 py-3"
              onFocus={e => (e.currentTarget.style.borderColor = '#FF4500')}
              onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')}
            />
          </div>

          <div>
            <Label>Dato</Label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              required style={inputSt} className="w-full px-4 py-3" />
          </div>
          <div>
            <Label>Klokkeslett (valgfritt)</Label>
            <input type="time" value={form.time_of_day} onChange={e => set('time_of_day', e.target.value)}
              style={inputSt} className="w-full px-4 py-3" />
          </div>

          <div>
            <Label>Sport</Label>
            <select value={form.sport} onChange={e => handleSportChange(e.target.value as Sport)}
              style={inputSt} className="w-full px-4 py-3">
              {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Økttype</Label>
            <select value={form.workout_type} onChange={e => set('workout_type', e.target.value as WorkoutType)}
              style={inputSt} className="w-full px-4 py-3">
              {WORKOUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <ToggleChip active={form.is_planned} onClick={() => set('is_planned', !form.is_planned)}>
            Planlagt økt
          </ToggleChip>
          <ToggleChip active={form.is_important} onClick={() => set('is_important', !form.is_important)} color="#FF4500">
            ★ Viktig økt
          </ToggleChip>
        </div>
      </Section>

      {/* ── BEVEGELSESFORMER ── */}
      <Section label="Bevegelsesformer">
        <MovementTable
          rows={form.movements}
          onChange={rows => set('movements', rows)}
          availableMovements={DEFAULT_MOVEMENTS_BY_SPORT[form.sport]}
        />
      </Section>

      {/* ── INTENSITETSSONER ── */}
      {!isStrength && (
        <Section label="Intensitetssoner">
          <ZoneTable rows={form.zones} onChange={rows => set('zones', rows)} />
        </Section>
      )}

      {/* ── STYRKEØKT ── */}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SmallField label="Basis — runder" value={form.shooting_basis_rounds}
              onChange={v => set('shooting_basis_rounds', v)} />
            <SmallField label="Basis — treff" value={form.shooting_basis_hits}
              onChange={v => set('shooting_basis_hits', v)} />
            <SmallField label="Rolig komb. runder" value={form.shooting_easy_combo_rounds}
              onChange={v => set('shooting_easy_combo_rounds', v)} />
            <SmallField label="Hard komb. runder" value={form.shooting_hard_combo_rounds}
              onChange={v => set('shooting_hard_combo_rounds', v)} />
            <SmallField label="Liggende %" value={form.shooting_prone_pct}
              onChange={v => set('shooting_prone_pct', v)} />
            <SmallField label="Stående %" value={form.shooting_standing_pct}
              onChange={v => set('shooting_standing_pct', v)} />
          </div>
        </Section>
      )}

      {/* ── DAGSRAPPORT ── */}
      <Section label="Dagsrapport">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label>Dagsform fysisk</Label>
            <StarRating value={form.day_form_physical} onChange={v => set('day_form_physical', v)} />
          </div>
          <div>
            <Label>Dagsform mental</Label>
            <StarRating value={form.day_form_mental} onChange={v => set('day_form_mental', v)} />
          </div>
          <div>
            <Label>Søvnkvalitet</Label>
            <StarRating value={form.sleep_quality} onChange={v => set('sleep_quality', v)} />
          </div>
          <div>
            <Label>Søvn (timer)</Label>
            <input type="number" step="0.5" min="0" max="24"
              value={form.sleep_hours} onChange={e => set('sleep_hours', e.target.value)}
              placeholder="7.5" style={inputSt} className="w-full px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <Label>Hvilepuls</Label>
            <input type="number" value={form.resting_hr} onChange={e => set('resting_hr', e.target.value)}
              placeholder="bpm" style={inputSt} className="w-full px-3 py-2" />
          </div>
          <div>
            <Label>RPE (1–10)</Label>
            <RPESelector value={form.rpe} onChange={v => set('rpe', v)} />
          </div>
        </div>
      </Section>

      {/* ── LAKTAT ── */}
      <Section label="Laktat (valgfritt)">
        <div className="grid grid-cols-3 gap-3">
          <SmallField label="Oppvarming (mmol)" value={form.lactate_warmup} onChange={v => set('lactate_warmup', v)} type="number" step="0.1" />
          <SmallField label="Underveis (mmol)" value={form.lactate_during} onChange={v => set('lactate_during', v)} type="number" step="0.1" />
          <SmallField label="Etter økt (mmol)" value={form.lactate_after} onChange={v => set('lactate_after', v)} type="number" step="0.1" />
        </div>
      </Section>

      {/* ── NOTATER & TAGGER ── */}
      <Section label="Notater og tagger">
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Kommentar, observasjoner, følelse..."
          rows={3}
          style={{ ...inputSt, resize: 'vertical' }}
          className="w-full px-4 py-3"
        />

        <div className="mt-3">
          <Label>Underlag / tagger</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {SURFACE_TAGS.map(tag => (
              <ToggleChip key={tag} active={form.tags.includes(tag)} onClick={() => toggleTag(tag)}>
                {tag}
              </ToggleChip>
            ))}
          </div>
        </div>
      </Section>

      {/* ── SUBMIT ── */}
      <div className="pt-4 pb-8">
        {error && (
          <p className="mb-3 px-3 py-2 text-sm" style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#FF4500', backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)',
          }}>
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="flex-1 py-4 text-lg font-semibold tracking-widest uppercase transition-opacity"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: saving ? '#7A2200' : '#FF4500',
              color: '#F0F0F2', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? 'Lagrer...' : workoutId ? 'Lagre endringer' : 'Lagre økt'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-6 py-4 text-lg tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#8A8A96', backgroundColor: 'transparent',
              border: '1px solid #222228', cursor: 'pointer',
            }}>
            Avbryt
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Hjelpkomponenter ──

const inputSt: React.CSSProperties = {
  backgroundColor: '#16161A',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '15px',
  outline: 'none',
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
      <div className="py-5">
        {children}
      </div>
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
    <div className="flex gap-1 mt-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onClick={() => onChange(value === n ? null : n)}
          style={{
            fontSize: '20px',
            color: (value ?? 0) >= n ? '#FF4500' : '#2A2A30',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
            lineHeight: 1,
          }}>
          ★
        </button>
      ))}
    </div>
  )
}

function RPESelector({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button key={n} type="button"
          onClick={() => onChange(value === n ? null : n)}
          className="w-7 h-7 text-xs font-semibold transition-colors"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            backgroundColor: value === n ? '#FF4500' : '#1C1C21',
            color: value === n ? '#F0F0F2' : '#555560',
            border: `1px solid ${value === n ? '#FF4500' : '#222228'}`,
            cursor: 'pointer',
          }}>
          {n}
        </button>
      ))}
    </div>
  )
}

function ToggleChip({ active, onClick, children, color = '#555560' }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string
}) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1 text-sm tracking-widest uppercase transition-colors"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: active ? `${color}22` : 'transparent',
        color: active ? color : '#555560',
        border: `1px solid ${active ? color : '#222228'}`,
        cursor: 'pointer',
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
        style={{ ...inputSt, width: '100%', padding: '8px 12px', fontSize: '14px' }}
        onFocus={e => (e.currentTarget.style.borderColor = '#FF4500')}
        onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')}
      />
    </div>
  )
}
