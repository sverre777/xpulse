'use client'

import { useEffect } from 'react'

export function ModalShell({
  open, onClose, title, children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'var(--scrim-70)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span style={{ width: '20px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '22px', letterSpacing: '0.08em' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="text-xl"
            style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs tracking-widest uppercase mb-1"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
      {children}
    </label>
  )
}

export const INPUT_STYLE: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  backgroundColor: 'var(--card2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-field)',
  color: 'var(--ink)',
  outline: 'none',
  padding: '10px 12px',
  fontSize: '15px',
  width: '100%',
}

/** Serverens avslag skal STÅ i modalen, ved knappen - ikke forsvinne
    (Sverre 15. sep). Boks med kant, ikke en liten grå linje. */
export function ErrorText({ message }: { message: string }) {
  return (
    <p role="alert" data-modal-feil className="mt-3"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5, lineHeight: 1.4,
        color: '#E11D48', background: 'rgba(225,29,72,.10)', border: '1px solid rgba(225,29,72,.55)',
        borderRadius: 10, padding: '10px 12px',
      }}>
      {message}
    </p>
  )
}

export function ModalFooter({
  submitLabel, disabled, onCancel, busy, onDelete,
}: {
  submitLabel: string
  disabled: boolean
  onCancel: () => void
  busy?: boolean
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-6">
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="xp-pill xp-pill-sm"
          style={{ background: 'none', border: '1px solid #E11D48', color: '#E11D48' }}
        >
          Slett
        </button>
      ) : <span />}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="xp-pill xp-pill-ghost xp-pill-sm"
        >
          Avbryt
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="xp-pill xp-pill-primary xp-pill-sm"
        >
          {busy ? 'Lagrer…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
