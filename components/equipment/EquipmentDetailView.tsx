'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  updateEquipment,
  deleteEquipment,
  duplicateEquipment,
  saveSkiData,
} from '@/app/actions/equipment'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
  SKI_TYPES,
  SKI_TYPE_LABELS,
  type EquipmentCategory,
  type EquipmentStatus,
  type EquipmentSkiData,
  type EquipmentWithUsage,
  type SkiType,
} from '@/lib/equipment-types'
import type { SkiTestWithEntries, UserConditionsTemplate } from '@/lib/ski-test-types'
import { NewSkiTestModal } from './NewSkiTestModal'
import type { SkiEquipment } from '@/lib/equipment-types'

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
  skiData?: EquipmentSkiData | null
  skiTests?: SkiTestWithEntries[]
  // Brukes til "+ Ny test"-modal når kategorien er ski.
  allSki?: SkiEquipment[]
  conditionsTemplates?: UserConditionsTemplate[]
}

export function EquipmentDetailView({
  equipment, workouts, skiData = null, skiTests = [], allSki = [], conditionsTemplates = [],
}: Props) {
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
          <div className="p-6 mb-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
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
            style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
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

        {equipment.category === 'ski' && (
          <SkiDataSection equipmentId={equipment.id} skiData={skiData} />
        )}

        {equipment.category === 'ski' && (
          <SkiTestHistorySection
            skiId={equipment.id}
            tests={skiTests}
            allSki={allSki}
            templates={conditionsTemplates}
          />
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
                style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
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

function SkiDataSection({ equipmentId, skiData }: { equipmentId: string; skiData: EquipmentSkiData | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    ski_type: (skiData?.ski_type ?? '') as SkiType | '',
    length_cm: skiData?.length_cm != null ? String(skiData.length_cm) : '',
    camber: skiData?.camber ?? '',
    current_slip: skiData?.current_slip ?? '',
    slip_date: skiData?.slip_date ?? '',
    slip_by: skiData?.slip_by ?? '',
    current_wax: skiData?.current_wax ?? '',
    notes: skiData?.notes ?? '',
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await saveSkiData({
        equipment_id: equipmentId,
        ski_type: form.ski_type === '' ? null : form.ski_type,
        length_cm: form.length_cm ? parseInt(form.length_cm) : null,
        camber: form.camber,
        current_slip: form.current_slip,
        slip_date: form.slip_date || null,
        slip_by: form.slip_by,
        current_wax: form.current_wax,
        notes: form.notes,
      })
      if (result.error) { setError(result.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <div className="p-6 mb-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ski-data
          </p>
          <button type="button" onClick={() => setEditing(true)} style={btnSecondary}>
            {skiData ? 'Rediger' : 'Legg til'}
          </button>
        </div>
        {!skiData ? (
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px' }}>
            Ingen ski-data ennå. Legg til ski-type, lengde, slip og smøring for å vise i Min skipark.
          </p>
        ) : (
          <>
            <Row label="Ski-type" value={skiData.ski_type ? SKI_TYPE_LABELS[skiData.ski_type] : null} />
            <Row label="Lengde" value={skiData.length_cm != null ? `${skiData.length_cm} cm` : null} />
            <Row label="Camber/stivhet" value={skiData.camber} />
            <Row label="Slip" value={skiData.current_slip} />
            <Row label="Slip-dato" value={skiData.slip_date} />
            <Row label="Slip utført av" value={skiData.slip_by} />
            <Row label="Smøring" value={skiData.current_wax} />
            <Row label="Notater" value={skiData.notes} multiline />
          </>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="p-6 mb-6 space-y-4"
      style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Ski-data
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ski-type">
          <select value={form.ski_type}
            onChange={e => setForm(f => ({ ...f, ski_type: e.target.value as SkiType | '' }))}
            className="w-full px-4 py-3" style={inputStyle}>
            <option value="">— ikke satt —</option>
            {SKI_TYPES.map(t => <option key={t} value={t}>{SKI_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="Lengde (cm)">
          <input type="number" min="100" max="220" value={form.length_cm}
            onChange={e => setForm(f => ({ ...f, length_cm: e.target.value }))}
            className="w-full px-4 py-3" style={inputStyle} />
        </Field>
      </div>
      <Field label="Camber / stivhet">
        <input value={form.camber} onChange={e => setForm(f => ({ ...f, camber: e.target.value }))}
          placeholder="F.eks. medium, hard pakksnø"
          className="w-full px-4 py-3" style={inputStyle} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Slip">
          <input value={form.current_slip} onChange={e => setForm(f => ({ ...f, current_slip: e.target.value }))}
            placeholder="F.eks. fin struktur, varmt"
            className="w-full px-4 py-3" style={inputStyle} />
        </Field>
        <Field label="Smøring">
          <input value={form.current_wax} onChange={e => setForm(f => ({ ...f, current_wax: e.target.value }))}
            placeholder="F.eks. Swix HF6"
            className="w-full px-4 py-3" style={inputStyle} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Slip-dato">
          <input type="date" value={form.slip_date}
            onChange={e => setForm(f => ({ ...f, slip_date: e.target.value }))}
            className="w-full px-4 py-3" style={inputStyle} />
        </Field>
        <Field label="Slip utført av">
          <input value={form.slip_by} onChange={e => setForm(f => ({ ...f, slip_by: e.target.value }))}
            placeholder="Navn på slipper"
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
        <button type="button" onClick={() => setEditing(false)} style={btnSecondary}>Avbryt</button>
        <button type="submit" disabled={pending}
          style={{ ...btnPrimary, opacity: pending ? 0.6 : 1 }}>
          {pending ? 'Lagrer…' : 'Lagre'}
        </button>
      </div>
    </form>
  )
}

function SkiTestHistorySection({
  skiId, tests, allSki, templates,
}: {
  skiId: string
  tests: SkiTestWithEntries[]
  allSki: SkiEquipment[]
  templates: UserConditionsTemplate[]
}) {
  const [showModal, setShowModal] = useState(false)
  const myEntries = tests
    .map(t => {
      const entry = t.entries.find(e => e.ski_id === skiId)
      return entry ? { test: t, entry } : null
    })
    .filter((x): x is { test: SkiTestWithEntries; entry: SkiTestWithEntries['entries'][number] } => x !== null)

  const headerWithButton = (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Ski-tester ({myEntries.length})
      </p>
      <button type="button" onClick={() => setShowModal(true)} style={btnPrimary}>
        + Ny test
      </button>
    </div>
  )

  if (myEntries.length === 0) {
    return (
      <>
        <div className="p-6 mb-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
          {headerWithButton}
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px' }}>
            Ingen tester registrert for dette skiparet ennå.
          </p>
        </div>
        {showModal && (
          <NewSkiTestModal
            ski={allSki}
            templates={templates}
            defaultSkiId={skiId}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    )
  }

  const bestConditions = analyseBestConditions(myEntries)

  return (
    <>
    <div className="p-6 mb-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      {headerWithButton}

      {bestConditions.length > 0 && (
        <div className="mb-4 p-3" style={{ backgroundColor: '#0F0F12', border: '1px solid #1E1E22' }}>
          <p className="text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Beste forhold for paret
          </p>
          {bestConditions.map(c => (
            <div key={c.label} className="flex items-center justify-between py-1">
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                {c.label}
              </span>
              <span className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                snitt {c.avgRating.toFixed(1)} · {c.count} test{c.count === 1 ? '' : 'er'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {myEntries.map(({ test, entry }) => {
          const condition = [test.snow_type, test.conditions].filter(Boolean).join(' · ')
          const stats: string[] = []
          if (typeof entry.rank_in_test === 'number') stats.push(`#${entry.rank_in_test}`)
          if (typeof entry.rating === 'number') stats.push(`${entry.rating}/10`)
          if (typeof entry.time_seconds === 'number') stats.push(`${entry.time_seconds}s`)
          return (
            <div key={entry.id} className="px-3 py-2"
              style={{ backgroundColor: '#0F0F12', border: '1px solid #1E1E22' }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '14px' }}>
                    {test.test_date}{test.location ? ` · ${test.location}` : ''}
                  </p>
                  {condition && (
                    <p className="text-xs"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      {condition}
                      {test.air_temp != null ? ` · luft ${test.air_temp}°` : ''}
                      {test.snow_temp != null ? ` · snø ${test.snow_temp}°` : ''}
                    </p>
                  )}
                </div>
                <span className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                  {stats.join(' · ') || '—'}
                </span>
              </div>
              {(entry.wax_used || entry.slip_used) && (
                <p className="text-xs mt-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {[entry.wax_used && `Smøring: ${entry.wax_used}`, entry.slip_used && `Slip: ${entry.slip_used}`]
                    .filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
    {showModal && (
      <NewSkiTestModal
        ski={allSki}
        templates={templates}
        defaultSkiId={skiId}
        onClose={() => setShowModal(false)}
      />
    )}
    </>
  )
}

function analyseBestConditions(items: Array<{ test: SkiTestWithEntries; entry: SkiTestWithEntries['entries'][number] }>) {
  const groups = new Map<string, { sum: number; count: number }>()
  for (const { test, entry } of items) {
    if (typeof entry.rating !== 'number' || !test.snow_type) continue
    const key = test.snow_type
    const cur = groups.get(key) ?? { sum: 0, count: 0 }
    cur.sum += entry.rating
    cur.count += 1
    groups.set(key, cur)
  }
  const result = Array.from(groups.entries()).map(([label, { sum, count }]) => ({
    label,
    avgRating: sum / count,
    count,
  }))
  result.sort((a, b) => b.avgRating - a.avgRating)
  return result.slice(0, 3)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase"
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
      <p className="text-xs tracking-widest uppercase mb-1"
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
