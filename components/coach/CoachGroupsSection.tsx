'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCoachGroup, type CoachGroupSummary } from '@/app/actions/coach-dashboard'
import { EditGroupModal } from './EditGroupModal'

const COACH_BLUE = '#1A6FD4'

interface Props {
  groups: CoachGroupSummary[]
}

export function CoachGroupsSection({ groups }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const fd = new FormData()
    fd.append('name', name.trim())
    if (description.trim()) fd.append('description', description.trim())
    startTransition(async () => {
      setError(null)
      const res = await createCoachGroup(fd)
      if (res.error) { setError(res.error); return }
      setName(''); setDescription(''); setShowForm(false)
      router.refresh()
    })
  }

  return (
    <section className="mb-6" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid #1E1E22' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ width: '16px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <span
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            Grupper ({groups.length})
          </span>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-2 py-1 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: COACH_BLUE, border: `1px solid ${COACH_BLUE}`,
              background: 'none', cursor: 'pointer',
            }}
          >
            + Ny gruppe
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="px-5 py-4 flex flex-col gap-2"
          style={{ borderBottom: '1px solid #1E1E22' }}
        >
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Navn (f.eks. Juniorer)"
            maxLength={80}
            required
            className="px-2 py-2 text-sm"
            style={{
              backgroundColor: '#16161A', border: '1px solid #1E1E22',
              color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
            }}
          />
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Beskrivelse (valgfri)"
            maxLength={200}
            className="px-2 py-2 text-sm"
            style={{
              backgroundColor: '#16161A', border: '1px solid #1E1E22',
              color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
            }}
          />
          {error && (
            <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="px-3 py-1.5 text-xs tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: COACH_BLUE, color: '#F0F0F2',
                border: 'none', cursor: 'pointer',
              }}
            >
              {isPending ? 'Lagrer…' : 'Opprett'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null) }}
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
        </form>
      )}

      {groups.length === 0 ? (
        <p
          className="px-5 py-6 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}
        >
          Ingen grupper ennå.
        </p>
      ) : (
        <ul>
          {groups.map(g => (
            <li key={g.id} style={{ borderTop: '1px solid #1E1E22' }} className="first:border-t-0">
              <button
                type="button"
                onClick={() => setEditingGroupId(g.id)}
                className="w-full flex items-center justify-between px-5 py-3 transition-colors hover:bg-[#16161A]"
                style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
              >
                <span
                  className="text-sm"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.05em' }}
                >
                  {g.name}
                </span>
                <span
                  className="text-xs tracking-wide"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
                >
                  {g.memberCount} {g.memberCount === 1 ? 'medlem' : 'medlemmer'} · Rediger
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <EditGroupModal
        groupId={editingGroupId ?? ''}
        open={editingGroupId !== null}
        onClose={() => setEditingGroupId(null)}
      />
    </section>
  )
}
