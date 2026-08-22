'use client'

// «Utstyr brukt» i økt-skjemaet — kompakt chip-rad (fasit: design seksjon 5).
// Valgt utstyr vises som chips m/ ✕; «+ Velg utstyr» åpner UtstyrVelgerPopup.
// Valget her er «hele økta»-ARV: utstyret telles på hver aktivitet automatisk.
// Bytte per aktivitet gjøres med ⇄ på aktivitetsraden — aldri krav per drag.
// Seksjonen finnes både i dagbok og plan. I PLAN er valget en intensjon
// (hvilke ski økta skal gjøres på): km og tid telles først når økta er markert
// gjennomført — da følger utvalget med som forhåndsvalgt, endrbart før lagring.

import { useState } from 'react'
import {
  normalizeCategory,
  type Equipment,
} from '@/lib/equipment-types'
import { UtstyrVelgerPopup } from './UtstyrVelgerPopup'

const KATEGORI_IKON: Record<string, string> = {
  ski: '🎿', rulleski: '🛼', skisko: '🥾', lopesko: '👟', sykkelsko: '👟',
  skistaver: '🦯', sykkel: '🚴', klokke: '⌚', annet: '🎒',
}

interface Props {
  available: Equipment[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  // Plan-modus: utstyret er planlagt, ikke brukt — teksten sier fra om at
  // km/tid først registreres ved gjennomføring.
  planlagt?: boolean
}

export function EquipmentSelectorInWorkout({ available, selectedIds, onChange, planlagt = false }: Props) {
  const [open, setOpen] = useState(false)

  const valgte = selectedIds
    .map(id => available.find(e => e.id === id))
    .filter((e): e is Equipment => !!e)

  return (
    <div className="mb-4 pb-4" style={{ borderBottom: '1px solid #1A1A1E' }}>
      <div className="flex items-baseline gap-2 flex-wrap" style={{ padding: '12px 0 8px' }}>
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {planlagt ? 'Utstyr — planlagt' : 'Utstyr brukt'}
        </span>
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#3A3A42' }}>
          {planlagt
            ? 'Km og tid telles først når økta er markert gjennomført'
            : 'Gjelder hele økta · overstyr per aktivitet ved behov'}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {valgte.map(e => (
          <span key={e.id} className="flex items-center gap-2 px-3 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#F0F0F2', fontSize: '13px',
              border: '1px solid #2A2A33', borderRadius: 999,
              backgroundColor: 'rgba(255,69,0,0.06)',
            }}>
            <span aria-hidden>{KATEGORI_IKON[normalizeCategory(e.category)] ?? '🎒'}</span>
            {e.name}
            <button type="button" aria-label={`Fjern ${e.name}`}
              onClick={() => onChange(selectedIds.filter(id => id !== e.id))}
              style={{ background: 'none', border: 'none', color: '#8A8A96', cursor: 'pointer', fontSize: '13px', padding: 0 }}>
              ✕
            </button>
          </span>
        ))}
        <button type="button" onClick={() => setOpen(true)}
          className="px-3 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#8A8A96', background: 'none',
            border: '1px dashed #2A2A33', borderRadius: 999, cursor: 'pointer',
          }}>
          + Velg utstyr
        </button>
      </div>

      {open && (
        <UtstyrVelgerPopup
          available={available}
          selectedIds={selectedIds}
          title={planlagt ? 'Utstyr — planlagt' : 'Utstyr brukt'}
          hint={planlagt
            ? 'Planlagt utstyr. Km og tid telles først når økta er markert gjennomført.'
            : 'Gjelder hele økta — telles på hver aktivitet automatisk.'}
          onDone={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
