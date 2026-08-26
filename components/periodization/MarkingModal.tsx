'use client'

// Kø #39 del B: detaljpanel for markeringsperioder (📍 samling / 🏔 høyde).
// Dag-presise datovelgere. Åpnes fra lerretets Samling-verktøy (dra grovt
// spenn → forhåndsutfylt via initialStart/initialEnd), ✋ på et bånd, eller
// markerings-listen under Perioder. Markeringer ligger som eget lag over
// belastningsperiodene — fri overlapp, ingen trim/splitt på tvers.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createMarking, updateMarking, deleteMarking,
  type SeasonMarking,
} from '@/app/actions/seasons'
import { ModalShell, FieldLabel, INPUT_STYLE, ErrorText, ModalFooter } from './ModalShell'

export function MarkingModal({
  open, onClose, seasonId, seasonStart, seasonEnd, editing, initialStart, initialEnd, targetUserId,
}: {
  open: boolean
  onClose: () => void
  seasonId: string
  seasonStart: string
  seasonEnd: string
  editing?: SeasonMarking | null
  initialStart?: string
  initialEnd?: string
  targetUserId?: string
}) {
  const router = useRouter()
  const [name, setName] = useState(editing?.name ?? '')
  const [isCamp, setIsCamp] = useState(editing?.is_training_camp ?? true)
  const [location, setLocation] = useState(editing?.location ?? '')
  const [isAltitude, setIsAltitude] = useState(editing?.is_altitude ?? false)
  const [altitudeMeters, setAltitudeMeters] = useState(editing?.altitude_meters != null ? String(editing.altitude_meters) : '')
  const [startDate, setStartDate] = useState(editing?.start_date ?? initialStart ?? seasonStart)
  const [endDate, setEndDate] = useState(editing?.end_date ?? initialEnd ?? initialStart ?? seasonStart)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && !!startDate && !!endDate
    && endDate >= startDate && (isCamp || isAltitude) && !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null)
    const payload = {
      season_id: seasonId,
      name,
      is_training_camp: isCamp,
      is_altitude: isAltitude,
      location: isCamp ? (location.trim() || null) : null,
      altitude_meters: isAltitude && altitudeMeters !== '' ? Math.round(Number(altitudeMeters)) : null,
      notes,
      start_date: startDate,
      end_date: endDate,
      targetUserId,
    }
    const res = editing
      ? await updateMarking(editing.id, payload)
      : await createMarking(payload)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    setBusy(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm(`Slette markeringen "${editing.name}"?`)) return
    setBusy(true); setError(null)
    const res = await deleteMarking(editing.id, targetUserId)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.refresh()
    setBusy(false)
    onClose()
  }

  return (
    <ModalShell open={open} onClose={onClose} title={editing ? 'Rediger samling/høyde' : 'Ny samling/høyde'}>
      <form onSubmit={handleSubmit}>
        <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          Sesong: {seasonStart} → {seasonEnd}. Markeringen ligger som eget bånd
          over belastningsperiodene og kan fritt overlappe dem.
        </p>
        <div className="mb-3">
          <FieldLabel>Navn</FieldLabel>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} placeholder="Sjusjøen-samling, Høydeopphold Font Romeu, …" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <FieldLabel>Startdato</FieldLabel>
            <input type="date" value={startDate} min={seasonStart} max={seasonEnd}
              onChange={e => setStartDate(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <FieldLabel>Sluttdato</FieldLabel>
            <input type="date" value={endDate} min={seasonStart} max={seasonEnd}
              onChange={e => setEndDate(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
        <div className="mb-3" style={{ borderTop: '1px solid var(--kant-3)', paddingTop: '12px' }}>
          <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
            <input type="checkbox" checked={isCamp} onChange={e => setIsCamp(e.target.checked)} />
            <span>📍 Treningssamling</span>
          </label>
          {isCamp && (
            <div className="mt-2">
              <FieldLabel>Sted</FieldLabel>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                style={INPUT_STYLE} placeholder="f.eks. Sjusjøen, Sierra Nevada" />
            </div>
          )}
        </div>
        <div className="mb-3" style={{ borderTop: '1px solid var(--kant-3)', paddingTop: '12px' }}>
          <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
            <input type="checkbox" checked={isAltitude} onChange={e => setIsAltitude(e.target.checked)} />
            <span>🏔️ Høydeopphold</span>
          </label>
          {isAltitude && (
            <div className="mt-2">
              <FieldLabel>Høyde (moh)</FieldLabel>
              <input type="number" inputMode="numeric" min={0} max={9000} step={50}
                value={altitudeMeters} onChange={e => setAltitudeMeters(e.target.value)}
                style={INPUT_STYLE} placeholder="f.eks. 1800" />
            </div>
          )}
        </div>
        {!isCamp && !isAltitude && (
          <p className="text-xs mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E8B93C' }}>
            Velg samling, høyde eller begge.
          </p>
        )}
        <div className="mb-1">
          <FieldLabel>Notat</FieldLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
        </div>
        {error && <ErrorText message={error} />}
        <ModalFooter
          submitLabel={editing ? 'Lagre' : 'Opprett'}
          disabled={!canSubmit}
          onCancel={onClose}
          busy={busy}
          onDelete={editing ? handleDelete : undefined}
        />
      </form>
    </ModalShell>
  )
}
