'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { XpTooltip, CHART_LEGEND_STYLE } from '@/components/analysis/chart-theme'
import { saveEquipment, saveSkiData } from '@/app/actions/equipment'
import { parseDecimal } from '@/lib/parse-decimal'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_ICONS,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUS_LABELS,
  SKI_TYPE_LABELS,
  normalizeCategory,
  slipDatoTilDate,
  visSlipDato,
  type EquipmentCategory,
  type EquipmentStatus,
  type EquipmentWithUsage,
  type SkiEquipment,
} from '@/lib/equipment-types'
import { KategoriFelter, FormChip, tomKategoriVerdier } from './KategoriFelter'
import { FilterChip as FilterButton } from '@/components/ui/FilterChip'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  initialEquipment: EquipmentWithUsage[]
  // Ski-info (ski_data + sliphistorikk + km siden slip) til ski-kortene.
  ski?: SkiEquipment[]
}

type CategoryFilter = EquipmentCategory | 'all'
type StatusFilter = EquipmentStatus | 'all'

export function UtstyrPageView({ initialEquipment, ski = [] }: Props) {
  const skiById = useMemo(() => new Map(ski.map(s => [s.id, s])), [ski])
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [showNew, setShowNew] = useState(false)

  const filtered = useMemo(() => {
    return initialEquipment.filter(e => {
      // normalizeCategory: rader lagret før fase 99 kan fortsatt ha 'sko'.
      if (categoryFilter !== 'all' && normalizeCategory(e.category) !== categoryFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      return true
    })
  }, [initialEquipment, categoryFilter, statusFilter])

  const grouped = useMemo(() => {
    const map = new Map<EquipmentCategory, EquipmentWithUsage[]>()
    for (const cat of EQUIPMENT_CATEGORIES) map.set(cat, [])
    for (const e of filtered) map.get(normalizeCategory(e.category))?.push(e)
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
    <div style={{ minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-12">
        {/* Topplinja: tittel og de to knappene delte én linje og ble trange på
            375px. På mobil stables de, og knappene deler bredden likt. Fra md
            og opp er raden nøyaktig som før. */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 gap-3 md:gap-4">
          <div className="flex items-center gap-3">
            <span style={{ width: '32px', height: '3px', backgroundColor: ATHLETE_ORANGE, display: 'inline-block' }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 'clamp(28px, 7vw, 36px)', letterSpacing: '0.08em' }}>
              Utstyr
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/utstyr/ski" className="xp-pill xp-pill-ghost flex-1 md:flex-none">
              Min skipark
            </Link>
            <button type="button" onClick={() => setShowNew(true)}
              className="xp-pill xp-pill-primary flex-1 md:flex-none">
              + Nytt utstyr
            </button>
          </div>
        </div>

        {/* Filtrene rant ut av skjermen på 375px (KLOKKE ble kuttet). Radene
            scroller horisontalt på mobil med fade som avkutt-hint; desktop
            uendret (xp-scrollrow gjelder kun under md). */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-6 md:flex-wrap">
          <FilterGroup label="Kategori" fade>
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

        {/* Grafen skal tåle 1 like godt som 20: med ett eller to utstyr blir en
            240px søylegraf bare tom plass — da vises totalbruken som én
            kompakt linje i stedet. */}
        {topUsage.length > 0 && topUsage.length <= 2 && (
          <div className="mb-6 px-4 py-3 flex flex-wrap items-baseline gap-x-4 gap-y-1"
            style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              Totalbruk
            </span>
            {topUsage.map(d => (
              <span key={d.id} className="min-w-0 truncate"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '14px' }}>
                {d.name} · <b style={{ color: ATHLETE_ORANGE }}>{d.km} km</b>
                {' · '}<b style={{ color: '#1A6FD4' }}>{d.hours} t</b>
              </span>
            ))}
          </div>
        )}

        {topUsage.length > 2 && (
          <div className="mb-8 p-4" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <p className="text-xs tracking-widest uppercase mb-3"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
              Totalbruk — topp {topUsage.length}
            </p>
            <div className="h-[200px] md:h-[240px]" style={{ width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={topUsage} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="var(--line)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fill: 'var(--tekst-8-alt)' }}
                    stroke="var(--line2)"
                    interval={0}
                    tickFormatter={(n: string) => n.length > 12 ? `${n.slice(0, 12)}…` : n}
                  />
                  <YAxis
                    tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fill: 'var(--tekst-8-alt)' }}
                    stroke="var(--line2)"
                    width={36}
                  />
                  <Tooltip
                    content={<XpTooltip />}
                    formatter={(val, key) => [val as number, String(key) === 'km' ? 'Km' : 'Timer']}
                  />
                  <Legend
                    wrapperStyle={CHART_LEGEND_STYLE}
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
          initialEquipment.length === 0 ? (
            <EmptyState
              title="Ingen utstyr registrert"
              body="Legg inn ski, sko, staver eller sykkel — X-PULSE teller kilometer per utstyr automatisk fra øktene dine."
              ctaLabel="+ Nytt utstyr"
              ctaOnClick={() => setShowNew(true)}
            />
          ) : (
            <div className="p-12 text-center" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '15px' }}>
                Ingen utstyr matcher filtrene.
              </p>
            </div>
          )
        ) : (
          EQUIPMENT_CATEGORIES.map(cat => {
            const items = grouped.get(cat) ?? []
            if (items.length === 0) return null
            return (
              <section key={cat} className="mb-8">
                <h2 className="text-xs tracking-widest uppercase mb-3"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                  {EQUIPMENT_CATEGORY_LABELS[cat]} · {items.length}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(e => (
                    <EquipmentCard key={e.id} equipment={e}
                      maxKm={Math.max(...items.map(i => i.usage.total_km), 0)}
                      skiInfo={skiById.get(e.id) ?? null} />
                  ))}
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

// Utstyrskort (fasit: designfilens seksjon 2) — badges, kategorimeta,
// km-teller (inkl. start-km via usage), km-bar og «km siden siste slip» for ski.
function EquipmentCard({ equipment, maxKm, skiInfo }: {
  equipment: EquipmentWithUsage
  maxKm: number
  skiInfo?: SkiEquipment | null
}) {
  const subtitle = [equipment.brand, equipment.model].filter(Boolean).join(' ')
  const cat = normalizeCategory(equipment.category)
  const skiData = skiInfo?.ski_data ?? null

  // Badges: bruk (gull konk / grønn trening) + type (blå).
  const badges: Array<{ text: string; color: string }> = []
  const brukBadge = (bruk: string | null | undefined) => {
    if (!bruk) return
    if (bruk === 'konkurranse') badges.push({ text: '🏁 KONK', color: '#D4A017' })
    else if (bruk === 'trening') badges.push({ text: 'TRENING', color: '#28A86E' })
    else badges.push({ text: bruk.toUpperCase(), color: '#1A6FD4' })
  }
  if (cat === 'ski') {
    brukBadge(skiData?.usage_type)
    if (skiData?.ski_type) badges.push({ text: SKI_TYPE_LABELS[skiData.ski_type].toUpperCase(), color: '#1A6FD4' })
  } else {
    brukBadge(equipment.usage_type)
    if (equipment.subtype) badges.push({ text: equipment.subtype.toUpperCase(), color: '#1A6FD4' })
  }

  // Kategorimeta-linje under navnet.
  const metaDeler: string[] = []
  if (cat === 'ski') {
    if (skiData?.length_cm) metaDeler.push(`${skiData.length_cm} cm`)
    if (skiData?.current_slip) {
      const dato = visSlipDato(skiData.slip_date)
      metaDeler.push(`Slip: ${skiData.current_slip}${dato ? ` (${dato})` : ''}`)
    }
  } else if (cat === 'rulleski') {
    if (equipment.resistance_front || equipment.resistance_rear) {
      metaDeler.push(`Motstand ${equipment.resistance_front ?? '?'}/${equipment.resistance_rear ?? '?'} (foran/bak)`)
    } else if (equipment.resistance) {
      metaDeler.push(`Motstand ${equipment.resistance}`)
    }
    if (equipment.wheel_type) metaDeler.push(equipment.wheel_type)
  } else if (cat === 'skistaver') {
    if (equipment.length_cm) metaDeler.push(`${equipment.length_cm} cm`)
  } else if (equipment.size) {
    metaDeler.push(`Str. ${equipment.size}`)
  }
  if (cat === 'sykkel') {
    if (equipment.drivetrain) metaDeler.push(equipment.drivetrain)
    if (equipment.wheelset) metaDeler.push(equipment.wheelset)
  }
  if (cat === 'sykkelsko' && equipment.cleat_system) metaDeler.push(equipment.cleat_system)

  const kmAndel = maxKm > 0 ? Math.min(equipment.usage.total_km / maxKm, 1) : 0

  return (
    <Link href={`/app/utstyr/${equipment.id}`}
      className="flex items-center gap-3 p-3 md:p-4 transition-opacity hover:opacity-80"
      style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none' }}>
      {/* Uten bilde sto det en tom rute her — kortet så tomt ut. Kategoriikonet
          fyller plassen (samme fasit som velgeren i økta). */}
      <div className="w-11 h-11 md:w-[52px] md:h-[52px] shrink-0 flex items-center justify-center"
        style={{
          backgroundColor: 'var(--flate-8-alt)',
          backgroundImage: equipment.image_url ? `url(${equipment.image_url})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}>
        {!equipment.image_url && (
          <span aria-hidden style={{ fontSize: '19px', opacity: 0.75 }}>{EQUIPMENT_CATEGORY_ICONS[cat]}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '16px' }}
            className="truncate">
            {equipment.name}
          </p>
          {badges.map(b => <Badge key={b.text} text={b.text} color={b.color} />)}
        </div>
        {(subtitle || metaDeler.length > 0) && (
          <p className="truncate"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: '13px' }}>
            {[subtitle, ...metaDeler].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="text-xs tracking-widest uppercase mt-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          {equipment.usage.total_km.toFixed(1)} km · {Math.round(equipment.usage.total_minutes / 60)} t · {equipment.usage.workout_count} økt{equipment.usage.workout_count === 1 ? '' : 'er'}
          {equipment.status !== 'active' && ` · ${EQUIPMENT_STATUS_LABELS[equipment.status]}`}
        </p>
        {maxKm > 0 && (
          <div style={{ height: 5, borderRadius: 3, backgroundColor: 'var(--flate-16)', marginTop: 7, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${Math.round(kmAndel * 100)}%`, backgroundColor: ATHLETE_ORANGE }} />
          </div>
        )}
        {cat === 'ski' && skiInfo?.km_since_slip != null && (
          <p className="text-xs mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            {skiInfo.km_since_slip.toFixed(0)} km siden siste slip
          </p>
        )}
      </div>
      <span style={{ color: 'var(--tekst-8-app)', fontSize: '18px' }}>›</span>
    </Link>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="shrink-0"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: '10px', letterSpacing: '0.12em',
        color, border: `1px solid ${color}80`, borderRadius: 5,
        padding: '1px 7px',
      }}>
      {text}
    </span>
  )
}

function FilterGroup({ label, children, fade = false }: { label: string; children: React.ReactNode; fade?: boolean }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-xs tracking-widest uppercase mr-1 shrink-0"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </span>
      {/* Etiketten staar i ro — bare knappene scroller (kun paa mobil). */}
      <div className={`flex items-center gap-1 min-w-0 xp-scrollrow${fade ? ' xp-scrollfade' : ''}`}>
        {children}
      </div>
    </div>
  )
}

function NewEquipmentModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    category: 'ski' as EquipmentCategory,
    brand: '',
    model: '',
    sport: '',
    purchase_date: '',
    price_kr: '',
    notes: '',
    // Fase 99 — start-km + kategorispesifikke felter (fasit: designfilens seksjon 1).
    start_km: '',
    ...tomKategoriVerdier(),
  })

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Navn er påkrevd'); return }
    setError(null)
    startTransition(async () => {
      const erRulleski = form.category === 'rulleski'
      const result = await saveEquipment({
        name: form.name,
        category: form.category,
        brand: form.brand,
        model: form.model,
        sport: form.sport,
        purchase_date: form.purchase_date || null,
        price_kr: form.price_kr ? parseDecimal(form.price_kr) : null,
        notes: form.notes,
        start_km: form.start_km ? parseDecimal(form.start_km) : null,
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
      // Ski: type/lengde/bruk/slip går i equipment_ski_data — skia ligger dermed
      // automatisk i skiparken (som lister category='ski').
      if (form.category === 'ski' && result.id) {
        const skiResult = await saveSkiData({
          equipment_id: result.id,
          ski_type: form.ski_type || null,
          length_cm: form.ski_length_cm ? parseDecimal(form.ski_length_cm) : null,
          usage_type: form.ski_usage || null,
          current_slip: form.ski_slip,
          slip_date: slipDatoTilDate(form.ski_slip_date),
        })
        if (skiResult.error) { setError(`Utstyret ble lagret, men ski-detaljene feilet: ${skiResult.error}`); return }
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'var(--scrim-70)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '5vh', paddingBottom: '5vh', overflow: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--flate-3)',
          border: '1px solid var(--kant-3)',
          width: '92%', maxWidth: '560px',
        }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--kant-3)' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '24px', letterSpacing: '0.08em' }}>
            Nytt utstyr
          </h2>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', cursor: 'pointer', fontSize: '22px' }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Kategori">
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_CATEGORIES.map(c => (
                <FormChip key={c} active={form.category === c} onClick={() => set({ category: c })}>
                  {EQUIPMENT_CATEGORY_LABELS[c]}
                </FormChip>
              ))}
            </div>
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
          <Field label="Km allerede gått">
            <input type="text" inputMode="decimal" value={form.start_km}
              onChange={e => set({ start_km: e.target.value })}
              placeholder="0" className="w-full px-4 py-3" style={inputStyle} />
            <p className="text-xs mt-1" style={{ color: 'var(--tekst-8-app)' }}>
              Start-km — historisk utstyr starter ikke på null. Legges til km-telleren.
            </p>
          </Field>

          {/* Kategorispesifikke felter — delt komponent, samme fasit som detaljsiden */}
          <KategoriFelter category={form.category} verdier={form} onChange={set} visSki />
          <Field label="Notater">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} className="w-full px-4 py-3" style={inputStyle} />
          </Field>

          {error && <p className="text-sm" style={{ color: '#FF4500' }}>{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="xp-pill xp-pill-ghost">
              Avbryt
            </button>
            <button type="submit" disabled={pending} className="xp-pill xp-pill-primary">
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
  color: 'var(--tekst-1-app)',
  backgroundColor: 'var(--flate-8-alt)',
  border: '1px solid var(--kant-3)',
  fontSize: '15px',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
