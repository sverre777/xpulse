'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deletePeriodizationTemplate, duplicatePeriodizationTemplate,
} from '@/app/actions/periodization-templates'
import type { PeriodizationTemplate } from '@/lib/template-types'
import type { Sport } from '@/lib/types'
import {
  PeriodiseringMalBuilder, PERIOD_SPORT_CATEGORIES,
} from '@/components/coach/PeriodiseringMalBuilder'
import { PeriodiseringMalEditModal } from '@/components/coach/PeriodiseringMalEditModal'
import { CoachPushModal } from '@/components/coach/CoachPushModal'

const COACH_BLUE = '#1A6FD4'

interface Props {
  initialTemplates: PeriodizationTemplate[]
  primarySport: Sport
}

export function PeriodiseringMalTab({ initialTemplates, primarySport }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [buildingFrom, setBuildingFrom] = useState<PeriodizationTemplate | null>(null)
  const [editing, setEditing] = useState<PeriodizationTemplate | null>(null)
  const [pushing, setPushing] = useState<PeriodizationTemplate | null>(null)
  const [_isPending, startTransition] = useTransition()
  void _isPending

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialTemplates.filter(t => {
      if (category && t.category !== category) return false
      if (q && !t.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [initialTemplates, query, category])

  const bySport = useMemo(() => {
    const map = new Map<string, PeriodizationTemplate[]>()
    for (const t of filtered) {
      const key = t.category ?? 'Annet'
      const list = map.get(key) ?? []
      list.push(t)
      map.set(key, list)
    }
    return map
  }, [filtered])

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {initialTemplates.length} periodiseringsmal{initialTemplates.length === 1 ? '' : 'er'}
        </p>
        <button type="button" onClick={() => { setBuildingFrom(null); setBuilderOpen(true) }}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: COACH_BLUE, color: '#F0F0F2',
            border: 'none', cursor: 'pointer',
          }}>
          + Ny periodiseringsmal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Søk etter navn…"
          style={iSt} className="w-full px-3 py-2" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={iSt} className="w-full px-3 py-2">
          <option value="">Alle sporter</option>
          {PERIOD_SPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {initialTemplates.length === 0
              ? 'Ingen periodiseringsmaler ennå. Trykk "+ Ny periodiseringsmal" for å bygge din første mal.'
              : 'Ingen periodiseringsmaler matcher filtrene.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[...PERIOD_SPORT_CATEGORIES].map(cat => {
            const list = bySport.get(cat)
            if (!list || list.length === 0) return null
            return (
              <div key={cat}>
                <h3 className="text-[10px] tracking-widest uppercase mb-2"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: COACH_BLUE, letterSpacing: '0.2em',
                  }}>
                  {cat} · {list.length}
                </h3>
                <div className="space-y-2">
                  {list.map(t => (
                    <Row
                      key={t.id}
                      template={t}
                      disabled={pendingId === t.id}
                      onSend={() => setPushing(t)}
                      onBuild={() => { setBuildingFrom(t); setBuilderOpen(true) }}
                      onEditMeta={() => setEditing(t)}
                      onDuplicate={() => {
                        setPendingId(t.id)
                        startTransition(async () => {
                          const r = await duplicatePeriodizationTemplate(t.id)
                          if (r.error) window.alert(r.error); else router.refresh()
                          setPendingId(null)
                        })
                      }}
                      onDelete={() => {
                        if (!window.confirm(`Slett mal "${t.name}"?`)) return
                        setPendingId(t.id)
                        startTransition(async () => {
                          const r = await deletePeriodizationTemplate(t.id)
                          if (r.error) window.alert(r.error); else router.refresh()
                          setPendingId(null)
                        })
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {builderOpen && (
        <PeriodiseringMalBuilder
          editing={buildingFrom}
          defaultSport={primarySport}
          onClose={() => { setBuilderOpen(false); setBuildingFrom(null) }}
        />
      )}
      {editing && (
        <PeriodiseringMalEditModal template={editing} onClose={() => setEditing(null)} />
      )}
      {pushing && (
        <CoachPushModal
          kind="periodization"
          templateId={pushing.id}
          templateName={pushing.name}
          onClose={() => setPushing(null)}
        />
      )}
    </div>
  )
}

function Row({
  template, disabled, onSend, onBuild, onEditMeta, onDuplicate, onDelete,
}: {
  template: PeriodizationTemplate
  disabled: boolean
  onSend: () => void
  onBuild: () => void
  onEditMeta: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const weeks = Math.ceil(template.duration_days / 7)
  const periodCount = template.periodization_data?.periods?.length ?? 0
  const keyDateCount = template.periodization_data?.key_dates?.length ?? 0
  const updated = new Date(template.updated_at).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  return (
    <div className="p-4"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
            fontSize: '20px', letterSpacing: '0.05em',
          }}>
            {template.name}
          </div>
          {template.description && (
            <p className="mt-1 text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC' }}>
              {template.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 items-center text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            <span>{template.duration_days} dager / {weeks} uker</span>
            <span>· {periodCount} periode{periodCount === 1 ? '' : 'r'}</span>
            <span>· {keyDateCount} hendelse{keyDateCount === 1 ? '' : 'r'}</span>
            <span>· Oppdatert {updated}</span>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <ActionBtn onClick={onSend} disabled={disabled} primary>Send</ActionBtn>
          <ActionBtn onClick={onBuild} disabled={disabled}>Bygg</ActionBtn>
          <ActionBtn onClick={onEditMeta} disabled={disabled}>Rediger info</ActionBtn>
          <ActionBtn onClick={onDuplicate} disabled={disabled}>Dupliser</ActionBtn>
          <ActionBtn onClick={onDelete} disabled={disabled} danger>Slett</ActionBtn>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({
  children, onClick, disabled, danger, primary,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  primary?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: primary ? '#F0F0F2' : danger ? '#FF4500' : '#8A8A96',
        background: primary ? COACH_BLUE : 'none',
        border: primary ? 'none' : `1px solid ${danger ? '#FF450066' : '#222228'}`,
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
