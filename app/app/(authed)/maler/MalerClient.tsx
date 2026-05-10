'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTemplate, duplicateTemplate, materializeOktmalAtDate } from '@/app/actions/templates'
import { deletePlanTemplate, duplicatePlanTemplate } from '@/app/actions/plan-templates'
import { SPORTS, TEMPLATE_CATEGORIES, WorkoutTemplate, type Sport } from '@/lib/types'
import type { PlanTemplate } from '@/lib/template-types'
import { OktmalBuilder } from '@/components/coach/OktmalBuilder'
import { PlanMalBuilder } from '@/components/coach/PlanMalBuilder'

// Periodiserings-maler er trener-eide fra og med Fase F — utøver ser disse
// materialisert i egen periodiserings-side, ikke som mal-objekter.
type Tab = 'okt' | 'plan'

interface Props {
  activeTab: string
  // Brukerens primære sport — sendes til builder-modaler så ny økt-/plan-mal
  // forhåndsutfylles med utøvers sport.
  primarySport: Sport
  initialWorkoutTemplates: WorkoutTemplate[]
  initialPlanTemplates: PlanTemplate[]
}

export function MalerClient({
  activeTab,
  primarySport,
  initialWorkoutTemplates,
  initialPlanTemplates,
}: Props) {
  const tab: Tab = activeTab === 'plan' ? 'plan' : 'okt'
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [sport, setSport] = useState<string>('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [_isPending, startTransition] = useTransition()
  void _isPending
  // Builder-modaler — én av gangen. saveAsTemplate / savePlanTemplate bruker
  // user_id = auth.uid() så maler er allerede privat per bruker (ingen ekstra
  // visibility-flag trengs; treners RLS leser bare egne).
  const [showOktmalBuilder, setShowOktmalBuilder] = useState(false)
  const [showPlanmalBuilder, setShowPlanmalBuilder] = useState(false)
  // Edit-modus: når satt åpnes builder med eksisterende mal-data og lagring
  // oppdaterer raden i stedet for å lage ny.
  const [editingOktmal, setEditingOktmal] = useState<WorkoutTemplate | null>(null)
  const [editingPlanmal, setEditingPlanmal] = useState<PlanTemplate | null>(null)
  // Bruk-på-dato: setter mal som skal materialiseres + dato-modal vises.
  const [bruktOktmal, setBruktOktmal] = useState<WorkoutTemplate | null>(null)

  const setTab = (t: Tab) => {
    const url = new URL(window.location.href)
    if (t === 'okt') url.searchParams.delete('tab')
    else url.searchParams.set('tab', t)
    router.push(url.pathname + url.search)
  }

  return (
    <div>
      <TabBar tab={tab} setTab={setTab} />

      {/* Opprett-knapper — utøver kan lage egne private maler. Knappene
          tilpasses aktiv tab så CTA er kontekstuelt riktig. */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => setShowOktmalBuilder(true)}
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2',
            backgroundColor: '#FF4500', border: 'none',
            padding: '10px 16px', cursor: 'pointer',
          }}>
          + Ny øktmal
        </button>
        <button type="button" onClick={() => setShowPlanmalBuilder(true)}
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
            background: 'none', border: '1px solid #FF4500',
            padding: '10px 16px', cursor: 'pointer',
          }}>
          + Ny planmal
        </button>
      </div>

      {(showOktmalBuilder || editingOktmal) && (
        <OktmalBuilder
          primarySport={primarySport}
          templates={initialWorkoutTemplates}
          editing={editingOktmal}
          onClose={() => { setShowOktmalBuilder(false); setEditingOktmal(null) }}
        />
      )}

      {(showPlanmalBuilder || editingPlanmal) && (
        <PlanMalBuilder
          primarySport={primarySport}
          workoutTemplates={initialWorkoutTemplates}
          editing={editingPlanmal}
          onClose={() => { setShowPlanmalBuilder(false); setEditingPlanmal(null) }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Søk etter navn..."
          style={iSt} className="w-full px-3 py-2" />

        <select value={category} onChange={e => setCategory(e.target.value)}
          style={iSt} className="w-full px-3 py-2">
          <option value="">Alle kategorier</option>
          {TEMPLATE_CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {tab === 'okt' ? (
          <select value={sport} onChange={e => setSport(e.target.value)}
            style={iSt} className="w-full px-3 py-2">
            <option value="">Alle sporter</option>
            {SPORTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        ) : (
          <span />
        )}
      </div>

      {bruktOktmal && (
        <BrukPaaDatoModal
          template={bruktOktmal}
          onClose={() => setBruktOktmal(null)}
          onMaterialized={(date) => {
            setBruktOktmal(null)
            router.push(`/app/plan?date=${date}`)
            router.refresh()
          }}
        />
      )}

      {tab === 'okt' && (
        <WorkoutList
          templates={initialWorkoutTemplates}
          query={query} category={category} sport={sport}
          pendingId={pendingId}
          onEdit={(t) => setEditingOktmal(t)}
          onUseDate={(t) => setBruktOktmal(t)}
          onDelete={(id, name) => {
            if (!window.confirm(`Slett mal "${name}"?`)) return
            setPendingId(id)
            startTransition(async () => {
              const r = await deleteTemplate(id)
              if (r.error) window.alert(r.error); else router.refresh()
              setPendingId(null)
            })
          }}
          onDuplicate={(id) => {
            setPendingId(id)
            startTransition(async () => {
              const r = await duplicateTemplate(id)
              if (r.error) window.alert(r.error); else router.refresh()
              setPendingId(null)
            })
          }}
        />
      )}

      {tab === 'plan' && (
        <PlanList
          templates={initialPlanTemplates}
          query={query} category={category}
          pendingId={pendingId}
          onEdit={(t) => setEditingPlanmal(t)}
          onDelete={(id, name) => {
            if (!window.confirm(`Slett plan-mal "${name}"?`)) return
            setPendingId(id)
            startTransition(async () => {
              const r = await deletePlanTemplate(id)
              if (r.error) window.alert(r.error); else router.refresh()
              setPendingId(null)
            })
          }}
          onDuplicate={(id) => {
            setPendingId(id)
            startTransition(async () => {
              const r = await duplicatePlanTemplate(id)
              if (r.error) window.alert(r.error); else router.refresh()
              setPendingId(null)
            })
          }}
        />
      )}

    </div>
  )
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'okt', label: 'Økt-maler' },
    { key: 'plan', label: 'Plan-maler' },
  ]
  return (
    <div className="flex gap-0 mb-6" style={{ borderBottom: '1px solid #1E1E22' }}>
      {tabs.map(t => {
        const active = t.key === tab
        return (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: active ? '#FF4500' : '#8A8A96',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${active ? '#FF4500' : 'transparent'}`,
              cursor: 'pointer',
              marginBottom: '-1px',
            }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function WorkoutList({
  templates, query, category, sport, pendingId, onEdit, onUseDate, onDelete, onDuplicate,
}: {
  templates: WorkoutTemplate[]
  query: string; category: string; sport: string
  pendingId: string | null
  onEdit: (t: WorkoutTemplate) => void
  onUseDate: (t: WorkoutTemplate) => void
  onDelete: (id: string, name: string) => void
  onDuplicate: (id: string) => void
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return templates.filter(t => {
      if (category && t.category !== category) return false
      if (sport && t.sport !== sport) return false
      if (q && !t.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [templates, query, category, sport])
  if (filtered.length === 0) {
    return <EmptyBox empty={templates.length === 0} kind="økt" />
  }
  return (
    <div className="space-y-2">
      {filtered.map(t => {
        const sportLabel = SPORTS.find(s => s.value === t.sport)?.label ?? t.sport ?? '—'
        const lastUsed = t.last_used_at
          ? new Date(t.last_used_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Aldri brukt'
        return (
          <TemplateRow key={t.id}
            name={t.name} description={t.description} category={t.category}
            meta={[sportLabel, `Brukt ${t.times_used}×`, `Sist: ${lastUsed}`]}
            disabled={pendingId === t.id}
            onEdit={() => onEdit(t)}
            onUseDate={() => onUseDate(t)}
            onDelete={() => onDelete(t.id, t.name)}
            onDuplicate={() => onDuplicate(t.id)}
          />
        )
      })}
    </div>
  )
}

function PlanList({
  templates, query, category, pendingId, onEdit, onDelete, onDuplicate,
}: {
  templates: PlanTemplate[]
  query: string; category: string
  pendingId: string | null
  onEdit: (t: PlanTemplate) => void
  onDelete: (id: string, name: string) => void
  onDuplicate: (id: string) => void
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return templates.filter(t => {
      if (category && t.category !== category) return false
      if (q && !t.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [templates, query, category])
  if (filtered.length === 0) {
    return <EmptyBox empty={templates.length === 0} kind="plan" />
  }
  return (
    <div className="space-y-2">
      {filtered.map(t => (
        <TemplateRow key={t.id}
          name={t.name} description={t.description} category={t.category}
          meta={[
            `${t.duration_days} dager`,
            `${t.plan_data?.workouts?.length ?? 0} økter`,
          ]}
          disabled={pendingId === t.id}
          onEdit={() => onEdit(t)}
          onDelete={() => onDelete(t.id, t.name)}
          onDuplicate={() => onDuplicate(t.id)}
        />
      ))}
    </div>
  )
}

function EmptyBox({ empty, kind }: { empty: boolean; kind: 'økt' | 'plan' }) {
  const emptyText =
    kind === 'økt'
      ? 'Du har ingen økt-maler ennå. Lag en ved å trykke "Lagre som mal" nederst i en økt.'
      : 'Du har ingen plan-maler ennå. Lag en ved å trykke "Lagre som mal" i Plan-kalenderen.'
  return (
    <div className="p-8 text-center" style={{ border: '1px dashed #1E1E22' }}>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {empty ? emptyText : 'Ingen maler matcher filtrene.'}
      </p>
    </div>
  )
}

function TemplateRow({
  name, description, category, meta, disabled, onEdit, onUseDate, onDelete, onDuplicate,
}: {
  name: string
  description: string | null
  category: string | null
  meta: string[]
  disabled: boolean
  onEdit: () => void
  // Bruk-på-dato finnes kun på øktmal i v1; planmal kan utvides senere.
  onUseDate?: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  // Hele raden klikkbar → åpner edit. Knappene under stopper propagation
  // så Dupliser/Slett ikke trigger edit ved et uhell.
  return (
    <div className="p-4 transition-colors hover:bg-[#1A1A22] cursor-pointer"
      onClick={onEdit}
      style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
            fontSize: '20px', letterSpacing: '0.05em',
          }}>
            {name}
          </div>
          {description && (
            <p className="mt-1 text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC' }}>
              {description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 items-center text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {category && <Badge color="#D4A017">{category}</Badge>}
            {meta.map((m, i) => <span key={i}>· {m}</span>)}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5"
          onClick={e => e.stopPropagation()}>
          {onUseDate && (
            <ActionBtn onClick={onUseDate} disabled={disabled}>Bruk på dato</ActionBtn>
          )}
          <ActionBtn onClick={onEdit} disabled={disabled}>Rediger</ActionBtn>
          <ActionBtn onClick={onDuplicate} disabled={disabled}>Dupliser</ActionBtn>
          <ActionBtn onClick={onDelete} disabled={disabled} danger>Slett</ActionBtn>
        </div>
      </div>
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="px-2 py-0.5"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", color,
        border: `1px solid ${color}66`, letterSpacing: '0.1em',
      }}>
      {children}
    </span>
  )
}

function ActionBtn({
  children, onClick, disabled, danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: danger ? '#FF4500' : '#8A8A96',
        background: 'none',
        border: `1px solid ${danger ? '#FF450066' : '#222228'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}>
      {children}
    </button>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#1A1A22',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  outline: 'none',
}

// Lett dato-velger-modal for "Bruk på dato"-flyten. Validerer at dato ikke
// er i fortid (planlagte økter må være i nåtid eller fremtiden). Etter
// bekreftelse kalles materializeOktmalAtDate og parent får workout-id.
function BrukPaaDatoModal({
  template, onClose, onMaterialized,
}: {
  template: WorkoutTemplate
  onClose: () => void
  // Mottar valgt dato (ikke workout-id) så parent kan navigere til riktig
  // dag i Plan-kalenderen.
  onMaterialized: (date: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    setError(null)
    startTransition(async () => {
      const res = await materializeOktmalAtDate(template.id, date)
      if (res.error) {
        setError(res.error)
        return
      }
      onMaterialized(date)
    })
  }

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '80px', paddingLeft: '12px', paddingRight: '12px',
      }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-md p-5"
        style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
            Bruk mal på dato
          </span>
        </div>

        <p className="mb-4 text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC' }}>
          Sett inn <strong style={{ color: '#F0F0F2' }}>{template.name}</strong> som planlagt
          økt på valgt dato i din Plan-kalender.
        </p>

        <label className="block mb-1 text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Dato
        </label>
        <input type="date" value={date} min={today}
          onChange={e => setDate(e.target.value)}
          style={{ ...iSt, width: '100%', padding: '8px 12px' }} />

        {error && (
          <p className="mt-3 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} disabled={pending}
            className="text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #262629',
              padding: '8px 14px', cursor: pending ? 'not-allowed' : 'pointer',
            }}>
            Avbryt
          </button>
          <button type="button" onClick={handleConfirm}
            disabled={pending || !date}
            className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2',
              background: '#FF4500', border: 'none',
              padding: '8px 14px',
              cursor: (pending || !date) ? 'not-allowed' : 'pointer',
              opacity: (pending || !date) ? 0.6 : 1,
            }}>
            {pending ? 'Setter inn…' : 'Bekreft'}
          </button>
        </div>
      </div>
    </div>
  )
}
