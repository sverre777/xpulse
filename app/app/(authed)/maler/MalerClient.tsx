'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTemplate, duplicateTemplate } from '@/app/actions/templates'
import { SPORTS, TEMPLATE_CATEGORIES, WorkoutTemplate } from '@/lib/types'

export function MalerClient({ initialTemplates }: { initialTemplates: WorkoutTemplate[] }) {
  const router = useRouter()
  const [templates] = useState<WorkoutTemplate[]>(initialTemplates)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [sport, setSport] = useState<string>('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [_isPending, startTransition] = useTransition()
  void _isPending

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return templates.filter(t => {
      if (category && t.category !== category) return false
      if (sport && t.sport !== sport) return false
      if (q && !t.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [templates, query, category, sport])

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Slett mal "${name}"?`)) return
    setPendingId(id)
    startTransition(async () => {
      const result = await deleteTemplate(id)
      if (result.error) window.alert(result.error)
      else router.refresh()
      setPendingId(null)
    })
  }

  const handleDuplicate = (id: string) => {
    setPendingId(id)
    startTransition(async () => {
      const result = await duplicateTemplate(id)
      if (result.error) window.alert(result.error)
      else router.refresh()
      setPendingId(null)
    })
  }

  return (
    <div>
      {/* Filter */}
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

        <select value={sport} onChange={e => setSport(e.target.value)}
          style={iSt} className="w-full px-3 py-2">
          <option value="">Alle sporter</option>
          {SPORTS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {templates.length === 0
              ? 'Du har ingen maler ennå. Lag en ved å trykke "Lagre som mal" nederst i en økt.'
              : 'Ingen maler matcher filtrene.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <TemplateRow key={t.id}
              template={t}
              disabled={pendingId === t.id}
              onDelete={() => handleDelete(t.id, t.name)}
              onDuplicate={() => handleDuplicate(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateRow({
  template, disabled, onDelete, onDuplicate,
}: {
  template: WorkoutTemplate
  disabled: boolean
  onDelete: () => void
  onDuplicate: () => void
}) {
  const sportLabel = SPORTS.find(s => s.value === template.sport)?.label ?? template.sport ?? '—'
  const lastUsed = template.last_used_at
    ? new Date(template.last_used_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Aldri brukt'

  return (
    <div className="p-4"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="flex items-start justify-between gap-3">
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
            {template.category && <Badge color="#D4A017">{template.category}</Badge>}
            <span>· {sportLabel}</span>
            <span>· Brukt {template.times_used}×</span>
            <span>· Sist: {lastUsed}</span>
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
