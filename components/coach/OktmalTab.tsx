'use client'

import type { WorkoutTemplate } from '@/lib/types'

interface Props {
  initialTemplates: WorkoutTemplate[]
}

export function OktmalTab({ initialTemplates }: Props) {
  return (
    <div className="p-8 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p className="text-sm tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Øktmaler
      </p>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {initialTemplates.length} eksisterende mal{initialTemplates.length === 1 ? '' : 'er'}. Full UI kommer i Fase B.
      </p>
    </div>
  )
}
