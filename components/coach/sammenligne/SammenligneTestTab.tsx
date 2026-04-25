'use client'

import type { AthleteTestsSnapshot } from '@/app/actions/comparison'

export function SammenligneTestTab({ data: _data }: { data: { athletes: AthleteTestsSnapshot[] } }) {
  void _data
  return <TabStub label="Test-sammenligning kommer i fase 9." />
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
