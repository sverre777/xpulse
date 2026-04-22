'use client'

import type { PeriodizationTemplate } from '@/lib/template-types'

interface Props {
  initialTemplates: PeriodizationTemplate[]
}

export function PeriodiseringMalTab({ initialTemplates }: Props) {
  return (
    <div className="p-8 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p className="text-sm tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Periodiseringsmaler
      </p>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {initialTemplates.length} eksisterende mal{initialTemplates.length === 1 ? '' : 'er'}. Sesong-bygger kommer i Fase D.
      </p>
    </div>
  )
}
