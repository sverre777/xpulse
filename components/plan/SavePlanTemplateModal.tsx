'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buildPlanTemplateDataFromRange, savePlanTemplate } from '@/app/actions/plan-templates'
import { TEMPLATE_CATEGORIES } from '@/lib/types'

type RangeMode = 'week' | 'month' | 'custom'

interface Props {
  isoWeekStart: string  // Monday of current week (YYYY-MM-DD)
  monthStart: string    // First day of current month
  monthEnd: string      // Last day of current month
  onClose: () => void
}

export function SavePlanTemplateModal({ isoWeekStart, monthStart, monthEnd, onClose }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<RangeMode>('week')
  const [customFrom, setCustomFrom] = useState(isoWeekStart)
  const [customTo, setCustomTo] = useState(addDays(isoWeekStart, 6))
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const resolveRange = (): { from: string; to: string } => {
    if (mode === 'week') return { from: isoWeekStart, to: addDays(isoWeekStart, 6) }
    if (mode === 'month') return { from: monthStart, to: monthEnd }
    return { from: customFrom, to: customTo }
  }

  const handleSave = () => {
    if (!name.trim()) { setError('Navn er påkrevd'); return }
    const { from, to } = resolveRange()
    if (!from || !to || from > to) { setError('Ugyldig datointervall'); return }

    setError(null)
    startTransition(async () => {
      const built = await buildPlanTemplateDataFromRange(from, to)
      if (built.error || !built.data || !built.duration_days) {
        setError(built.error ?? 'Kunne ikke bygge mal')
        return
      }
      const res = await savePlanTemplate({
        name: name.trim(),
        description: description.trim() || null,
        category: category || null,
        duration_days: built.duration_days,
        plan_data: built.data,
      })
      if (res.error) { setError(res.error); return }
      router.push('/app/maler?tab=plan')
      onClose()
    })
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
            Lagre plan som mal
          </h2>
        </div>

        <label style={label}>Omfang</label>
        <div className="flex gap-2 mb-4">
          {(['week', 'month', 'custom'] as RangeMode[]).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className="flex-1 px-3 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: mode === m ? '#FF4500' : '#8A8A96',
                background: 'none',
                border: `1px solid ${mode === m ? '#FF4500' : '#222228'}`,
                cursor: 'pointer',
              }}>
              {m === 'week' ? 'Uke' : m === 'month' ? 'Måned' : 'Tilpasset'}
            </button>
          ))}
        </div>

        {mode === 'custom' && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={iSt} className="px-3 py-2" />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={iSt} className="px-3 py-2" />
          </div>
        )}

        <label style={label}>Navn</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="F.eks. Base-uke 90 min / dag"
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

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
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
