'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCoachGroup,
  getAvailableRecipients,
  type RecipientCandidate,
} from '@/app/actions/inbox'

const COACH_BLUE = '#1A6FD4'
const ATHLETE_ORANGE = '#FF4500'

type Mode = 'dm' | 'group'

interface Props {
  open: boolean
  onClose: () => void
  viewerIsCoach: boolean
}

export function NewMessageModal({ open, onClose, viewerIsCoach }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('dm')
  const [recipients, setRecipients] = useState<RecipientCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [groupName, setGroupName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setLoadError(null)
    ;(async () => {
      const res = await getAvailableRecipients()
      if ('error' in res) setLoadError(res.error)
      else setRecipients(res)
      setLoading(false)
    })()
  }, [open])

  useEffect(() => {
    if (!open) {
      setMode('dm')
      setFilter('')
      setGroupName('')
      setSelectedIds(new Set())
      setSubmitError(null)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return recipients
    return recipients.filter(r => (r.fullName ?? '').toLowerCase().includes(q))
  }, [recipients, filter])

  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleDmSelect = (id: string) => {
    onClose()
    router.push(`/app/innboks/meldinger?to=${encodeURIComponent(id)}`)
  }

  const handleCreateGroup = () => {
    const name = groupName.trim()
    if (!name) { setSubmitError('Gruppenavn er påkrevd'); return }
    if (selectedIds.size === 0) { setSubmitError('Velg minst ett medlem'); return }
    setSubmitError(null)
    startTransition(async () => {
      const res = await createCoachGroup(name, Array.from(selectedIds))
      if (res.error || !res.id) { setSubmitError(res.error ?? 'Kunne ikke opprette gruppe'); return }
      onClose()
      router.push(`/app/innboks/meldinger?thread=${encodeURIComponent(`g:${res.id}`)}`)
    })
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0E0E10',
          border: '1px solid #1E1E22',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid #1E1E22' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.04em' }}>
            Ny melding
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Lukk
          </button>
        </div>

        {viewerIsCoach && (
          <div className="px-4 pt-3 flex gap-2">
            {(['dm', 'group'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="px-3 py-1.5 text-xs tracking-widest uppercase"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: mode === m ? '#1A1A22' : 'transparent',
                  border: `1px solid ${mode === m ? COACH_BLUE : '#1E1E22'}`,
                  color: mode === m ? '#F0F0F2' : '#8A8A96',
                  cursor: 'pointer',
                }}
              >
                {m === 'dm' ? 'Direktemelding' : 'Ny gruppe'}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 flex flex-col gap-3 flex-1 overflow-hidden">
          {mode === 'group' && (
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Gruppenavn"
              className="px-3 py-2 text-sm"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#1A1A22',
                color: '#F0F0F2',
                border: '1px solid #1E1E22',
                outline: 'none',
              }}
            />
          )}

          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Søk etter navn…"
            className="px-3 py-2 text-sm"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: '#1A1A22',
              color: '#F0F0F2',
              border: '1px solid #1E1E22',
              outline: 'none',
            }}
          />

          <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
            {loading && (
              <p className="p-4 text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Laster…
              </p>
            )}
            {loadError && (
              <p className="p-4 text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
                {loadError}
              </p>
            )}
            {!loading && !loadError && filtered.length === 0 && (
              <p className="p-4 text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                Ingen mulige mottakere.
              </p>
            )}
            <ul>
              {filtered.map(r => {
                const accent = r.isCoach ? COACH_BLUE : ATHLETE_ORANGE
                const selected = selectedIds.has(r.id)
                const isDmMode = mode === 'dm'
                return (
                  <li key={r.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                    <button
                      type="button"
                      onClick={() => (isDmMode ? handleDmSelect(r.id) : toggle(r.id))}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left transition-opacity hover:opacity-90"
                      style={{
                        background: selected ? '#1A1A22' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {!isDmMode && (
                        <span
                          aria-hidden="true"
                          style={{
                            width: '14px',
                            height: '14px',
                            border: `1px solid ${selected ? accent : '#2A2A30'}`,
                            backgroundColor: selected ? accent : 'transparent',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: accent, flexShrink: 0,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm"
                          style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}
                        >
                          {r.fullName ?? 'Ukjent bruker'}
                        </div>
                        <div
                          className="text-xs tracking-widest uppercase"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
                        >
                          {r.source === 'coach' && 'Din trener'}
                          {r.source === 'athlete' && 'Din utøver'}
                          {r.source === 'group' && (r.groupName ? `Gruppe · ${r.groupName}` : 'Gruppemedlem')}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {mode === 'group' && (
            <>
              {submitError && (
                <p className="text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
                  {submitError}
                </p>
              )}
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={isPending || !groupName.trim() || selectedIds.size === 0}
                className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  backgroundColor: COACH_BLUE,
                  color: '#0A0A0B',
                  border: 'none',
                  cursor: isPending || !groupName.trim() || selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                  opacity: isPending || !groupName.trim() || selectedIds.size === 0 ? 0.5 : 1,
                }}
              >
                {isPending ? 'Oppretter…' : `Opprett gruppe (${selectedIds.size} medlemmer)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
