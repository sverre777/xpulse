'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getCoachGroupDetails,
  updateCoachGroup,
  deleteCoachGroup,
  updateCoachGroupMemberRole,
  removeCoachGroupMember,
  addCoachGroupMembers,
  type CoachGroupDetails,
  type CoachGroupMember,
} from '@/app/actions/coach-dashboard'
import {
  getCoachAthleteRelations,
  type CoachAthleteRelation,
} from '@/app/actions/coach-settings'

const COACH_BLUE = '#1A6FD4'

interface Props {
  groupId: string
  open: boolean
  onClose: () => void
}

export function EditGroupModal({ groupId, open, onClose }: Props) {
  const router = useRouter()
  const [details, setDetails] = useState<CoachGroupDetails | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [candidates, setCandidates] = useState<CoachAthleteRelation[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) {
      setDetails(null)
      setError(null)
      setShowAddPanel(false)
      setConfirmDelete(false)
      return
    }
    setLoading(true)
    ;(async () => {
      const res = await getCoachGroupDetails(groupId)
      if ('error' in res) setError(res.error)
      else {
        setDetails(res)
        setName(res.name)
        setDescription(res.description ?? '')
      }
      setLoading(false)
    })()
  }, [open, groupId])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const memberIds = new Set((details?.members ?? []).map(m => m.userId))
  const availableCandidates = candidates.filter(
    c => c.status === 'active' && !memberIds.has(c.athleteId),
  )

  const refresh = async () => {
    const res = await getCoachGroupDetails(groupId)
    if (!('error' in res)) setDetails(res)
  }

  const loadCandidates = async () => {
    if (candidates.length > 0) return
    const res = await getCoachAthleteRelations()
    if (Array.isArray(res)) setCandidates(res)
  }

  const handleSaveMeta = () => {
    if (!details) return
    setError(null)
    startTransition(async () => {
      const res = await updateCoachGroup(groupId, { name, description })
      if (res.error) { setError(res.error); return }
      await refresh()
      router.refresh()
    })
  }

  const handleRoleChange = (userId: string, role: 'admin' | 'coach' | 'athlete') => {
    setError(null)
    startTransition(async () => {
      const res = await updateCoachGroupMemberRole(groupId, userId, role)
      if (res.error) { setError(res.error); return }
      await refresh()
    })
  }

  const handleRemove = (userId: string) => {
    setError(null)
    startTransition(async () => {
      const res = await removeCoachGroupMember(groupId, userId)
      if (res.error) { setError(res.error); return }
      await refresh()
    })
  }

  const handleAdd = (userId: string) => {
    setError(null)
    startTransition(async () => {
      const res = await addCoachGroupMembers(groupId, [userId], 'athlete')
      if (res.error) { setError(res.error); return }
      await refresh()
    })
  }

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const res = await deleteCoachGroup(groupId)
      if (res.error) { setError(res.error); return }
      onClose()
      router.refresh()
    })
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-10"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl flex flex-col"
        style={{
          backgroundColor: '#0E0E10',
          border: '1px solid #1E1E22',
          maxHeight: 'calc(100vh - 80px)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid #1E1E22' }}
        >
          <span
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: COACH_BLUE }}
          >
            Rediger gruppe
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8A8A96',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
              padding: '4px 8px',
            }}
          >
            ESC
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {loading && (
            <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Laster…
            </p>
          )}
          {error && (
            <p className="text-xs px-3 py-2"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
                border: '1px solid #E11D48',
              }}>
              {error}
            </p>
          )}

          {details && (
            <>
              <section className="flex flex-col gap-2">
                <label className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  Navn
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="px-3 py-2 text-sm"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
                    color: '#F0F0F2', outline: 'none',
                  }}
                />
                <label className="text-xs tracking-widest uppercase mt-2"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  Beskrivelse
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="px-3 py-2 text-sm"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
                    color: '#F0F0F2', outline: 'none', resize: 'vertical',
                  }}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveMeta}
                    disabled={isPending}
                    className="px-3 py-1.5 text-xs tracking-widest uppercase"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      backgroundColor: COACH_BLUE, color: '#F0F0F2',
                      border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
                      opacity: isPending ? 0.5 : 1,
                    }}
                  >
                    {isPending ? 'Lagrer…' : 'Lagre'}
                  </button>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs tracking-widest uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    Medlemmer ({details.members.length})
                  </span>
                  <button
                    type="button"
                    onClick={async () => { await loadCandidates(); setShowAddPanel(o => !o) }}
                    className="px-2 py-1 text-xs tracking-widest uppercase"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      backgroundColor: 'transparent', color: COACH_BLUE,
                      border: `1px solid ${COACH_BLUE}`, cursor: 'pointer',
                    }}
                  >
                    {showAddPanel ? 'Skjul' : '+ Legg til medlem'}
                  </button>
                </div>

                {showAddPanel && (
                  <div
                    className="px-3 py-2 flex flex-col gap-1"
                    style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}
                  >
                    {availableCandidates.length === 0 ? (
                      <p className="text-xs"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                        Ingen flere utøvere å legge til.
                      </p>
                    ) : (
                      availableCandidates.map(c => (
                        <div key={c.athleteId}
                          className="flex items-center justify-between py-1"
                        >
                          <span className="text-sm"
                            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                            {c.athleteName ?? c.athleteEmail ?? 'Ukjent'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdd(c.athleteId)}
                            disabled={isPending}
                            className="text-xs tracking-widest uppercase px-2 py-1"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              color: COACH_BLUE, border: `1px solid ${COACH_BLUE}`,
                              background: 'none', cursor: 'pointer',
                            }}
                          >
                            Legg til
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <ul className="flex flex-col">
                  {details.members.map(m => (
                    <MemberRow
                      key={m.userId}
                      member={m}
                      isPending={isPending}
                      onRoleChange={role => handleRoleChange(m.userId, role)}
                      onRemove={() => handleRemove(m.userId)}
                    />
                  ))}
                </ul>
              </section>

              <section className="flex flex-col gap-2 pt-2"
                style={{ borderTop: '1px solid #1E1E22' }}
              >
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                      Slett gruppe permanent?
                    </span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isPending}
                      className="px-3 py-1.5 text-xs tracking-widest uppercase"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        backgroundColor: '#E11D48', color: '#F0F0F2',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      Bekreft slett
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 text-xs tracking-widest uppercase"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        color: '#8A8A96', border: '1px solid #1E1E22',
                        background: 'none', cursor: 'pointer',
                      }}
                    >
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="self-start px-3 py-1.5 text-xs tracking-widest uppercase"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: '#E11D48', border: '1px solid #E11D48',
                      background: 'none', cursor: 'pointer',
                    }}
                  >
                    Slett gruppe
                  </button>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MemberRow({
  member, isPending, onRoleChange, onRemove,
}: {
  member: CoachGroupMember
  isPending: boolean
  onRoleChange: (role: 'admin' | 'coach' | 'athlete') => void
  onRemove: () => void
}) {
  return (
    <li
      className="flex items-center justify-between py-2"
      style={{ borderTop: '1px solid #1E1E22' }}
    >
      <div className="min-w-0 flex-1">
        <span className="text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          {member.fullName ?? member.email ?? 'Ukjent'}
        </span>
        {member.isViewer && (
          <span className="text-xs tracking-widest uppercase ml-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            (deg)
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={member.role}
          onChange={e => onRoleChange(e.target.value as 'admin' | 'coach' | 'athlete')}
          disabled={isPending}
          className="text-xs px-2 py-1"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
            color: '#F0F0F2', outline: 'none',
          }}
        >
          <option value="admin">Admin</option>
          <option value="coach">Trener</option>
          <option value="athlete">Utøver</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          disabled={isPending}
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#8A8A96', background: 'none', border: 'none',
            cursor: 'pointer', padding: '4px 6px',
          }}
          aria-label="Fjern medlem"
        >
          Fjern
        </button>
      </div>
    </li>
  )
}
