'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  updateEquipment,
  deleteEquipment,
  duplicateEquipment,
  saveSkiData,
  addGrind,
} from '@/app/actions/equipment'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
  SKI_TYPES,
  SKI_TYPE_LABELS,
  SKI_USAGE_TYPES,
  SKI_USAGE_LABELS,
  normalizeCategory,
  slipDatoTilDate,
  visSlipDato,
  type EquipmentCategory,
  type EquipmentStatus,
  type EquipmentSkiData,
  type EquipmentWithUsage,
  type SkiType,
  type SkiUsageType,
} from '@/lib/equipment-types'
import type { SkiTestTemplate, SkiTestWithEntries, UserConditionsTemplate } from '@/lib/ski-test-types'
import { NewSkiTestModal } from './NewSkiTestModal'
import type { EquipmentGrind, SkiEquipment } from '@/lib/equipment-types'
import { parseDecimal } from '@/lib/parse-decimal'
import { xpConfirm } from '@/components/ui/ConfirmDialog'
import { KategoriFelter, kategoriVerdierFraEquipment } from './KategoriFelter'

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
  // Fase 99 — sliphistorikk (kun ski), nyeste først.
  grinds?: EquipmentGrind[]
  // Fase 100 — egne test-maler til «+ Ny test»-modalen.
  testTemplates?: SkiTestTemplate[]
}

