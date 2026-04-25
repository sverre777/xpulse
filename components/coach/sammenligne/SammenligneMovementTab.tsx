'use client'

import type { MultipleAthletesAnalysis } from '@/app/actions/comparison'

export function SammenligneMovementTab({ data: _data }: { data: MultipleAthletesAnalysis }) {
  void _data
  return <TabStub label="Per bevegelsesform kommer i fase 8." />
}

function TabStub({ label }: { label: string }) {
  return (
    <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p className="text-sm tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
    </div>
  )
}
