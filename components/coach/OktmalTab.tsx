'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTemplate, duplicateTemplate } from '@/app/actions/templates'
import { SPORTS, TEMPLATE_CATEGORIES, type Sport, type WorkoutTemplate } from '@/lib/types'
import { OktmalBuilder } from '@/components/coach/OktmalBuilder'
import { OktmalEditModal } from '@/components/coach/OktmalEditModal'
import { CoachPushModal } from '@/components/coach/CoachPushModal'

const COACH_BLUE = '#1A6FD4'

interface Props {
  initialTemplates: WorkoutTemplate[]
  primarySport: Sport
}

export function OktmalTab({ initialTemplates, primarySport }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [sport, setSport] = useState<string>('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null)
  const [pushing, setPushing] = useState<WorkoutTemplate | null>(null)
  const [_isPending, startTransition] = useTransition()
  void _isPending

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialTemplates.filter(t => {
      if (category && t.category !== category) return false
      if (sport && t.sport !== sport) return false
      if (q && !t.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [initialTemplates, query, category, sport])

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {initialTemplates.length} mal{initialTemplates.length === 1 ? '' : 'er'}
        </p>
        <button type="button" onClick={() => setShowBuilder(true)}
          className="px-4 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: COACH_BLUE, color: '#F0F0F2',
            border: 'none', cursor: 'pointer',
          }}>
          + Ny økt
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Søk etter navn…"
          style={iSt} className="w-full px-3 py-2" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={iSt} className="w-full px-3 py-2">
          <option value="">Alle kategorier</option>
          {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sport} onChange={e => setSport(e.target.value)}
          style={iSt} className="w-full px-3 py-2">
          <option value="">Alle sporter</option>
          {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {initialTemplates.length === 0
              ? 'Ingen øktmaler ennå. Trykk "+ Ny økt" for å bygge din første mal.'
              : 'Ingen maler matcher filtrene.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <Row
              key={t.id}
              template={t}
              disabled={pendingId === t.id}
              onSend={() => setPushing(t)}
              onEdit={() => setEditing(t)}
              onDuplicate={() => {
                setPendingId(t.id)
                startTransition(async () => {
                  const r = await duplicateTemplate(t.id)
                  if (r.error) window.alert(r.error); else router.refresh()
                  setPendingId(null)
                })
              }}
              onDelete={() => {
                if (!window.confirm(`Slett mal "${t.name}"?`)) return
                setPendingId(t.id)
                startTransition(async () => {
                  const r = await deleteTemplate(t.id)
                  if (r.error) window.alert(r.error); else router.refresh()
                  setPendingId(null)
                })
              }}
            />
          ))}
        </div>
      )}

      {showBuilder && (
        <OktmalBuilder
          primarySport={primarySport}
          templates={initialTemplates}
          onClose={() => setShowBuilder(false)}
        />
      )}
      {editing && (
        <OktmalEditModal template={editing} onClose={() => setEditing(null)} />
      )}
      {pushing && (
        <CoachPushModal
          kind="workout"
          templateId={pushing.id}
          templateName={pushing.name}
          onClose={() => setPushing(null)}
        />
      )}
    </div>
  )
}

function Row({
  template, disabled, onSend, onEdit, onDuplicate, onDelete,
}: {
  template: WorkoutTemplate
  disabled: boolean
  onSend: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const sportLabel = SPORTS.find(s => s.value === template.sport)?.label ?? template.sport ?? '—'
  const lastUsed = template.last_used_at
    ? new Date(template.last_used_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Aldri brukt'
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
            {template.category && (
              <span className="px-2 py-0.5"
                style={{ color: '#D4A017', border: '1px solid #D4A01766', letterSpacing: '0.1em' }}>
                {template.category}
              </span>
            )}
            <span>· {sportLabel}</span>
            <span>· Brukt {template.times_used}×</span>
            <span>· Sist: {lastUsed}</span>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <ActionBtn onClick={onSend} disabled={disabled} primary>Send</ActionBtn>
          <ActionBtn onClick={onEdit} disabled={disabled}>Rediger</ActionBtn>
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
        border: primary
          ? 'none'
          : `1px solid ${danger ? '#FF450066' : '#222228'}`,
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
