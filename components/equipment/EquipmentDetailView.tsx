'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  updateEquipment,
  deleteEquipment,
  duplicateEquipment,
} from '@/app/actions/equipment'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentCategory,
  type EquipmentStatus,
  type EquipmentWithUsage,
} from '@/lib/equipment-types'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  equipment: EquipmentWithUsage
  workouts: Array<{
    id: string
    date: string
    title: string
    sport: string
    distance_km: number | null
    duration_minutes: number | null
  }>
}

export function EquipmentDetailView({ equipment, workouts }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: equipment.name,
    category: equipment.category,
    brand: equipment.brand ?? '',
    model: equipment.model ?? '',
    sport: equipment.sport ?? '',
    purchase_date: equipment.purchase_date ?? '',
    price_kr: equipment.price_kr != null ? String(equipment.price_kr) : '',
    status: equipment.status,
    notes: equipment.notes ?? '',
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateEquipment({
        id: equipment.id,
        name: form.name,
        category: form.category,
        brand: form.brand,
        model: form.model,
        sport: form.sport,
        purchase_date: form.purchase_date || null,
        price_kr: form.price_kr ? parseFloat(form.price_kr) : null,
        status: form.status,
        notes: form.notes,
      })
      if (result.error) { setError(result.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!confirm(`Slette «${equipment.name}»? Dette kan ikke angres.`)) return
    startTransition(async () => {
      const result = await deleteEquipment(equipment.id)
      if (result.error) { setError(result.error); return }
      router.push('/app/utstyr')
    })
  }

  const handleDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateEquipment(equipment.id)
      if (result.error) { setError(result.error); return }
      if (result.id) router.push(`/app/utstyr/${result.id}`)
    })
  }

  const handleRetire = () => {
    startTransition(async () => {
      const result = await updateEquipment({ id: equipment.id, status: 'retired' })
      if (result.error) { setError(result.error); return }
      router.refresh()
    })
  }

  const subtitle = [equipment.brand, equipment.model].filter(Boolean).join(' ')

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/app/utstyr"
          className="text-xs tracking-widest uppercase inline-block mb-4"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#8A8A96', textDecoration: 'none',
          }}>
          ‹ Tilbake til utstyr
        </Link>

        <div className="flex items-start gap-4 mb-8 flex-wrap">
          <div style={{
            width: '88px', height: '88px',
            backgroundColor: '#0F0F12',
            backgroundImage: equipment.image_url ? `url(${equipment.image_url})` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
            flexShrink: 0,
          }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              {EQUIPMENT_CATEGORY_LABELS[equipment.category]} · {EQUIPMENT_STATUS_LABELS[equipment.status]}
            </p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.06em' }}>
              {equipment.name}
            </h1>
            {subtitle && (
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '15px' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Total km" value={equipment.usage.total_km.toFixed(1)} />
          <Stat label="Total tid" value={`${Math.round(equipment.usage.total_minutes / 60)} t`} />
          <Stat label="Økter" value={String(equipment.usage.workout_count)} />
        </div>

        {!editing ? (
          <div className="p-6 mb-6" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <Row label="Sport" value={equipment.sport} />
            <Row label="Kjøpsdato" value={equipment.purchase_date} />
            <Row label="Pris" value={equipment.price_kr != null ? `${equipment.price_kr} kr` : null} />
            <Row label="Notater" value={equipment.notes} multiline />
            <div className="flex items-center gap-2 flex-wrap pt-3 mt-3"
              style={{ borderTop: '1px solid #1E1E22' }}>
              <button type="button" onClick={() => setEditing(true)} disabled={pending}
                style={btnPrimary}>Rediger</button>
              <button type="button" onClick={handleDuplicate} disabled={pending}
                style={btnSecondary}>Dupliser</button>
              {equipment.status === 'active' && (
                <button type="button" onClick={handleRetire} disabled={pending}
                  style={btnSecondary}>Pensjoner</button>
              )}
              <button type="button" onClick={handleDelete} disabled={pending}
                style={{ ...btnSecondary, color: '#FF4500', borderColor: '#FF4500' }}>
                Slett
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 mb-6 space-y-4"
            style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <Field label="Navn">
              <input value={form.name} required onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kategori">
                <select value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as EquipmentCategory }))}
                  className="w-full px-4 py-3" style={inputStyle}>
                  {EQUIPMENT_CATEGORIES.map(c => (
                    <option key={c} value={c}>{EQUIPMENT_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as EquipmentStatus }))}
                  className="w-full px-4 py-3" style={inputStyle}>
                  {EQUIPMENT_STATUSES.map(s => (
                    <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Merke">
                <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
              <Field label="Modell">
                <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
            </div>
            <Field label="Sport (valgfritt)">
              <input value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kjøpsdato">
                <input type="date" value={form.purchase_date}
                  onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
              <Field label="Pris (kr)">
                <input type="number" step="0.01" min="0" value={form.price_kr}
                  onChange={e => setForm(f => ({ ...f, price_kr: e.target.value }))}
                  className="w-full px-4 py-3" style={inputStyle} />
              </Field>
            </div>
            <Field label="Notater">
              <textarea value={form.notes} rows={3}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            {error && <p className="text-sm" style={{ color: '#FF4500' }}>{error}</p>}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(false)}
                style={btnSecondary}>Avbryt</button>
              <button type="submit" disabled={pending}
                style={{ ...btnPrimary, opacity: pending ? 0.6 : 1 }}>
                {pending ? 'Lagrer…' : 'Lagre'}
              </button>
            </div>
          </form>
        )}

        <h2 className="text-xs tracking-widest uppercase mb-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Brukt på {workouts.length} økt{workouts.length === 1 ? '' : 'er'}
        </h2>
        {workouts.length === 0 ? (
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px' }}>
            Ingen økter ennå. Legg til utstyr i en økt fra dagboken.
          </p>
        ) : (
          <div className="space-y-2">
            {workouts.map(w => (
              <div key={w.id} className="flex items-center justify-between gap-2 px-4 py-3"
                style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
                <div className="min-w-0">
                  <p className="truncate"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px' }}>
                    {w.title}
                  </p>
                  <p className="text-xs"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {w.date} · {w.sport}
                  </p>
                </div>
                <div className="text-right text-xs tracking-widest uppercase shrink-0"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {w.distance_km ? `${w.distance_km.toFixed(1)} km` : ''}
                  {w.duration_minutes ? ` · ${w.duration_minutes} min` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <p className="text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.04em' }}>
        {value}
      </p>
    </div>
  )
}

function Row({ label, value, multiline }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  if (!value) return null
  return (
    <div className="py-2" style={{ borderBottom: '1px solid #1E1E22' }}>
      <p className="text-[10px] tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px',
        whiteSpace: multiline ? 'pre-wrap' : undefined,
      }}>
        {value}
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: '#F0F0F2',
  backgroundColor: '#0F0F12',
  border: '1px solid #1E1E22',
  fontSize: '15px',
}

const btnPrimary: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase',
  backgroundColor: ATHLETE_ORANGE, color: '#F0F0F2',
  border: 'none', cursor: 'pointer',
  padding: '8px 16px',
}

const btnSecondary: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase',
  background: 'none', color: '#8A8A96',
  border: '1px solid #1E1E22', cursor: 'pointer',
  padding: '8px 16px',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
