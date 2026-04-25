'use client'

import { useState } from 'react'
import {
  EQUIPMENT_CATEGORY_LABELS,
  type Equipment,
} from '@/lib/equipment-types'

interface Props {
  available: Equipment[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

// Kollapsbar seksjon for å velge utstyr brukt på en økt. Brukeren toggler
// utstyr eksplisitt; vi auto-foreslår ikke. Tom liste vises som tom-tilstand
// med lenke til /app/utstyr.
export function EquipmentSelectorInWorkout({ available, selectedIds, onChange }: Props) {
  const [open, setOpen] = useState(selectedIds.length > 0)

  const activeAvailable = available.filter(e => e.status === 'active')

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter(s => s !== id))
    else onChange([...selectedIds, id])
  }

  return (
    <div className="mb-4 pb-4" style={{ borderBottom: '1px solid #1A1A1E' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0' }}>
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Utstyr brukt {selectedIds.length > 0 && `(${selectedIds.length})`}
        </span>
        <span style={{ color: '#555560', fontSize: '14px' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="pt-2">
          {activeAvailable.length === 0 ? (
            <p className="text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Du har ingen aktivt utstyr. Legg til på <a href="/app/utstyr"
                style={{ color: '#FF4500', textDecoration: 'underline' }}>/app/utstyr</a>.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeAvailable.map(e => {
                const selected = selectedIds.includes(e.id)
                const subtitle = [e.brand, e.model].filter(Boolean).join(' ')
                return (
                  <button key={e.id} type="button" onClick={() => toggle(e.id)}
                    className="px-3 py-2 text-sm transition-colors"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: selected ? '#F0F0F2' : '#8A8A96',
                      background: selected ? '#1A0E08' : 'none',
                      border: selected ? '1px solid #FF4500' : '1px solid #1E1E22',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}>
                    <div className="text-xs tracking-widest uppercase"
                      style={{ color: selected ? '#FF4500' : '#555560' }}>
                      {EQUIPMENT_CATEGORY_LABELS[e.category]}
                    </div>
                    <div>{e.name}</div>
                    {subtitle && (
                      <div className="text-xs" style={{ color: '#555560' }}>{subtitle}</div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
