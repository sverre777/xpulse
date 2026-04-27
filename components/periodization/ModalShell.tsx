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
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#13131A',
          border: '1px solid #1E1E22',
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
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="text-xl"
            style={{ background: 'none', border: 'none', color: '#8A8A96', cursor: 'pointer', padding: 0, lineHeight: 1 }}
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
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
      {children}
    </label>
  )
}

export const INPUT_STYLE: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  backgroundColor: '#0A0A0B',
  border: '1px solid #1E1E22',
  color: '#F0F0F2',
  outline: 'none',
  padding: '8px 10px',
  fontSize: '14px',
  width: '100%',
  colorScheme: 'dark',
}

export function ErrorText({ message }: { message: string }) {
  return (
    <p className="text-xs mt-2" style={{ fontFamily: 'ui-monospace, monospace', color: '#E11D48' }}>
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
          className="px-3 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: 'transparent',
            border: '1px solid #E11D48',
            color: '#E11D48',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Slett
        </button>
      ) : <span />}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#1A1A22',
            border: '1px solid #1E1E22',
            color: '#F0F0F2',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Avbryt
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="px-3 py-2 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: disabled ? '#3A1A0F' : '#FF4500',
            border: `1px solid ${disabled ? '#3A1A0F' : '#FF4500'}`,
            color: '#FFFFFF',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Lagrer…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