export function EquipmentDetailView({
  equipment, workouts, skiData = null, skiTests = [], allSki = [], conditionsTemplates = [],
  grinds = [], testTemplates = [],
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: equipment.name,
    // normalizeCategory: rader lagret før fase 99 kan fortsatt ha 'sko'.
    category: normalizeCategory(equipment.category),
    brand: equipment.brand ?? '',
    model: equipment.model ?? '',
    sport: equipment.sport ?? '',
    purchase_date: equipment.purchase_date ?? '',
    price_kr: equipment.price_kr != null ? String(equipment.price_kr) : '',
    status: equipment.status,
    notes: equipment.notes ?? '',
    start_km: equipment.start_km != null && equipment.start_km !== 0 ? String(equipment.start_km) : '',
    ...kategoriVerdierFraEquipment(equipment),
  })
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  // Km siden siste slip — datobasert fra øktene som er koblet til skia.
  const sisteSlipDato = grinds[0]?.grind_date ?? skiData?.slip_date ?? null
  const kmSinceSlip = sisteSlipDato == null ? null : workouts.reduce((sum, w) =>
    (w.date >= sisteSlipDato && typeof w.distance_km === 'number') ? sum + w.distance_km : sum, 0)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const erRulleski = form.category === 'rulleski'
      const result = await updateEquipment({
        id: equipment.id,
        name: form.name,
        category: form.category,
        brand: form.brand,
        model: form.model,
        sport: form.sport,
        purchase_date: form.purchase_date || null,
        price_kr: form.price_kr ? parseDecimal(form.price_kr) : null,
        status: form.status,
        notes: form.notes,
        start_km: form.start_km ? parseDecimal(form.start_km) : 0,
        size: form.size,
        usage_type: form.usage_type,
        length_cm: form.length_cm ? parseDecimal(form.length_cm) : null,
        subtype: form.subtype,
        wheel_type: form.wheel_type,
        // Motstand: én felles ELLER ulik foran/bak — aldri begge deler.
        resistance: erRulleski && !form.splitResistance ? form.resistance : '',
        resistance_front: erRulleski && form.splitResistance ? form.resistance_front : '',
        resistance_rear: erRulleski && form.splitResistance ? form.resistance_rear : '',
        cleat_system: form.cleat_system,
        drivetrain: form.drivetrain,
        wheelset: form.wheelset,
      })
      if (result.error) { setError(result.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  const handleDelete = async () => {
    if (!await xpConfirm(`Slette «${equipment.name}»? Dette kan ikke angres.`)) return
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
              {EQUIPMENT_CATEGORY_LABELS[normalizeCategory(equipment.category)]} · {EQUIPMENT_STATUS_LABELS[equipment.status]}
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

        <div className={`grid ${kmSinceSlip != null ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'} gap-3 mb-6`}>
          <Stat label="Total km" value={equipment.usage.total_km.toFixed(1)} />
          <Stat label="Total tid" value={`${Math.round(equipment.usage.total_minutes / 60)} t`} />
          <Stat label="Økter" value={String(equipment.usage.workout_count)} />
          {kmSinceSlip != null && (
            <Stat label="Km siden slip" value={kmSinceSlip.toFixed(0)} />
          )}
        </div>

        {!editing ? (
          <div className="p-6 mb-6" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <Row label="Sport" value={equipment.sport} />
            <Row label="Kjøpsdato" value={equipment.purchase_date} />
            <Row label="Pris" value={equipment.price_kr != null ? `${equipment.price_kr} kr` : null} />
            <Row label="Start-km" value={equipment.start_km ? `${equipment.start_km} km` : null} />
            {/* Fase 99 — kategorispesifikke felter (vises kun når satt) */}
            <Row label="Størrelse" value={equipment.size ?? null} />
            <Row label="Bruk" value={equipment.usage_type ?? null} />
            <Row label="Lengde" value={equipment.length_cm != null ? `${equipment.length_cm} cm` : null} />
            <Row label="Type" value={equipment.subtype ?? null} />
            <Row label="Hjultype" value={equipment.wheel_type ?? null} />
            <Row label="Motstand" value={
              equipment.resistance_front || equipment.resistance_rear
                ? `${equipment.resistance_front ?? '?'}/${equipment.resistance_rear ?? '?'} (foran/bak)`
                : equipment.resistance ?? null
            } />
            <Row label="Festesystem" value={equipment.cleat_system ?? null} />
            <Row label="Drivverk" value={equipment.drivetrain ?? null} />
            <Row label="Hjulsett" value={equipment.wheelset ?? null} />
            <Row label="Notater" value={equipment.notes} multiline />
            <div className="flex items-center gap-2 flex-wrap pt-3 mt-3"
              style={{ borderTop: '1px solid #1E1E22' }}>
              <button type="button" onClick={() => setEditing(true)} disabled={pending}
                className="xp-pill xp-pill-primary">Rediger</button>
              <button type="button" onClick={handleDuplicate} disabled={pending}
                className="xp-pill xp-pill-ghost">Dupliser</button>
              {equipment.status === 'active' && (
                <button type="button" onClick={handleRetire} disabled={pending}
                  className="xp-pill xp-pill-ghost">Pensjoner</button>
              )}
              <button type="button" onClick={handleDelete} disabled={pending}
                className="xp-pill xp-pill-danger">
                Slett
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 mb-6 space-y-4"
            style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
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
            <Field label="Km allerede gått (start-km)">
              <input type="text" inputMode="decimal" value={form.start_km}
                onChange={e => set({ start_km: e.target.value })}
                placeholder="0" className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            {/* Kategorispesifikke felter — delt komponent, samme fasit som ny-skjemaet.
                Ski-feltene redigeres i Ski-data-seksjonen under (visSki=false). */}
            <KategoriFelter category={form.category} verdier={form} onChange={set} />
            <Field label="Notater">
              <textarea value={form.notes} rows={3}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            {error && <p className="text-sm" style={{ color: '#FF4500' }}>{error}</p>}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(false)}
                className="xp-pill xp-pill-ghost">Avbryt</button>
              <button type="submit" disabled={pending}
                className="xp-pill xp-pill-primary">
                {pending ? 'Lagrer…' : 'Lagre'}
              </button>
            </div>
          </form>
        )}

        {equipment.category === 'ski' && (
          <SkiDataSection equipmentId={equipment.id} skiData={skiData} />
        )}

        {equipment.category === 'ski' && (
          <SliphistorikkSection
            equipmentId={equipment.id}
            grinds={grinds}
            workouts={workouts}
            kmSinceSlip={kmSinceSlip}
          />
        )}

        {equipment.category === 'ski' && (
          <SkiTestHistorySection
            skiId={equipment.id}
            tests={skiTests}
            allSki={allSki}
            templates={conditionsTemplates}
            testTemplates={testTemplates}
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
                style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
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
    usage_type: (skiData?.usage_type ?? '') as SkiUsageType | '',
    length_cm: skiData?.length_cm != null ? String(skiData.length_cm) : '',
    camber: skiData?.camber ?? '',
    current_wax: skiData?.current_wax ?? '',
    notes: skiData?.notes ?? '',
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      // Slip-feltene sendes IKKE herfra — slip er historikk og redigeres via
      // «+ Ny slip» i sliphistorikk-seksjonen. saveSkiData rører ikke utelatte felter.
      const result = await saveSkiData({
        equipment_id: equipmentId,
        ski_type: form.ski_type === '' ? null : form.ski_type,
        usage_type: form.usage_type === '' ? null : form.usage_type,
        length_cm: form.length_cm ? parseInt(form.length_cm) : null,
        camber: form.camber,
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
      <div className="p-6 mb-6" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ski-data
          </p>
          <button type="button" onClick={() => setEditing(true)} className="xp-pill xp-pill-ghost">
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
            <Row label="Bruk" value={skiData.usage_type ? SKI_USAGE_LABELS[skiData.usage_type] : null} />
            <Row label="Lengde" value={skiData.length_cm != null ? `${skiData.length_cm} cm` : null} />
            <Row label="Camber/stivhet" value={skiData.camber} />
            <Row label="Smøring" value={skiData.current_wax} />
            <Row label="Notater" value={skiData.notes} multiline />
          </>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="p-6 mb-6 space-y-4"
      style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bruk">
          <select value={form.usage_type}
            onChange={e => setForm(f => ({ ...f, usage_type: e.target.value as SkiUsageType | '' }))}
            className="w-full px-4 py-3" style={inputStyle}>
            <option value="">— ikke satt —</option>
            {SKI_USAGE_TYPES.map(u => <option key={u} value={u}>{SKI_USAGE_LABELS[u]}</option>)}
          </select>
        </Field>
        <Field label="Camber / stivhet">
          <input value={form.camber} onChange={e => setForm(f => ({ ...f, camber: e.target.value }))}
            placeholder="F.eks. medium, hard pakksnø"
            className="w-full px-4 py-3" style={inputStyle} />
        </Field>
      </div>
      <Field label="Smøring">
        <input value={form.current_wax} onChange={e => setForm(f => ({ ...f, current_wax: e.target.value }))}
          placeholder="F.eks. Swix HF6"
          className="w-full px-4 py-3" style={inputStyle} />
      </Field>
      <p className="text-xs" style={{ color: '#555560' }}>
        Slip registreres i sliphistorikken under — «+ Ny slip» legger alltid en ny rad oppå.
      </p>
      <Field label="Notater">
        <textarea value={form.notes} rows={3}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full px-4 py-3" style={inputStyle} />
      </Field>
      {error && <p className="text-sm" style={{ color: '#FF4500' }}>{error}</p>}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={() => setEditing(false)} className="xp-pill xp-pill-ghost">Avbryt</button>
        <button type="submit" disabled={pending}
          className="xp-pill xp-pill-primary">
          {pending ? 'Lagrer…' : 'Lagre'}
        </button>
      </div>
    </form>
  )
}

// Sliphistorikk (fasit: designfilens seksjon 2). Ny slip legges alltid OPPÅ —
// historikken røres aldri, «km siden siste slip» nullstilles ved ny slip.
function SliphistorikkSection({ equipmentId, grinds, workouts, kmSinceSlip }: {
  equipmentId: string
  grinds: EquipmentGrind[]
  workouts: Array<{ date: string; distance_km: number | null }>
  kmSinceSlip: number | null
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ grind: '', dato: '', ground_by: '', notes: '' })

  // Km gått i hver slip-periode: fra radens dato fram til neste (nyere) slip.
  const kmIPeriode = (fra: string, til: string | null): number =>
    workouts.reduce((sum, w) =>
      (w.date >= fra && (til === null || w.date < til) && typeof w.distance_km === 'number')
        ? sum + w.distance_km : sum, 0)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const dato = slipDatoTilDate(form.dato)
    if (!form.grind.trim()) { setError('Slip-navn er påkrevd'); return }
    if (!dato) { setError('Årstall eller dato er påkrevd — «2026» holder'); return }
    startTransition(async () => {
      const result = await addGrind({
        equipment_id: equipmentId,
        grind: form.grind,
        grind_date: dato,
        ground_by: form.ground_by,
        notes: form.notes,
      })
      if (result.error) { setError(result.error); return }
      setForm({ grind: '', dato: '', ground_by: '', notes: '' })
      setAdding(false)
      router.refresh()
    })
  }

  return (
    <div className="p-6 mb-6" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Sliphistorikk
        </p>
        <button type="button" onClick={() => setAdding(a => !a)} className="xp-pill xp-pill-primary">
          + Ny slip
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-3 mb-4 p-4"
          style={{ border: '1px solid #1E1E22', borderRadius: 9 }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slip">
              <input value={form.grind} onChange={e => setForm(f => ({ ...f, grind: e.target.value }))}
                placeholder="F.eks. S1-7 kald" className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <Field label="Årstall/dato">
              <input value={form.dato} onChange={e => setForm(f => ({ ...f, dato: e.target.value }))}
                placeholder="2026 eller 2026-01-15" className="w-full px-4 py-3" style={inputStyle} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Utført av (valgfritt)">
              <input value={form.ground_by} onChange={e => setForm(f => ({ ...f, ground_by: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <Field label="Notat (valgfritt)">
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
          </div>
          <p className="text-xs" style={{ color: '#8A8A96' }}>
            Ny slip legges <b style={{ color: '#F0F0F2' }}>oppå</b> — historikken beholdes, og
            «km siden siste slip» nullstilles.
          </p>
          {error && <p className="text-sm" style={{ color: '#FF4500' }}>{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setAdding(false)} className="xp-pill xp-pill-ghost">Avbryt</button>
            <button type="submit" disabled={pending}
              className="xp-pill xp-pill-primary">
              {pending ? 'Lagrer…' : 'Lagre slip'}
            </button>
          </div>
        </form>
      )}

      {grinds.length === 0 ? (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px' }}>
          Ingen slip registrert ennå.
        </p>
      ) : (
        <div className="space-y-2">
          {grinds.map((g, i) => {
            const nyereDato = i > 0 ? grinds[i - 1].grind_date : null
            const km = i === 0 ? kmSinceSlip : kmIPeriode(g.grind_date, nyereDato)
            return (
              <div key={g.id} className="flex items-center justify-between gap-2 px-4 py-3"
                style={{
                  border: '1px solid #1E1E22', borderRadius: 9,
                  opacity: i === 0 ? 1 : 0.55,
                }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px' }}>
                      {g.grind}
                    </p>
                    {i === 0 && (
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700, fontSize: '10px', letterSpacing: '0.12em',
                        color: '#28A86E', border: '1px solid rgba(40,168,110,0.5)',
                        borderRadius: 5, padding: '1px 7px',
                      }}>
                        AKTIV
                      </span>
                    )}
                  </div>
                  {(g.ground_by || g.notes) && (
                    <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                      {[g.ground_by, g.notes].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <p className="text-xs shrink-0 text-right"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {visSlipDato(g.grind_date)}
                  {km != null && (i === 0 ? ` · ${km.toFixed(0)} km siden` : ` · gikk ${km.toFixed(0)} km`)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SkiTestHistorySection({
  skiId, tests, allSki, templates, testTemplates = [],
}: {
  skiId: string
  tests: SkiTestWithEntries[]
  allSki: SkiEquipment[]
  templates: UserConditionsTemplate[]
  testTemplates?: SkiTestTemplate[]
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
      <button type="button" onClick={() => setShowModal(true)} className="xp-pill xp-pill-primary">
        + Ny test
      </button>
    </div>
  )

  if (myEntries.length === 0) {
    return (
      <>
        <div className="p-6 mb-6" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
          {headerWithButton}
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px' }}>
            Ingen tester registrert for dette skiparet ennå.
          </p>
        </div>
        {showModal && (
          <NewSkiTestModal
            ski={allSki}
            templates={templates}
            testTemplates={testTemplates}
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
    <div className="p-6 mb-6" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
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
        testTemplates={testTemplates}
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
    <div className="p-4" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
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
