'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RECOVERY_GROUPS } from '@/lib/recovery-types'
import { saveRecoveryEntry } from '@/app/actions/recovery'

interface RecoveryModalProps {
  date: string
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export function RecoveryModal({ date, open, onClose, onSaved }: RecoveryModalProps) {
  const router = useRouter()
  const [type, setType] = useState('')
  const [otherLabel, setOtherLabel] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setType(''); setOtherLabel(''); setStartTime('')
      setDuration(''); setNotes(''); setError(null); setSaving(false)
    }
  }, [open])

  if (!open) return null

  const isOther = type === 'other'
  const canSubmit = type && (!isOther || otherLabel.trim().length > 0) && !saving

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true); setError(null)
    const savedType = isOther ? `other:${otherLabel.trim()}` : type
    const result = await saveRecoveryEntry({
      date, type: savedType, start_time: startTime, duration_minutes: duration, notes,
    })
    if (result.error) { setError(result.error); setSaving(false); return }
    if (onSaved) onSaved()
    router.refresh()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0D0D11', border: '1px solid #1E1E22',
          maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
          padding: '24px',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span style={{ width: '24px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
              Legg til recovery
            </h2>
          </div>
          <button type="button" onClick={onClose}
            style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div>
            <Label>Type *</Label>
            <select value={type} onChange={e => setType(e.target.value)} required
              style={{ ...iSt, cursor: 'pointer' }}>
              <option value="">Velg tiltak...</option>
              {RECOVERY_GROUPS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(it => (
                    <option key={it.value} value={it.value}>{it.icon}  {it.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {isOther && (
            <div>
              <Label>Beskriv tiltaket</Label>
              <input value={otherLabel} onChange={e => setOtherLabel(e.target.value)}
                placeholder="F.eks. pusteøvelser..." required
                style={iSt} />
            </div>
          )}

          {/* Klokkeslett + varighet */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Klokkeslett (valgfritt)</Label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                style={iSt} />
            </div>
            <div>
              <Label>Varighet (min)</Label>
              <input type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="—" style={iSt} />
            </div>
          </div>

          {/* Notat */}
          <div>
            <Label>Notat (valgfritt)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={3} placeholder="Kort kommentar..."
              style={{ ...iSt, resize: 'vertical' }} />
          </div>

          {error && (
            <p style={{ color: '#FF4500', backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)',
              fontFamily: "'Barlow Condensed', sans-serif", padding: '8px 12px', fontSize: '13px' }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={!canSubmit}
              className="flex-1 py-3 text-base tracking-widest uppercase font-semibold"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: canSubmit ? '#FF4500' : '#3A1A0A', color: '#F0F0F2',
                border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.7,
              }}>
              {saving ? 'Lagrer...' : 'Lagre'}
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-3 text-base tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                backgroundColor: 'transparent', border: '1px solid #222228', cursor: 'pointer',
              }}>
              Avbryt
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#16161A', border: '1px solid #1E1E22',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '15px', padding: '10px 12px', outline: 'none', width: '100%',
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1.5 text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {children}
    </label>
  )
}
