'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createUserMovementType, updateUserMovementType, deleteUserMovementType,
  countUsageForMovementName,
  type UserMovementType, type UserMovementTypeKind,
} from '@/app/actions/user-movement-types'

const KIND_LABELS: Record<UserMovementTypeKind, string> = {
  utholdenhet: 'Utholdenhet',
  styrke: 'Styrke-spenst',
  tur: 'Tur',
  annet: 'Annet',
}

const KIND_OPTIONS: UserMovementTypeKind[] = ['utholdenhet', 'styrke', 'tur', 'annet']

interface Props {
  initial: UserMovementType[]
}

export function MovementTypesSection({ initial }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<UserMovementType[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const handleCreated = (u: UserMovementType) => {
    setItems(prev => [...prev, u].sort((a, b) => a.name.localeCompare(b.name)))
    setCreating(false)
    setMsg({ kind: 'ok', text: 'Bevegelsesform opprettet.' })
    router.refresh()
  }
  const handleUpdated = (u: UserMovementType) => {
    setItems(prev => prev.map(x => x.id === u.id ? u : x).sort((a, b) => a.name.localeCompare(b.name)))
    setEditingId(null)
    setMsg({ kind: 'ok', text: 'Endringer lagret.' })
    router.refresh()
  }
  const handleDeleted = (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id))
    setMsg({ kind: 'ok', text: 'Bevegelsesform slettet.' })
    router.refresh()
  }

  return (
    <div className="p-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Mine bevegelsesformer
        </p>
        {!creating && (
          <button type="button" onClick={() => { setCreating(true); setEditingId(null) }}
            className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
              background: 'none', border: '1px solid #FF4500',
              padding: '6px 12px', cursor: 'pointer',
            }}>
            + Ny
          </button>
        )}
      </div>

      {msg && (
        <p className="mb-3 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: msg.kind === 'ok' ? '#28A86E' : '#FF4500',
          }}>
          {msg.text}
        </p>
      )}

      {creating && (
        <MovementTypeForm
          onCancel={() => setCreating(false)}
          onSaved={handleCreated}
        />
      )}

      <div className="space-y-2 mt-2">
        {items.length === 0 && !creating && (
          <p className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Du har ingen egne bevegelsesformer ennå.
          </p>
        )}

        {items.map(item => (
          editingId === item.id ? (
            <MovementTypeForm key={item.id}
              initial={item}
              onCancel={() => setEditingId(null)}
              onSaved={handleUpdated}
              onDeleted={handleDeleted}
            />
          ) : (
            <MovementTypeRow key={item.id}
              item={item}
              onEdit={() => { setEditingId(item.id); setCreating(false) }}
            />
          )
        ))}
      </div>
    </div>
  )
}

function MovementTypeRow({
  item, onEdit,
}: {
  item: UserMovementType
  onEdit: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2"
      style={{ backgroundColor: '#1A1A1E', border: '1px solid #262629' }}>
      <div style={{ flex: 1 }}>
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px', fontWeight: 600 }}>
            {item.name}
          </span>
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {KIND_LABELS[item.type]}
          </span>
        </div>
        {item.subcategories.length > 0 && (
          <div className="mt-0.5 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {item.subcategories.join(' · ')}
          </div>
        )}
        {item.notes && (
          <div className="mt-0.5 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {item.notes}
          </div>
        )}
      </div>
      <button type="button" onClick={onEdit}
        className="text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC',
          background: 'none', border: '1px solid #262629',
          padding: '4px 10px', cursor: 'pointer',
        }}>
        Rediger
      </button>
    </div>
  )
}

