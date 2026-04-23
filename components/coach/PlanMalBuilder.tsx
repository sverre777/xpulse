'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePlanTemplate, updatePlanTemplate } from '@/app/actions/plan-templates'
import type {
  PlanTemplate, PlanTemplateData, PlanTemplateDayState, PlanTemplateWorkout,
} from '@/lib/template-types'
import { TEMPLATE_CATEGORIES, type Sport, type WorkoutTemplate } from '@/lib/types'
import { RelativeDateCalendar } from '@/components/coach/RelativeDateCalendar'
import { PlanMalDayEditor } from '@/components/coach/PlanMalDayEditor'

const COACH_BLUE = '#1A6FD4'

interface Props {
  primarySport: Sport
  workoutTemplates: WorkoutTemplate[]
  editing?: PlanTemplate | null
  onClose: () => void
}

const EMPTY_DATA: PlanTemplateData = {
  workouts: [], day_states: [], week_notes: {}, month_notes: {}, focus_points: [],
}

export function PlanMalBuilder({ primarySport, workoutTemplates, editing, onClose }: Props) {
  const router = useRouter()
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [category, setCategory] = useState(editing?.category ?? 'Annet')
  const [durationDays, setDurationDays] = useState<number>(editing?.duration_days ?? 28)
  const [data, setData] = useState<PlanTemplateData>(editing?.plan_data ?? EMPTY_DATA)
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openDay == null) onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, openDay])

  const workoutsForOpen = useMemo(() => {
    if (openDay == null) return []
    return data.workouts
      .map((w, i) => ({ w, i }))
      .filter(x => x.w.day_offset === openDay)
  }, [data.workouts, openDay])

  const stateForOpen: PlanTemplateDayState | null = useMemo(() => {
    if (openDay == null) return null
    return data.day_states.find(s => s.day_offset === openDay) ?? null
  }, [data.day_states, openDay])

  const addWorkout = (w: PlanTemplateWorkout) => {
    setData(d => ({ ...d, workouts: [...d.workouts, w] }))
  }

  // Indeks refererer til subset filtrert på dayOffset — oversett til global indeks.
  const updateWorkoutAtLocalIndex = (localIndex: number, w: PlanTemplateWorkout) => {
    if (openDay == null) return
    const ids = data.workouts.map((ww, i) => ({ ww, i })).filter(x => x.ww.day_offset === openDay)
    const globalIdx = ids[localIndex]?.i
    if (globalIdx == null) return
    setData(d => {
      const next = d.workouts.slice()
      next[globalIdx] = w
      return { ...d, workouts: next }
    })
  }

  const removeWorkoutAtLocalIndex = (localIndex: number) => {
    if (openDay == null) return
    const ids = data.workouts.map((ww, i) => ({ ww, i })).filter(x => x.ww.day_offset === openDay)
    const globalIdx = ids[localIndex]?.i
    if (globalIdx == null) return
    setData(d => ({ ...d, workouts: d.workouts.filter((_, i) => i !== globalIdx) }))
  }

  const setRestDay = () => {
    if (openDay == null) return
    setData(d => {
      const filtered = d.day_states.filter(s => s.day_offset !== openDay)
      filtered.push({
        day_offset: openDay,
        state_type: 'hviledag',
        is_planned: true,
        sub_type: null,
        notes: null,
      })
      return { ...d, day_states: filtered }
    })
  }

  const clearRestDay = () => {
    if (openDay == null) return
    setData(d => ({
      ...d,
      day_states: d.day_states.filter(s => s.day_offset !== openDay),
    }))
  }

  const handleDurationChange = (next: number) => {
    if (!Number.isFinite(next) || next < 1) return
    setDurationDays(next)
    if (next < durationDays) {
      setData(d => ({
        ...d,
        workouts: d.workouts.filter(w => w.day_offset < next),
        day_states: d.day_states.filter(s => s.day_offset < next),
        focus_points: d.focus_points.filter(f => f.scope !== 'day' || f.period_offset < next),
      }))
    }
  }

  const handleSave = () => {
    if (!name.trim()) { setErr('Navn er påkrevd'); return }
    if (durationDays < 1) { setErr('Varighet må være minst én dag'); return }
    setErr(null)
    startTransition(async () => {
      if (editing) {
        const res = await updatePlanTemplate(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          category,
          duration_days: durationDays,
          plan_data: data,
        })
        if (res.error) { setErr(res.error); return }
      } else {
        const res = await savePlanTemplate({
          name: name.trim(),
          description: description.trim() || null,
          category,
          duration_days: durationDays,
          plan_data: data,
        })
        if (res.error) { setErr(res.error); return }
      }
      onClose()
      router.refresh()
    })
  }

  const totalWorkouts = data.workouts.length
  const totalRest = data.day_states.filter(s => s.state_type === 'hviledag').length

  return (
    <div
      onClick={onClose}
      className="px-2 md:px-3"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 90, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12px', paddingBottom: '12px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '960px', width: '100%',
          margin: '0 auto', marginBottom: '24px',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#0A0A0B' }}>
          <span className="text-sm tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}>
            {editing ? 'Rediger plan-mal' : 'Ny plan-mal'}
          </span>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{
              color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 28, lineHeight: 1, padding: 0,
              minHeight: '44px', minWidth: '44px',
            }}>
            ×
          </button>
        </div>

        <div className="p-4 md:p-5 flex flex-col gap-5">
          {err && (
            <p className="text-xs px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
                border: '1px solid #E11D48',
              }}>
              {err}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Navn">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="F.eks. 4-ukers grunntrening"
                style={iSt} />
            </Field>
            <Field label="Kategori">
              <select value={category} onChange={e => setCategory(e.target.value)} style={iSt}>
                {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Beskrivelse">
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={2} style={iSt} />
            </Field>
            <Field label="Varighet (dager)">
              <input type="number" min={1} max={365}
                value={durationDays}
                onChange={e => handleDurationChange(parseInt(e.target.value) || 1)}
                style={iSt} />
            </Field>
          </div>

          <div className="flex items-center gap-4 text-[11px] tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            <span>{totalWorkouts} økt{totalWorkouts === 1 ? '' : 'er'}</span>
            <span>· {totalRest} hviledag{totalRest === 1 ? '' : 'er'}</span>
            <span>· {Math.ceil(durationDays / 7)} uke{Math.ceil(durationDays / 7) === 1 ? '' : 'r'}</span>
          </div>

          <RelativeDateCalendar
            durationDays={durationDays}
            workouts={data.workouts}
            dayStates={data.day_states}
            onDayClick={(d) => setOpenDay(d)}
          />

          <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid #1E1E22' }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                background: 'none', border: '1px solid #222228', cursor: 'pointer',
              }}>
              Avbryt
            </button>
            <button type="button" onClick={handleSave} disabled={isPending}
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: COACH_BLUE, color: '#F0F0F2',
                border: 'none',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1,
              }}>
              {isPending ? 'Lagrer…' : (editing ? 'Lagre endringer' : 'Lagre plan-mal')}
            </button>
          </div>
        </div>
      </div>

      {openDay != null && (
        <PlanMalDayEditor
          dayOffset={openDay}
          primarySport={primarySport}
          workoutTemplates={workoutTemplates}
          existingWorkouts={workoutsForOpen.map(x => x.w)}
          existingState={stateForOpen}
          onAddWorkout={addWorkout}
          onUpdateWorkout={updateWorkoutAtLocalIndex}
          onRemoveWorkout={removeWorkoutAtLocalIndex}
          onSetRestDay={setRestDay}
          onClearRestDay={clearRestDay}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#16161A',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '8px 10px',
  width: '100%',
  outline: 'none',
}
