'use client'

import type { MultipleAthletesAnalysis } from '@/app/actions/comparison'

export function SammenligneOverviewTab({ data }: { data: MultipleAthletesAnalysis }) {
  return (
    <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p className="text-sm tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Oversikt-sammenligning for {data.athletes.length} utøvere — bygges i fase 8.
      </p>
    </div>
  )
}
