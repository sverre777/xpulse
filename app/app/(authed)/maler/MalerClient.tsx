'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTemplate, duplicateTemplate } from '@/app/actions/templates'
import { deletePlanTemplate, duplicatePlanTemplate } from '@/app/actions/plan-templates'
import { SPORTS, TEMPLATE_CATEGORIES, WorkoutTemplate } from '@/lib/types'
import type { PlanTemplate } from '@/lib/template-types'

// Periodiserings-maler er trener-eide fra og med Fase F — utøver ser disse
// materialisert i egen periodiserings-side, ikke som mal-objekter.
type Tab = 'okt' | 'plan'

interface Props {
  activeTab: string
  initialWorkoutTemplates: WorkoutTemplate[]
  initialPlanTemplates: PlanTemplate[]
}

export function MalerClient({
  activeTab,
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

  const setTab = (t: Tab) => {
    const url = new URL(window.location.href)
    if (t === 'okt') url.searchParams.delete('tab')
    else url.searchParams.set('tab', t)
    router.push(url.pathname + url.search)
  }

  return (
    <div>
      <TabBar tab={tab} setTab={setTab} />

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

      {tab === 'okt' && (
        <WorkoutList
          templates={initialWorkoutTemplates}
          query={query} category={category} sport={sport}
          pendingId={pendingId}
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
  templates, query, category, sport, pendingId, onDelete, onDuplicate,
}: {
  templates: WorkoutTemplate[]
  query: string; category: string; sport: string
  pendingId: string | null
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
            onDelete={() => onDelete(t.id, t.name)}
            onDuplicate={() => onDuplicate(t.id)}
          />
        )
      })}
    </div>
  )
}

function PlanList({
  templates, query, category, pendingId, onDelete, onDuplicate,
}: {
  templates: PlanTemplate[]
  query: string; category: string
  pendingId: string | null
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
  name, description, category, meta, disabled, onDelete, onDuplicate,
}: {
  name: string
  description: string | null
  category: string | null
  meta: string[]
  disabled: boolean
  onDelete: () => void
  onDuplicate: () => void
}) {
  return (
    <div className="p-4"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
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

        <div className="flex gap-1.5">
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
  backgroundColor: '#16161A',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  outline: 'none',
}
