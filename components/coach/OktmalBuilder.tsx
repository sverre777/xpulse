'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WorkoutForm } from '@/components/workout/WorkoutForm'
import type { Sport, WorkoutTemplate, WorkoutFormData } from '@/lib/types'

interface Props {
  primarySport: Sport
  templates: WorkoutTemplate[]
  defaultValues?: Partial<WorkoutFormData>
  onClose: () => void
}

export function OktmalBuilder({ primarySport, templates, defaultValues, onClose }: Props) {
  const router = useRouter()

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
            Ny øktmal
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
      </div>
    </div>
  )
}
