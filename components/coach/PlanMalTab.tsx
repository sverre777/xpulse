'use client'

import type { PlanTemplate } from '@/lib/template-types'

interface Props {
  initialTemplates: PlanTemplate[]
}

export function PlanMalTab({ initialTemplates }: Props) {
  return (
    <div className="p-8 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p className="text-sm tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Plan-maler
      </p>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {initialTemplates.length} eksisterende mal{initialTemplates.length === 1 ? '' : 'er'}. Kalender-bygger kommer i Fase C.
      </p>
    </div>
  )
}
