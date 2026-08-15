'use client'

// Bla i standard-øvelsesbiblioteket per kategori (kø #46-oppfølger).
// Delt av økt-skjemaets øvelses-autocomplete og live-øktens legg-til-felt:
// kategorichips → øvelsesliste → valg sendes til onPick. Første flate som
// konsumerer STANDARD_EXERCISE_CATEGORIES (inkl. nye «Bæring / grep»).

import { useState } from 'react'
import {
  STANDARD_EXERCISES, STANDARD_EXERCISE_CATEGORIES,
  type StandardExerciseCategory,
} from '@/lib/standard-exercises'

export function StandardExerciseBrowser({ onPick }: {
  onPick: (name: string) => void
}) {
  const [cat, setCat] = useState<StandardExerciseCategory | null>(null)
  const list = cat ? STANDARD_EXERCISES.filter(e => e.category === cat) : []
  return (
    <div>
      <div className="flex flex-wrap" style={{ gap: 6, padding: '10px 10px 8px' }}>
        {STANDARD_EXERCISE_CATEGORIES.map(c => {
          const active = cat === c.key
          return (
            <button key={c.key} type="button"
              onClick={() => setCat(active ? null : c.key)}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
                letterSpacing: '0.05em', borderRadius: 999, padding: '7px 12px',
                minHeight: 32, cursor: 'pointer',
                color: active ? '#0A0A0B' : '#C0C0CC',
                background: active ? 'var(--accent)' : 'var(--card2)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--line2)'}`,
              }}>
              {c.label}
            </button>
          )
        })}
      </div>
      {cat && (
        <div style={{ maxHeight: 240, overflowY: 'auto', borderTop: '1px solid var(--line)' }}>
          {list.map(e => (
            <button key={e.name} type="button" onClick={() => onPick(e.name)}
              className="transition-colors hover:bg-[#1E1E22]"
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', borderBottom: '1px solid var(--line)',
                color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 14, padding: '10px 12px', cursor: 'pointer', minHeight: 38,
              }}>
              {e.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
