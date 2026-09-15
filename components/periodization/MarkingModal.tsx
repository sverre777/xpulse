'use client'

// Kø #39 del B: detaljpanel for markeringsperioder (samling / høyde).
// Dag-presise datovelgere. Åpnes fra lerretets Samling-verktøy (dra grovt
// spenn → forhåndsutfylt via initialStart/initialEnd), klikk på et bånd, eller
// markerings-listen under Perioder. Markeringer ligger som eget lag over
// belastningsperiodene — fri overlapp, ingen trim/splitt på tvers.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createMarking, createMarkingForDates, updateMarking, deleteMarking,
  type SeasonMarking,
} from '@/app/actions/seasons'
import { ModalShell, FieldLabel, INPUT_STYLE, ErrorText, ModalFooter } from './ModalShell'
import { Ikon } from '@/components/ui/ikoner'
import { MARKERING_IKON, MARKERING_FARGE } from '@/lib/nokkeldato-ikoner'

// ÉN modal for samling/høyde (Sverre 15. sep 2026): årsplanen, dag-popupens
// SAMLING-knapp og «+ legg til periode» -> «Samling/høyde» åpner alle denne.
// Den gamle components/calendar/SamlingModal er slettet. Uten seasonId finner
// serveren sesongen selv ut fra datoene (createMarkingForDates) - datoene
// låses aldri til én sesong her; valideringen bor på serveren.
export function MarkingModal({
  open, onClose, seasonId, seasonStart, seasonEnd, editing, initialStart, initialEnd, targetUserId, onIngenSesong,
}: {
  open: boolean
  onClose: () => void
  /** Årsplanen sender sin sesong; plan/dagbok kan la den være tom. */
  seasonId?: string | null
  seasonStart?: string
  seasonEnd?: string
  editing?: SeasonMarking | null
  initialStart?: string
  initialEnd?: string
  targetUserId?: string
  /** Serveren fant ingen sesong for datoene: vis «Opprett sesong»-veien. */
  onIngenSesong?: (fra: string, til: string) => void
}) {
  const router = useRouter()
  const [name, setName] = useState(editing?.name ?? '')
  const [isCamp, setIsCamp] = useState(editing?.is_training_camp ?? true)
  const [location, setLocation] = useState(editing?.location ?? '')
  const [isAltitude, setIsAltitude] = useState(editing?.is_altitude ?? false)
  const [altitudeMeters, setAltitudeMeters] = useState(editing?.altitude_meters != null ? String(editing.altitude_meters) : '')
  const [startDate, setStartDate] = useState(editing?.start_date ?? initialStart ?? seasonStart ?? '')
  const [endDate, setEndDate] = useState(editing?.end_date ?? initialEnd ?? initialStart ?? seasonStart ?? '')
  const [ingenSesong, setIngenSesong] = useState(false)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && !!startDate && !!endDate
    && endDate >= startDate && (isCamp || isAltitude) && !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null); setIngenSesong(false)
    const payload = {
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
    const sesongId = editing?.season_id ?? seasonId ?? null
    const res = editing
      ? await updateMarking(editing.id, { ...payload, season_id: sesongId as string })
      : sesongId
        ? await createMarking({ ...payload, season_id: sesongId })
        : await createMarkingForDates(payload)
    if (res.error) {
      setError(res.error); setBusy(false)
      if (/ingen sesong/i.test(res.error)) setIngenSesong(true)
      return
    }
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
          {seasonStart && seasonEnd ? `Sesong: ${seasonStart} → ${seasonEnd}. ` : ''}Markeringen ligger som eget bånd
          over belastningsperiodene og kan fritt overlappe dem.
        </p>
        <div className="mb-3">
          <FieldLabel>Navn</FieldLabel>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} placeholder="Sjusjøen-samling, Høydeopphold Font Romeu, …" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <FieldLabel>Startdato</FieldLabel>
            {/* Ingen min/max (Sverre 15. sep) - serveren validerer mot sesongen. */}
            <input type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <FieldLabel>Sluttdato</FieldLabel>
            <input type="date" value={endDate}
              onChange={e => setEndDate(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
        <div className="mb-3" style={{ borderTop: '1px solid var(--kant-3)', paddingTop: '12px' }}>
          <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
            <input type="checkbox" checked={isCamp} onChange={e => setIsCamp(e.target.checked)} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ikon navn={MARKERING_IKON.samling} variant="fyll" storrelse={14} style={{ color: MARKERING_FARGE.samling }} />Treningssamling</span>
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Ikon navn={MARKERING_IKON.hoyde} variant="fyll" storrelse={18} style={{ color: MARKERING_FARGE.hoyde }} />Høydeopphold</span>
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
        {error && !ingenSesong && <ErrorText message={error} />}
        {error && ingenSesong && (
          <div role="alert" data-ingen-sesong className="mt-3" style={{ border: '1px solid rgba(225,29,72,.55)', background: 'rgba(225,29,72,.08)', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5, color: '#E11D48', margin: 0 }}>
              Ingen sesong dekker {datoNO(startDate)}{endDate !== startDate ? ` - ${datoNO(endDate)}` : ''}.
            </p>
            {onIngenSesong && (
              <button type="button" className="xp-pill xp-pill-primary xp-pill-sm mt-2" data-opprett-sesong
                onClick={() => onIngenSesong(startDate, endDate)}>
                Opprett sesong {sesongNavnFor(startDate)}
              </button>
            )}
          </div>
        )}
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

/** «21. september» - som i resten av appen. */
function datoNO(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
}

/** Sesongen som naturlig dekker datoen: 1. mai - 30. april, «2026/27». */
export function sesongNavnFor(iso: string): string {
  const d = new Date((iso || new Date().toISOString().slice(0, 10)) + 'T12:00:00')
  const start = d.getMonth() >= 4 ? d.getFullYear() : d.getFullYear() - 1
  return `${start}/${String(start + 1).slice(-2)}`
}
export function sesongDatoerFor(iso: string): { start: string; end: string; navn: string } {
  const navn = sesongNavnFor(iso)
  const start = Number(navn.slice(0, 4))
  return { start: `${start}-05-01`, end: `${start + 1}-04-30`, navn: `Sesong ${navn}` }
}
