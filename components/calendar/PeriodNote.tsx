'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { savePeriodNote, type NoteScope, type NoteContext } from '@/app/actions/period-notes'

export function PeriodNote({
  scope, periodKey, context, initialNote, label,
}: {
  scope: NoteScope
  periodKey: string
  context: NoteContext
  initialNote: string
  label: string
}) {
  // NB: komponenten remountes av parent via `key` når scope/periode/kontekst
  // endres, så initialNote kan brukes trygt som startverdi i useState.
  const [note, setNote] = useState(initialNote)
  const [open, setOpen] = useState(initialNote.trim().length > 0)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const lastSavedRef = useRef(initialNote)
  const timerRef = useRef<number | null>(null)

  const flush = (value: string) => {
    if (value === lastSavedRef.current) return
    setSaved('saving')
    setErrorMsg(null)
    startTransition(async () => {
      try {
        const res = await savePeriodNote({ scope, period_key: periodKey, context, note: value })
        if (res.error) { setSaved('error'); setErrorMsg(res.error); return }
        lastSavedRef.current = value
        setSaved('ok')
        window.setTimeout(() => setSaved(s => (s === 'ok' ? 'idle' : s)), 1200)
      } catch (e) {
        setSaved('error')
        setErrorMsg(e instanceof Error ? e.message : String(e))
      }
    })
  }

  // Debounce — skriv til DB 600ms etter siste tastetrykk.
  useEffect(() => {
    if (note === lastSavedRef.current) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => flush(note), 600)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note])

  if (!open) {
    return (
      <div className="px-4 md:px-6 py-2" style={{ borderBottom: '1px solid #1A1A1E', backgroundColor: '#0E0E10' }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          + {label}
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-2" style={{ borderBottom: '1px solid #1A1A1E', backgroundColor: '#0E0E10' }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {label}
        </p>
        <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {isPending || saved === 'saving' ? '…lagrer' : saved === 'ok' ? '✓ lagret' : saved === 'error' ? '✕ feil' : ''}
        </span>
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => flush(note)}
        rows={2}
        placeholder="Skriv en kommentar…"
        className="w-full px-2 py-1.5 text-sm resize-none"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: '#0A0A0B',
          border: '1px solid #1E1E22',
          color: '#F0F0F2',
          outline: 'none',
        }}
      />
      {errorMsg && (
        <p className="text-xs mt-1"
          style={{ fontFamily: 'ui-monospace, monospace', color: '#E11D48' }}>
          {errorMsg}
        </p>
      )}
    </div>
  )
}
