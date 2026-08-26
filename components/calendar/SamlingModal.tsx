'use client'

// Planlegg/rediger 📍 treningssamling og 🏔 høydeperiode rett fra kalenderen
// (plan + dagbok) — ved siden av reisedagen. Skriver til season_markings,
// SAMME rader som årsplanen viser: redigering her ER en oppdatering av
// årsplanen (én kilde, aldri sync). Sesongen resolves server-side fra datoene.

import { useState, useTransition } from 'react'
import {
  createMarkingForDates, updateMarking, deleteMarking,
  type SeasonMarking,
} from '@/app/actions/seasons'
import { xpConfirm } from '@/components/ui/ConfirmDialog'

const ORANGE = '#FF4500'

interface Props {
  // Null = ny markering (startdato forhåndsutfylt fra valgt dag).
  existing: SeasonMarking | null
  defaultDate?: string
  targetUserId?: string
  onClose: () => void
  onSaved: () => void
}

export function SamlingModal({ existing, defaultDate, targetUserId, onClose, onSaved }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    is_training_camp: existing?.is_training_camp ?? true,
    is_altitude: existing?.is_altitude ?? false,
    location: existing?.location ?? '',
    altitude_meters: existing?.altitude_meters != null ? String(existing.altitude_meters) : '',
    notes: existing?.notes ?? '',
    start_date: existing?.start_date ?? defaultDate ?? '',
    end_date: existing?.end_date ?? defaultDate ?? '',
  })
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const lagre = () => {
    setError(null)
    startTransition(async () => {
      const input = {
        name: form.name,
        is_training_camp: form.is_training_camp,
        is_altitude: form.is_altitude,
        location: form.location || null,
        altitude_meters: form.altitude_meters ? parseInt(form.altitude_meters) : null,
        notes: form.notes || null,
        start_date: form.start_date,
        end_date: form.end_date,
        targetUserId,
      }
      const res = existing
        ? await updateMarking(existing.id, { ...input, season_id: existing.season_id })
        : await createMarkingForDates(input)
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  const slett = async () => {
    if (!existing) return
    if (!await xpConfirm(`Slette «${existing.name}»? Fjernes også fra årsplanen.`)) return
    startTransition(async () => {
      const res = await deleteMarking(existing.id, targetUserId)
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'var(--scrim-75)' }} onClick={onClose}>
      <div className="w-full max-w-md p-5 mt-8" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 14 }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ORANGE }}>
            {existing ? 'Rediger samling/høyde' : 'Planlegg samling/høyde'}
          </span>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', cursor: 'pointer', fontSize: 22 }}>
            ×
          </button>
        </div>

        <div className="space-y-3">
          <Felt label="Navn">
            <input value={form.name} onChange={e => set({ name: e.target.value })}
              placeholder="F.eks. Samling Sjusjøen" autoFocus
              className="w-full px-3 py-2" style={inp} />
          </Felt>

          <div className="flex gap-2">
            <Chip aktiv={form.is_training_camp} onClick={() => set({ is_training_camp: !form.is_training_camp })}>
              📍 Samling
            </Chip>
            <Chip aktiv={form.is_altitude} onClick={() => set({ is_altitude: !form.is_altitude })}>
              🏔 Høyde
            </Chip>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Felt label="Fra">
              <input type="date" value={form.start_date} onChange={e => set({ start_date: e.target.value })}
                className="w-full px-3 py-2" style={inp} />
            </Felt>
            <Felt label="Til">
              <input type="date" value={form.end_date} onChange={e => set({ end_date: e.target.value })}
                className="w-full px-3 py-2" style={inp} />
            </Felt>
          </div>

          {form.is_training_camp && (
            <Felt label="Sted (valgfritt)">
              <input value={form.location} onChange={e => set({ location: e.target.value })}
                placeholder="F.eks. Font Romeu" className="w-full px-3 py-2" style={inp} />
            </Felt>
          )}
          {form.is_altitude && (
            <Felt label="Høyde (moh)">
              <input type="number" min="0" value={form.altitude_meters}
                onChange={e => set({ altitude_meters: e.target.value })}
                placeholder="1850" className="w-full px-3 py-2" style={inp} />
            </Felt>
          )}
          <Felt label="Notat (valgfritt)">
            <input value={form.notes} onChange={e => set({ notes: e.target.value })}
              className="w-full px-3 py-2" style={inp} />
          </Felt>

          <p className="text-xs" style={{ color: 'var(--tekst-8-app)' }}>
            Vises i kalenderen (📍/🏔 per dag) og i årsplanen — dette er samme markering,
            endringer slår gjennom begge steder.
          </p>

          {error && <p className="text-sm" style={{ color: ORANGE }}>{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 mt-5">
          {existing ? (
            <button type="button" onClick={slett} disabled={pending}
              className="px-3 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#E11D48', background: 'none',
                border: '1px solid rgba(225,29,72,0.5)', borderRadius: 999, cursor: 'pointer',
              }}>
              Slett
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: 'var(--tekst-5-app)', background: 'none', border: '1px solid var(--line2)',
                borderRadius: 999, cursor: 'pointer',
              }}>
              Avbryt
            </button>
            <button type="button" onClick={lagre} disabled={pending}
              className="px-4 py-2 text-xs font-semibold tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: ORANGE, color: 'var(--tekst-1-app)', border: 'none',
                borderRadius: 999, cursor: 'pointer', opacity: pending ? 0.6 : 1,
              }}>
              {pending ? 'Lagrer…' : 'Lagre'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({ aktiv, onClick, children }: { aktiv: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3.5 py-2 text-xs font-semibold tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        borderRadius: 999,
        border: `1px solid ${aktiv ? ORANGE : 'var(--line2)'}`,
        color: aktiv ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
        backgroundColor: aktiv ? 'rgba(255,69,0,0.10)' : 'transparent',
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

function Felt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: 'var(--tekst-1-app)', backgroundColor: 'var(--flate-4-alt)',
  border: '1px solid var(--line2)', borderRadius: 9, fontSize: 14,
}
