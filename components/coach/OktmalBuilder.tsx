'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorkoutForm } from '@/components/workout/WorkoutForm'
import { updateTemplate } from '@/app/actions/templates'
import type { Sport, WorkoutTemplate, WorkoutFormData } from '@/lib/types'

interface Props {
  primarySport: Sport
  templates: WorkoutTemplate[]
  defaultValues?: Partial<WorkoutFormData>
  // Når satt: redigerer eksisterende mal i stedet for å lage ny. WorkoutForm
  // pre-fylles fra editing.template_data + activities, og lagring kaller
  // updateTemplate(editing.id, …) i stedet for saveAsTemplate.
  editing?: WorkoutTemplate | null
  onClose: () => void
}

export function OktmalBuilder({ primarySport, templates, defaultValues, editing, onClose }: Props) {
  const router = useRouter()
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const handleSaved = () => {
    onClose()
    router.refresh()
  }

  // Edit-modus: pre-fyll WorkoutForm fra eksisterende mal-data og bruk
  // captureOnlyMode så formen ikke kaller saveWorkout. onCapture fanger
  // form-dataen og vi kaller updateTemplate manuelt.
  const editDefaults: Partial<WorkoutFormData> | undefined = editing
    ? {
        ...editing.template_data,
        title: editing.name,
        activities: editing.activities ?? editing.template_data?.activities ?? [],
      }
    : defaultValues

  const handleCapture = async (data: WorkoutFormData) => {
    if (!editing) return
    setSaveError(null)
    const res = await updateTemplate(editing.id, {
      name: data.title,
      sport: data.sport,
      activities: data.activities,
      templateData: {
        sport: data.sport,
        workout_type: data.workout_type,
        movements: data.movements,
        notes: data.notes,
        tags: data.tags,
        strength_type: data.strength_type,
      },
    })
    if (res.error) {
      setSaveError(res.error)
      return
    }
    onClose()
    router.refresh()
  }

  return (
    <div
      onClick={onClose}
      className="px-2 md:px-3"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12px', paddingBottom: '12px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '820px', width: '100%', position: 'relative',
          margin: '0 auto', marginBottom: '24px',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ borderBottom: '1px solid #1E1E22', backgroundColor: '#0A0A0B' }}>
          <span className="text-sm tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {editing ? 'Rediger øktmal' : 'Ny øktmal'}
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

        {saveError && (
          <p className="px-4 py-2 text-xs"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
              backgroundColor: 'rgba(255,69,0,0.1)',
            }}>
            {saveError}
          </p>
        )}

        {editing ? (
          <WorkoutForm
            initialSport={editing.sport ?? primarySport}
            defaultValues={editDefaults}
            formMode="plan"
            templates={templates}
            captureOnlyMode
            onCapture={handleCapture}
            captureSubmitLabel="Lagre endringer"
            onCancel={onClose}
          />
        ) : (
          <WorkoutForm
            initialSport={primarySport}
            defaultValues={defaultValues}
            formMode="plan"
            templates={templates}
            templateBuildingMode
            onTemplateSaved={handleSaved}
            onSaved={handleSaved}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  )
}
