'use client'

import { useEffect, useState, useTransition } from 'react'
import type { FocusPoint, FocusScope, FocusContext } from '@/lib/focus-point-types'
import {
  getFocusPointsBoth, addFocusPoint, updateFocusPoint, deleteFocusPoint,
} from '@/app/actions/focus-points'

interface Props {
  scope: FocusScope
  periodKey: string
  context: FocusContext
  title: string
  // Viser plan-punkter read-only over refleksjonsfeltet (brukes i Dagbok).
  showPlanFocus?: boolean
  // Styring: kompakt modus reduserer padding for integrering i kalender-celler.
  compact?: boolean
}

const ACCENT_PLAN = '#FF4500'
const ACCENT_DAGBOK_HAS = '#28A86E'
const ACCENT_EMPTY = '#1E1E22'

export function FocusSection({
  scope, periodKey, context, title, showPlanFocus = false, compact = false,
}: Props) {
  const [planPoints, setPlanPoints] = useState<FocusPoint[]>([])
  const [ownPoints, setOwnPoints] = useState<FocusPoint[]>([])
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Last data én gang per (scope, periodKey, context).
  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    getFocusPointsBoth(scope, periodKey).then(res => {
      if (cancelled) return
      if ('error' in res) {
        setError(res.error)
        setLoaded(true)
        return
      }
      setPlanPoints(res.plan)
      setOwnPoints(context === 'plan' ? res.plan : res.dagbok)
      const hasAny = context === 'plan'
        ? res.plan.length > 0
        : (res.plan.length > 0 || res.dagbok.length > 0)
      setOpen(hasAny)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [scope, periodKey, context])

  const accent = !loaded
    ? ACCENT_EMPTY
    : context === 'plan'
      ? (ownPoints.length > 0 ? ACCENT_PLAN : ACCENT_EMPTY)
      : (ownPoints.length > 0 ? ACCENT_DAGBOK_HAS : ACCENT_EMPTY)

  const handleAdd = () => {
    if (!draftContent.trim()) return
    startTransition(async () => {
      setError(null)
      const res = await addFocusPoint(scope, periodKey, context, draftContent)
      if (res.error) { setError(res.error); return }
      // Refetch for å få riktig id/sort_order.
      const fresh = await getFocusPointsBoth(scope, periodKey)
      if ('error' in fresh) { setError(fresh.error); return }
      setPlanPoints(fresh.plan)
      setOwnPoints(context === 'plan' ? fresh.plan : fresh.dagbok)
      setDraftContent('')
      setDrafting(false)
    })
  }

  const handleUpdate = (id: string) => {
    if (!editContent.trim()) return
    startTransition(async () => {
      setError(null)
      const res = await updateFocusPoint(id, editContent)
      if (res.error) { setError(res.error); return }
      setOwnPoints(prev => prev.map(p => p.id === id ? { ...p, content: editContent.trim() } : p))
      setEditingId(null)
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      setError(null)
      const res = await deleteFocusPoint(id)
      if (res.error) { setError(res.error); return }
      setOwnPoints(prev => prev.filter(p => p.id !== id))
    })
  }

  const showPlan = showPlanFocus && context === 'dagbok' && planPoints.length > 0
  const emptyState = !showPlan && ownPoints.length === 0

  const pad = compact ? 'p-2' : 'p-3'
  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#0A0A0B',
    border: '1px solid #1E1E22',
    color: '#F0F0F2',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '13px',
    padding: '6px 8px',
    outline: 'none',
  }

  return (
    <div style={{
      backgroundColor: '#0D0D11',
      border: '1px solid #1E1E22',
      borderLeft: `3px solid ${accent}`,
    }}>
      <button type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between text-left ${pad}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {title}
          </span>
          {loaded && (
            <span className="text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              {ownPoints.length > 0 ? `${ownPoints.length}` : ''}
            </span>
          )}
        </div>
        <span style={{ color: '#555560', fontSize: '14px', lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>

      {open && loaded && (
        <div className="px-3 pb-3 space-y-2">
          {showPlan && (
            <div className="space-y-1">
              <p className="text-[10px] tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Planlagt
              </p>
              {planPoints.map(p => (
                <div key={p.id} className="px-2 py-1.5"
                  style={{
                    backgroundColor: '#0A0A0B',
                    borderLeft: `2px solid ${ACCENT_PLAN}`,
                    color: '#C0C0C8',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '13px',
                  }}>
                  {p.content}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {showPlan && (
              <p className="text-[10px] tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Refleksjon
              </p>
            )}
            {emptyState && (
              <p className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                {context === 'plan' ? 'Ingen fokus-punkter ennå.' : 'Ingen refleksjoner ennå.'}
              </p>
            )}
            {ownPoints.map(p => {
              const isEditing = editingId === p.id
              return (
                <div key={p.id} className="flex items-start gap-2 px-2 py-1.5"
                  style={{
                    backgroundColor: '#111113',
                    borderLeft: `2px solid ${context === 'plan' ? ACCENT_PLAN : ACCENT_DAGBOK_HAS}`,
                  }}>
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        style={inputStyle}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdate(p.id); if (e.key === 'Escape') setEditingId(null) }}
                      />
                      <button type="button" onClick={() => handleUpdate(p.id)} disabled={pending}
                        style={{ background: 'none', border: 'none', color: '#28A86E', fontSize: '14px', cursor: 'pointer', padding: 0 }}>✓</button>
                      <button type="button" onClick={() => setEditingId(null)}
                        style={{ background: 'none', border: 'none', color: '#555560', fontSize: '14px', cursor: 'pointer', padding: 0 }}>×</button>
                    </>
                  ) : (
                    <>
                      <p className="flex-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px' }}>
                        {p.content}
                      </p>
                      <button type="button"
                        onClick={() => { setEditingId(p.id); setEditContent(p.content) }}
                        style={{ background: 'none', border: 'none', color: '#555560', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                        title="Rediger">✎</button>
                      <button type="button"
                        onClick={() => handleDelete(p.id)}
                        disabled={pending}
                        style={{ background: 'none', border: 'none', color: '#555560', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                        title="Slett">×</button>
                    </>
                  )}
                </div>
              )
            })}

            {drafting ? (
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={draftContent}
                  onChange={e => setDraftContent(e.target.value)}
                  placeholder={context === 'plan' ? 'Hva skal du fokusere på?' : 'Hvordan gikk det?'}
                  style={inputStyle}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setDrafting(false); setDraftContent('') } }}
                />
                <button type="button" onClick={handleAdd} disabled={pending || !draftContent.trim()}
                  style={{
                    background: 'none', border: 'none',
                    color: draftContent.trim() ? '#28A86E' : '#555560',
                    fontSize: '14px', cursor: 'pointer', padding: 0,
                  }}>✓</button>
                <button type="button" onClick={() => { setDrafting(false); setDraftContent('') }}
                  style={{ background: 'none', border: 'none', color: '#555560', fontSize: '14px', cursor: 'pointer', padding: 0 }}>×</button>
              </div>
            ) : (
              <button type="button"
                onClick={() => setDrafting(true)}
                className="text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: ACCENT_PLAN, background: 'none', border: 'none',
                  padding: '4px 0', cursor: 'pointer',
                }}>
                + Legg til fokus
              </button>
            )}
          </div>

          {error && (
            <p className="text-xs" style={{ color: '#E11D48', fontFamily: "'Barlow Condensed', sans-serif" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
