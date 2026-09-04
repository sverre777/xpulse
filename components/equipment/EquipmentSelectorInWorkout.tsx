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
  EQUIPMENT_CATEGORY_ICONS,
  normalizeCategory,
  type Equipment,
} from '@/lib/equipment-types'
import { UtstyrVelgerPopup } from './UtstyrVelgerPopup'

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
    <div className="sf17-utstyr" data-utstyr-linje>
      {/* SF-17: alt på ÉN linje — etikett + knapp + hjelpetekst; valgt utstyr
          som chips på samme linje, bryter ved behov. */}
      <span className="sf17-utstyr-etikett">{planlagt ? 'Utstyr — planlagt' : 'Utstyr brukt'}</span>
      <button type="button" onClick={() => setOpen(true)}
        className="sf17-utstyr-knapp"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: 'var(--tekst-5-app)', background: 'none',
          border: '1px dashed var(--line2)', borderRadius: 999, cursor: 'pointer',
        }}>
        + Velg utstyr
      </button>
      <span className="sf17-utstyr-hjelp">
        {planlagt
          ? 'Km og tid telles først når økta er markert gjennomført'
          : 'Gjelder hele økta · overstyr per aktivitet ved behov'}
      </span>
      {valgte.map(e => (
        <span key={e.id} className="sf17-utstyr-chip"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: 'var(--tekst-1-app)', fontSize: '13px',
            border: '1px solid var(--line2)', borderRadius: 999,
            backgroundColor: 'rgba(255,69,0,0.06)',
          }}>
          <span aria-hidden>{EQUIPMENT_CATEGORY_ICONS[normalizeCategory(e.category)]}</span>
          {e.name}
          <button type="button" aria-label={`Fjern ${e.name}`}
            onClick={() => onChange(selectedIds.filter(id => id !== e.id))}
            style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', cursor: 'pointer', fontSize: '13px', padding: 0, minWidth: 24, minHeight: 24 }}>
            ✕
          </button>
        </span>
      ))}

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