function MovementTypeForm({
  initial, onCancel, onSaved, onDeleted,
}: {
  initial?: UserMovementType
  onCancel: () => void
  onSaved: (u: UserMovementType) => void
  onDeleted?: (id: string) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<UserMovementTypeKind>(initial?.type ?? 'utholdenhet')
  const [subcatsText, setSubcatsText] = useState(initial?.subcategories.join(', ') ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ usage: number } | null>(null)

  const isEdit = !!initial

  const handleSave = () => {
    if (!name.trim()) return
    setError(null)
    const subcategories = subcatsText.split(',').map(s => s.trim()).filter(s => s !== '')
    startTransition(async () => {
      const res = isEdit
        ? await updateUserMovementType(initial!.id, { name, type, subcategories, notes: notes || null })
        : await createUserMovementType({ name, type, subcategories, notes })
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.data) onSaved(res.data)
    })
  }

  const handleDeleteClick = () => {
    if (!initial || !onDeleted) return
    startTransition(async () => {
      const usage = await countUsageForMovementName(initial.name)
      setConfirmDelete({ usage })
    })
  }

  const handleConfirmDelete = () => {
    if (!initial || !onDeleted) return
    startTransition(async () => {
      const res = await deleteUserMovementType(initial.id)
      if (res.error) {
        setError(res.error)
        setConfirmDelete(null)
        return
      }
      onDeleted(initial.id)
    })
  }

  return (
    <div className="p-3 mt-2"
      style={{ backgroundColor: '#1A1A1E', border: '1px solid #FF4500' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Navn *</Label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="F.eks. Innebandy, Kiting"
            autoFocus={!isEdit}
            style={iSt} />
        </div>

        <div>
          <Label>Type *</Label>
          <div className="flex flex-wrap gap-1.5">
            {KIND_OPTIONS.map(k => {
              const active = type === k
              return (
                <button key={k} type="button" onClick={() => setType(k)}
                  className="text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: active ? '#FF4500' : '#C0C0CC',
                    background: active ? '#1A1A22' : 'none',
                    border: '1px solid ' + (active ? '#FF4500' : '#262629'),
                    padding: '6px 10px', cursor: 'pointer',
                  }}>
                  {KIND_LABELS[k]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="md:col-span-2">
          <Label>Underkategorier (valgfritt — kommaseparert)</Label>
          <input value={subcatsText} onChange={e => setSubcatsText(e.target.value)}
            placeholder="F.eks. Teknisk, Taktisk, Styrke"
            style={iSt} />
        </div>

        <div className="md:col-span-2">
          <Label>Notat (valgfritt)</Label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="Kort beskrivelse..."
            style={{ ...iSt, resize: 'vertical' }} />
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
          {error}
        </p>
      )}

      {confirmDelete && (
        <div className="mt-3 p-3"
          style={{ backgroundColor: '#0A0A0B', border: '1px solid #FF4500' }}>
          <p className="text-sm mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {confirmDelete.usage > 0
              ? `Denne bevegelsesformen er brukt i ${confirmDelete.usage} aktivitet${confirmDelete.usage === 1 ? '' : 'er'}. Historikk beholdes som tekst — men du kan ikke velge formen på nye økter etter sletting.`
              : 'Er du sikker på at du vil slette denne bevegelsesformen?'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={handleConfirmDelete} disabled={pending}
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
                background: 'none', border: '1px solid #FF4500',
                padding: '6px 12px', cursor: pending ? 'not-allowed' : 'pointer',
              }}>
              {pending ? 'Sletter…' : 'Slett permanent'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(null)} disabled={pending}
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
                background: 'none', border: '1px solid #262629',
                padding: '6px 12px', cursor: pending ? 'not-allowed' : 'pointer',
              }}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div>
          {isEdit && !confirmDelete && (
            <button type="button" onClick={handleDeleteClick} disabled={pending}
              className="text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
                background: 'none', border: 'none', padding: '6px 0',
                cursor: pending ? 'not-allowed' : 'pointer',
              }}>
              Slett
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={pending}
            className="text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #262629',
              padding: '6px 12px', cursor: pending ? 'not-allowed' : 'pointer',
            }}>
            Avbryt
          </button>
          <button type="button" onClick={handleSave}
            disabled={pending || !name.trim()}
            className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500',
              background: 'none', border: '1px solid #FF4500',
              padding: '6px 12px',
              cursor: (pending || !name.trim()) ? 'not-allowed' : 'pointer',
              opacity: (pending || !name.trim()) ? 0.5 : 1,
            }}>
            {pending ? 'Lagrer…' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1 text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {children}
    </label>
  )
}

const iSt: React.CSSProperties = {
  backgroundColor: '#1A1A22',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
}
