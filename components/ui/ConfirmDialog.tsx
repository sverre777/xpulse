'use client'

import { useEffect, useState } from 'react'

// Erstatning for window.confirm/alert i appens designspråk. Imperativt API
// (xpConfirm/xpAlert) slik at kallsteder kan byttes 1:1 uten lokal state —
// promisen løses når brukeren svarer. DialogHost monteres én gang i
// rot-layouten. window.confirm beholdes bevisst i DeleteAccountModal
// (ekstra friksjon er ønsket der).

interface DialogRequest {
  kind: 'confirm' | 'alert'
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  resolve: (ok: boolean) => void
}

let pushRequest: ((r: DialogRequest) => void) | null = null
const preMountQueue: DialogRequest[] = []

function enqueue(req: DialogRequest) {
  if (pushRequest) pushRequest(req)
  else preMountQueue.push(req)
}

export function xpConfirm(
  opts: string | { title: string; body?: string; confirmLabel?: string; cancelLabel?: string },
): Promise<boolean> {
  const o = typeof opts === 'string' ? { title: opts } : opts
  return new Promise(resolve => enqueue({ kind: 'confirm', ...o, resolve }))
}

export function xpAlert(title: string, body?: string): Promise<void> {
  return new Promise(resolve => enqueue({ kind: 'alert', title, body, resolve: () => resolve(true as unknown as void) }))
}

export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([])
  const current = queue[0] ?? null

  useEffect(() => {
    pushRequest = r => setQueue(q => [...q, r])
    if (preMountQueue.length) {
      const drained = preMountQueue.splice(0)
      setQueue(q => [...q, ...drained])
    }
    return () => { pushRequest = null }
  }, [])

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  const answer = (ok: boolean) => {
    current?.resolve(ok)
    setQueue(q => q.slice(1))
  }

  if (!current) return null

  return (
    <div
      role={current.kind === 'confirm' ? 'alertdialog' : 'alert'}
      aria-modal="true"
      onClick={() => answer(false)}
      className="xp-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'var(--scrim-72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full"
        style={{
          maxWidth: 420, backgroundColor: 'var(--card)',
          border: '1px solid var(--line2)', borderTop: '2px solid #E11D48',
          borderRadius: 'var(--r-card)',
          padding: '22px 24px',
        }}
      >
        <p
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
            color: 'var(--tekst-1-app)', fontSize: 16, lineHeight: 1.5, margin: 0,
          }}
        >
          {current.title}
        </p>
        {current.body ? (
          <p
            className="mt-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
              fontSize: 14, lineHeight: 1.6, margin: 0,
            }}
          >
            {current.body}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 mt-5">
          {current.kind === 'confirm' && (
            <button
              type="button"
              onClick={() => answer(false)}
              autoFocus
              className="px-4 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                backgroundColor: 'transparent', color: 'var(--tekst-1-app)',
                border: '1px solid var(--kant-hover)', cursor: 'pointer',
                borderRadius: 'var(--r-field)',
              }}
            >
              {current.cancelLabel ?? 'Avbryt'}
            </button>
          )}
          <button
            type="button"
            onClick={() => answer(true)}
            autoFocus={current.kind === 'alert'}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              backgroundColor: current.kind === 'confirm' ? '#E11D48' : 'var(--kant-hover)',
              color: 'var(--tekst-1-app)', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--r-field)',
            }}
          >
            {current.confirmLabel ?? (current.kind === 'confirm' ? 'Bekreft' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}
