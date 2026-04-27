'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { saveEquipment } from '@/app/actions/equipment'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentCategory,
  type EquipmentStatus,
  type EquipmentWithUsage,
} from '@/lib/equipment-types'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  initialEquipment: EquipmentWithUsage[]
}

type CategoryFilter = EquipmentCategory | 'all'
type StatusFilter = EquipmentStatus | 'all'

export function UtstyrPageView({ initialEquipment }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [showNew, setShowNew] = useState(false)

  const filtered = useMemo(() => {
    return initialEquipment.filter(e => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      return true
    })
  }, [initialEquipment, categoryFilter, statusFilter])

  const grouped = useMemo(() => {
    const map = new Map<EquipmentCategory, EquipmentWithUsage[]>()
    for (const cat of EQUIPMENT_CATEGORIES) map.set(cat, [])
    for (const e of filtered) map.get(e.category)?.push(e)
    return map
  }, [filtered])

  // Topp-8 utstyr etter total bruk (km eller tid). Brukes i sammenligningsgrafen
  // øverst på siden. Bruker filtrert liste så grafen følger kategori/status-toggles.
  const topUsage = useMemo(() => {
    return [...filtered]
      .map(e => ({
        id: e.id,
        name: e.name,
        km: Number(e.usage.total_km.toFixed(1)),
        hours: Number((e.usage.total_minutes / 60).toFixed(1)),
      }))
      .filter(d => d.km > 0 || d.hours > 0)
      .sort((a, b) => (b.km + b.hours) - (a.km + a.hours))
      .slice(0, 8)
  }, [filtered])

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span style={{ width: '32px', height: '3px', backgroundColor: ATHLETE_ORANGE, display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
              Utstyr
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/utstyr/ski"
              className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#8A8A96', background: 'none', border: '1px solid #1E1E22',
                textDecoration: 'none',
              }}>
              Min skipark
            </Link>
            <button type="button" onClick={() => setShowNew(true)}
              className="px-4 py-2 text-sm font-semibold tracking-widest uppercase transition-opacity hover:opacity-90"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: ATHLETE_ORANGE, color: '#F0F0F2', border: 'none', cursor: 'pointer',
              }}>
              + Nytt utstyr
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <FilterGroup label="Kategori">
            <FilterButton active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>Alle</FilterButton>
            {EQUIPMENT_CATEGORIES.map(c => (
              <FilterButton key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
                {EQUIPMENT_CATEGORY_LABELS[c]}
              </FilterButton>
            ))}
          </FilterGroup>
          <FilterGroup label="Status">
            <FilterButton active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>Aktiv</FilterButton>
            <FilterButton active={statusFilter === 'retired'} onClick={() => setStatusFilter('retired')}>Pensjonert</FilterButton>
            <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Alle</FilterButton>
          </FilterGroup>
        </div>

        {topUsage.length > 0 && (
          <div className="mb-8 p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <p className="text-xs tracking-widest uppercase mb-3"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Totalbruk — topp {topUsage.length}
            </p>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topUsage} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#1E1E22" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fill: '#555560' }}
                    stroke="#1E1E22"
                    interval={0}
                    tickFormatter={(n: string) => n.length > 12 ? `${n.slice(0, 12)}…` : n}
                  />
                  <YAxis
                    tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fill: '#555560' }}
                    stroke="#1E1E22"
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', color: '#F0F0F2',
                    }}
                    formatter={(val, key) => [val as number, String(key) === 'km' ? 'Km' : 'Timer']}
                  />
                  <Legend
                    wrapperStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#8A8A96' }}
                    formatter={(key: string) => key === 'km' ? 'Distanse (km)' : 'Tid (timer)'}
                  />
                  <Bar dataKey="km" fill={ATHLETE_ORANGE} isAnimationActive={false} />
                  <Bar dataKey="hours" fill="#1A6FD4" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="p-12 text-center" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '15px' }}>
              Ingen utstyr matcher filtrene. Klikk «+ Nytt utstyr» for å starte.
            </p>
          </div>
        ) : (
          EQUIPMENT_CATEGORIES.map(cat => {
            const items = grouped.get(cat) ?? []
            if (items.length === 0) return null
            return (
              <section key={cat} className="mb-8">
                <h2 className="text-xs tracking-widest uppercase mb-3"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  {EQUIPMENT_CATEGORY_LABELS[cat]} · {items.length}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(e => <EquipmentCard key={e.id} equipment={e} />)}
                </div>
              </section>
            )
          })
        )}
      </div>

      {showNew && <NewEquipmentModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

function EquipmentCard({ equipment }: { equipment: EquipmentWithUsage }) {
  const subtitle = [equipment.brand, equipment.model].filter(Boolean).join(' ')
  return (
    <Link href={`/app/utstyr/${equipment.id}`}
      className="flex items-center gap-3 p-4 transition-opacity hover:opacity-80"
      style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22', textDecoration: 'none' }}>
      <div style={{
        width: '52px', height: '52px',
        backgroundColor: '#0F0F12',
        backgroundImage: equipment.image_url ? `url(${equipment.image_url})` : undefined,
        backgroundSize: 'cover', backgroundPosition: 'center',
        flexShrink: 0,
      }} />
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '16px' }}
          className="truncate">
          {equipment.name}
        </p>
        {subtitle && (
          <p className="truncate"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
            {subtitle}
          </p>
        )}
        <p className="text-xs tracking-widest uppercase mt-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {equipment.usage.total_km.toFixed(1)} km · {equipment.usage.workout_count} økt{equipment.usage.workout_count === 1 ? '' : 'er'}
          {equipment.status !== 'active' && ` · ${EQUIPMENT_STATUS_LABELS[equipment.status]}`}
        </p>
      </div>
      <span style={{ color: '#555560', fontSize: '18px' }}>›</span>
    </Link>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] tracking-widest uppercase mr-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1 text-xs tracking-widest uppercase transition-colors"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: active ? '#F0F0F2' : '#8A8A96',
        background: 'none',
        border: active ? `1px solid ${ATHLETE_ORANGE}` : '1px solid #1E1E22',
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

function NewEquipmentModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    category: 'sko' as EquipmentCategory,
    brand: '',
    model: '',
    sport: '',
    purchase_date: '',
    price_kr: '',
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Navn er påkrevd'); return }
    setError(null)
    startTransition(async () => {
      const result = await saveEquipment({
        name: form.name,
        category: form.category,
        brand: form.brand,
        model: form.model,
        sport: form.sport,
        purchase_date: form.purchase_date || null,
        price_kr: form.price_kr ? parseFloat(form.price_kr) : null,
        notes: form.notes,
      })
      if (result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '5vh', paddingBottom: '5vh', overflow: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B',
          border: '1px solid #1E1E22',
          width: '92%', maxWidth: '560px',
        }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #1E1E22' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.08em' }}>
            Nytt utstyr
          </h2>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ background: 'none', border: 'none', color: '#8A8A96', cursor: 'pointer', fontSize: '22px' }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Kategori">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as EquipmentCategory }))}
              className="w-full px-4 py-3" style={inputStyle}>
              {EQUIPMENT_CATEGORIES.map(c => (
                <option key={c} value={c}>{EQUIPMENT_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </Field>
          <Field label="Navn">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required placeholder="F.eks. Madshus Redline Skate"
              className="w-full px-4 py-3" style={inputStyle} />
          </Field>
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
              placeholder="F.eks. langrenn, løping"
              className="w-full px-4 py-3" style={inputStyle} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kjøpsdato">
              <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <Field label="Pris (kr)">
              <input type="number" step="0.01" min="0" value={form.price_kr}
                onChange={e => setForm(f => ({ ...f, price_kr: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
          </div>
          <Field label="Notater">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} className="w-full px-4 py-3" style={inputStyle} />
          </Field>

          {error && <p className="text-sm" style={{ color: '#FF4500' }}>{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#8A8A96', background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
              }}>
              Avbryt
            </button>
            <button type="submit" disabled={pending}
              className="px-4 py-2 text-sm font-semibold tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: ATHLETE_ORANGE, color: '#F0F0F2',
                border: 'none', cursor: pending ? 'wait' : 'pointer',
                opacity: pending ? 0.6 : 1,
              }}>
              {pending ? 'Lagrer…' : 'Lagre'}
            </button>
          </div>
        </form>
      </div>
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
