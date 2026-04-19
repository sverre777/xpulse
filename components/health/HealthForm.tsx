'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveDailyHealth } from '@/app/actions/health'
import { DailyHealth } from '@/lib/types'

interface HealthFormProps {
  date: string
  existing: DailyHealth | null
}

export function HealthForm({ date, existing }: HealthFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const isFuture = date > todayStr
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })

  const [form, setForm] = useState({
    resting_hr:     existing?.resting_hr?.toString() ?? '',
    hrv_ms:         existing?.hrv_ms?.toString() ?? '',
    sleep_hours:    existing?.sleep_hours?.toString() ?? '',
    sleep_quality:  existing?.sleep_quality ?? null as number | null,
    body_weight_kg: existing?.body_weight_kg?.toString() ?? '',
    notes:          existing?.notes ?? '',
  })

  const set = (k: keyof typeof form, v: string | number | null) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await saveDailyHealth({ date, ...form, sleep_quality: form.sleep_quality })
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/app/dagbok')
      router.refresh()
    }
  }

  const iSt: React.CSSProperties = {
    backgroundColor: '#16161A', border: '1px solid #1E1E22',
    color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '16px', padding: '10px 14px', outline: 'none', width: '100%',
  }

  if (isFuture) {
    return (
      <div className="space-y-6">
        <div className="p-6 text-center" style={{ border: '1px dashed #222228', backgroundColor: '#111115' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Ikke tilgjengelig ennå
          </p>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '14px' }}>
            Helsedata kan registreres fra {dateLabel}
          </p>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', fontSize: '12px', marginTop: '4px' }}>
            Du kan registrere dette når dagen har startet
          </p>
        </div>
        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-4 text-lg tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              backgroundColor: 'transparent', border: '1px solid #222228', cursor: 'pointer',
            }}>
            ← Tilbake
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Vitals */}
      <div>
        <SectionLabel>Vitale verdier</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Hvilepuls (bpm)">
            <input type="number" value={form.resting_hr} onChange={e => set('resting_hr', e.target.value)}
              placeholder="42" style={iSt} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')} />
          </Field>
          <Field label="HRV (ms)">
            <input type="number" step="0.1" value={form.hrv_ms} onChange={e => set('hrv_ms', e.target.value)}
              placeholder="65" style={iSt} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')} />
          </Field>
          <Field label="Kroppsvekt (kg)">
            <input type="number" step="0.1" value={form.body_weight_kg} onChange={e => set('body_weight_kg', e.target.value)}
              placeholder="70.5" style={iSt} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')} />
          </Field>
        </div>
      </div>

      {/* Sleep */}
      <div>
        <SectionLabel>Søvn</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Timer">
            <input type="number" step="0.5" min="0" max="24" value={form.sleep_hours}
              onChange={e => set('sleep_hours', e.target.value)} placeholder="7.5"
              style={iSt} onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')} />
          </Field>
          <Field label="Kvalitet">
            <div className="flex gap-1 mt-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => set('sleep_quality', form.sleep_quality === n ? null : n)}
                  style={{
                    fontSize: '20px', color: (form.sleep_quality ?? 0) >= n ? '#28A86E' : '#2A2A30',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 1,
                  }}>★</button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {/* Notes */}
      <div>
        <SectionLabel>Dagskommentar</SectionLabel>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Hvordan kjennes kroppen i dag?"
          rows={3} style={{ ...iSt, resize: 'vertical', marginTop: '12px' }}
          onFocus={e => (e.currentTarget.style.borderColor = '#28A86E')}
          onBlur={e => (e.currentTarget.style.borderColor = '#1E1E22')} />
      </div>

      {error && (
        <p className="px-3 py-2 text-sm"
          style={{ color: '#FF4500', backgroundColor: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.3)', fontFamily: "'Barlow Condensed', sans-serif" }}>
          {error}
        </p>
      )}

      <div className="flex gap-3 pb-8">
        <button type="submit" disabled={saving}
          className="flex-1 py-4 text-lg tracking-widest uppercase font-semibold"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: saving ? '#1A5A3A' : '#28A86E', color: '#F0F0F2',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
          {saving ? 'Lagrer...' : existing ? 'Oppdater helse' : 'Lagre helse'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-4 text-lg tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
            backgroundColor: 'transparent', border: '1px solid #222228', cursor: 'pointer',
          }}>
          Avbryt
        </button>
      </div>
    </form>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ width: '16px', height: '2px', backgroundColor: '#28A86E', display: 'inline-block' }} />
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.08em' }}>
        {children}
      </span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1.5 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
