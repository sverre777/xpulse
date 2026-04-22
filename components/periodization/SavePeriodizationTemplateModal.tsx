'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildPeriodizationTemplateFromSeason, savePeriodizationTemplate,
} from '@/app/actions/periodization-templates'
import { TEMPLATE_CATEGORIES } from '@/lib/types'

interface SeasonOption {
  id: string
  name: string
  start_date: string
  end_date: string
}

interface Props {
  seasons: SeasonOption[]
  defaultSeasonId: string | null
  onClose: () => void
}

export function SavePeriodizationTemplateModal({ seasons, defaultSeasonId, onClose }: Props) {
  const router = useRouter()
  const [seasonId, setSeasonId] = useState<string>(defaultSeasonId ?? (seasons[0]?.id ?? ''))
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    if (!seasonId) { setError('Velg en sesong'); return }
    if (!name.trim()) { setError('Navn er påkrevd'); return }

    setError(null)
    startTransition(async () => {
      const built = await buildPeriodizationTemplateFromSeason(seasonId)
      if (built.error || !built.data || !built.duration_days) {
        setError(built.error ?? 'Kunne ikke bygge mal')
        return
      }
      const res = await savePeriodizationTemplate({
        name: name.trim(),
        description: description.trim() || null,
        category: category || null,
        duration_days: built.duration_days,
        periodization_data: built.data,
      })
      if (res.error) { setError(res.error); return }
      router.push('/app/maler?tab=periodisering')
      onClose()
    })
  }

  if (seasons.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
        onClick={onClose}>
        <div className="w-full max-w-md p-6"
          style={{ backgroundColor: '#0D0D11', border: '1px solid #1E1E22' }}
          onClick={e => e.stopPropagation()}>
          <h2 className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Ingen sesong å lagre
          </h2>
          <p className="text-sm mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Opprett en sesong med perioder og nøkkel-datoer før du kan lagre en periodiseringsmal.
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                background: 'none', border: '1px solid #222228', cursor: 'pointer',
              }}>
              Lukk
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg p-6"
        style={{ backgroundColor: '#0D0D11', border: '1px solid #1E1E22' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-3 mb-5">
          <span style={{ width: '18px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
            Lagre periodisering som mal
          </h2>
        </div>

        <label style={label}>Sesong</label>
        <select value={seasonId} onChange={e => setSeasonId(e.target.value)}
          style={iSt} className="w-full px-3 py-2 mb-4">
          {seasons.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.start_date} → {s.end_date})
            </option>
          ))}
        </select>

        <label style={label}>Navn</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="F.eks. Baseperiodisering 30 uker"
          style={iSt} className="w-full px-3 py-2 mb-3" />

        <label style={label}>Beskrivelse</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Valgfritt — kort notat om hva malen inneholder"
          style={iSt} className="w-full px-3 py-2 mb-3" />

        <label style={label}>Kategori</label>
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={iSt} className="w-full px-3 py-2 mb-5">
          <option value="">Ingen kategori</option>
          {TEMPLATE_CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {error && (
          <p className="text-xs mb-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={isPending}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #222228', cursor: 'pointer',
            }}>
            Avbryt
          </button>
          <button type="button" onClick={handleSave} disabled={isPending}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#FF4500', color: '#F0F0F2',
              border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.5 : 1,
            }}>
            {isPending ? 'Lagrer …' : 'Lagre mal'}
          </button>
        </div>
      </div>
    </div>
  )
}

const label: React.CSSProperties = {
  display: 'block',
  fontFamily: "'Barlow Condensed', sans-serif",
  color: '#8A8A96',
  fontSize: '11px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  marginBottom: '6px',
}

const iSt: React.CSSProperties = {
  backgroundColor: '#16161A',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  outline: 'none',
}
