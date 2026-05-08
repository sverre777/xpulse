'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createUserExerciseManual, updateUserExercise, deleteUserExercise,
  type UserExercise,
} from '@/app/actions/user-exercises'

interface Props {
  initial: UserExercise[]
}

export function StrengthExerciseLibrarySection({ initial }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<UserExercise[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const handleCreated = (u: UserExercise) => {
    setItems(prev => [...prev, u].sort(sortItems))
    setCreating(false)
    setMsg({ kind: 'ok', text: 'Øvelse opprettet.' })
    router.refresh()
  }
  const handleUpdated = (u: UserExercise) => {
    setItems(prev => prev.map(x => x.id === u.id ? u : x).sort(sortItems))
    setEditingId(null)
    setMsg({ kind: 'ok', text: 'Endringer lagret.' })
    router.refresh()
  }
  const handleDeleted = (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id))
    setEditingId(null)
    setMsg({ kind: 'ok', text: 'Øvelse slettet.' })
    router.refresh()
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter(it =>
      it.name.toLowerCase().includes(q) ||
      (it.category ?? '').toLowerCase().includes(q),
    )
  }, [items, filter])

  return (
    <div className="p-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Mitt øvelses-bibliotek
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

      <p className="mb-4 text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Bygg ditt eget styrkeøvelse-bibliotek. Øvelser dukker også opp automatisk i biblioteket
        når du lagrer en styrke-økt — her kan du legge til, redigere eller slette før første bruk.
        Default reps/vekt forhåndsutfyller første sett når du velger øvelsen i økt-skjemaet.
      </p>

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
        <ExerciseForm
          onCancel={() => setCreating(false)}
          onSaved={handleCreated}
        />
      )}

      {items.length > 5 && !creating && (
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Søk i biblioteket…"
          style={iSt}
          className="mb-3"
        />
      )}

      <div className="space-y-2 mt-2">
        {items.length === 0 && !creating && (
          <p className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Du har ingen øvelser i biblioteket ennå. Trykk &quot;+ Ny&quot; for å starte, eller registrer en styrke-økt så bygges biblioteket automatisk.
          </p>
        )}

        {visible.map(item => (
          editingId === item.id ? (
            <ExerciseForm key={item.id}
              initial={item}
              onCancel={() => setEditingId(null)}
              onSaved={handleUpdated}
              onDeleted={handleDeleted}
            />
          ) : (
            <ExerciseRow key={item.id}
              item={item}
              onEdit={() => { setEditingId(item.id); setCreating(false) }}
            />
          )
        ))}

        {items.length > 0 && visible.length === 0 && (
          <p className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Ingen treff på «{filter}».
          </p>
        )}
      </div>
    </div>
  )
}

function sortItems(a: UserExercise, b: UserExercise): number {
  // Sist brukt øverst, deretter aldri-brukte alfabetisk.
  if (a.last_used_at && b.last_used_at) {
    return b.last_used_at.localeCompare(a.last_used_at)
  }
  if (a.last_used_at) return -1
  if (b.last_used_at) return 1
  return a.name.localeCompare(b.name, 'no')
}

function ExerciseRow({
  item, onEdit,
}: {
  item: UserExercise
  onEdit: () => void
}) {
  const detailParts: string[] = []
  if (item.default_reps != null) detailParts.push(`${item.default_reps} reps`)
  if (item.default_weight_kg != null) detailParts.push(`${item.default_weight_kg} kg`)
  if (item.times_used > 0) detailParts.push(`brukt ${item.times_used}×`)

  return (
    <div className="flex items-center gap-3 px-3 py-2"
      style={{ backgroundColor: '#1A1A1E', border: '1px solid #262629' }}>
      <div style={{ flex: 1 }}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '15px', fontWeight: 600 }}>
            {item.name}
          </span>
          {item.category && (
            <span className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {item.category}
            </span>
          )}
        </div>
        {detailParts.length > 0 && (
          <div className="mt-0.5 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            {detailParts.join(' · ')}
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

function ExerciseForm({
  initial, onCancel, onSaved, onDeleted,
}: {
  initial?: UserExercise
  onCancel: () => void
  onSaved: (u: UserExercise) => void
  onDeleted?: (id: string) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [defaultReps, setDefaultReps] = useState(initial?.default_reps?.toString() ?? '')
  const [defaultWeight, setDefaultWeight] = useState(initial?.default_weight_kg?.toString() ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isEdit = !!initial

  const parseReps = () => {
    const v = parseInt(defaultReps)
    return Number.isFinite(v) && v > 0 ? v : null
  }
  const parseWeight = () => {
    const v = parseFloat(defaultWeight)
    return Number.isFinite(v) && v >= 0 ? v : null
  }

  const handleSave = () => {
    if (!name.trim()) return
    setError(null)
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        category: category.trim() || null,
        notes: notes.trim() || null,
        defaultReps: parseReps(),
        defaultWeightKg: parseWeight(),
      }
      const res = isEdit
        ? await updateUserExercise({ id: initial!.id, ...payload })
        : await createUserExerciseManual(payload)
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.exercise) onSaved(res.exercise)
    })
  }

  const handleConfirmDelete = () => {
    if (!initial || !onDeleted) return
    startTransition(async () => {
      const res = await deleteUserExercise(initial.id)
      if (res.error) {
        setError(res.error)
        setConfirmDelete(false)
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
            placeholder="F.eks. Knebøy, Markløft, Planke"
            autoFocus={!isEdit}
            style={iSt} />
        </div>

        <div>
          <Label>Kategori (valgfritt)</Label>
          <input value={category} onChange={e => setCategory(e.target.value)}
            placeholder="F.eks. Helkropp, Bein, Overkropp, Core"
            style={iSt} />
        </div>

        <div>
          <Label>Default reps (valgfritt)</Label>
          <input value={defaultReps} onChange={e => setDefaultReps(e.target.value)}
            inputMode="numeric"
            placeholder="—"
            style={iSt} />
        </div>

        <div>
          <Label>Default vekt (kg) (valgfritt)</Label>
          <input value={defaultWeight} onChange={e => setDefaultWeight(e.target.value)}
            inputMode="decimal"
            placeholder="—"
            style={iSt} />
        </div>

        <div className="md:col-span-2">
          <Label>Notat (valgfritt)</Label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="Teknikk-tips, varianter, etc."
            style={{ ...iSt, resize: 'vertical' }} />
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
          {error}
        </p>
      )}

      {confirmDelete && initial && (
        <div className="mt-3 p-3"
          style={{ backgroundColor: '#0A0A0B', border: '1px solid #FF4500' }}>
          <p className="text-sm mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
            {initial.times_used > 0
              ? `Denne øvelsen er brukt i ${initial.times_used} økt${initial.times_used === 1 ? '' : 'er'}. Historikk beholdes som tekst — men du må legge til navnet på nytt for å se det i autocomplete etter sletting.`
              : 'Er du sikker på at du vil slette denne øvelsen?'}
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
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={pending}
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
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={pending}
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
