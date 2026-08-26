'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  requestAccountDeletion, cancelAccountDeletion, confirmAccountDeletion,
} from '@/app/actions/settings'

interface Props {
  deletionRequestedAt: string | null
}

export function DeleteAccountModal({ deletionRequestedAt }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (deletionRequestedAt) {
    const requested = new Date(deletionRequestedAt)
    const scheduled = new Date(requested.getTime() + 7 * 24 * 60 * 60 * 1000)
    return (
      <div className="p-4 mt-2"
        style={{ background: 'var(--kant-2)', border: '1px solid #D4A017' }}>
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
          Konto planlagt slettet {scheduled.toLocaleDateString('nb-NO')}.
          Inntil da kan du angre.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button type="button" disabled={pending}
            onClick={() => {
              setError(null)
              startTransition(async () => {
                const res = await cancelAccountDeletion()
                if (res.error) { setError(res.error); return }
                router.refresh()
              })
            }}
            className="text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              background: '#FF4500',
              border: '1px solid #FF4500',
              color: 'var(--flate-3)',
              padding: '8px 18px',
              cursor: pending ? 'default' : 'pointer',
              minHeight: '40px',
            }}>
            {pending ? 'Avbryter …' : 'Angre sletting'}
          </button>
          <button type="button" disabled={pending}
            onClick={() => {
              if (!confirm('Slett kontoen din nå? Dette kan ikke angres.')) return
              setError(null)
              startTransition(async () => {
                const res = await confirmAccountDeletion()
                if (res.error) { setError(res.error); return }
                window.location.href = '/'
              })
            }}
            className="text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              background: 'none',
              border: '1px solid #E11D48',
              color: '#E11D48',
              padding: '8px 18px',
              cursor: pending ? 'default' : 'pointer',
              minHeight: '40px',
            }}>
            Slett nå
          </button>
        </div>
        {error && (
          <p className="text-xs mt-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  if (!showConfirm) {
    return (
      <button type="button"
        onClick={() => setShowConfirm(true)}
        className="text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          background: 'none',
          border: '1px solid #E11D48',
          color: '#E11D48',
          padding: '8px 18px',
          cursor: 'pointer',
          minHeight: '40px',
          alignSelf: 'flex-start',
        }}>
        Slett konto
      </button>
    )
  }

  return (
    <div className="p-4 mt-2"
      style={{ background: 'var(--kant-2)', border: '1px solid #E11D48' }}>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '15px' }}>
        Bekreft sletting
      </p>
      <p className="text-xs mt-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        Kontoen din vil slettes om 7 dager. I løpet av angrefristen kan du
        logge inn og avbryte sletting. Skriv <span style={{ color: '#E11D48' }}>SLETT</span> for å bekrefte.
      </p>
      <input type="text" value={confirmText}
        onChange={e => setConfirmText(e.target.value)}
        placeholder="SLETT"
        style={{
          marginTop: '8px',
          width: '100%',
          background: 'var(--flate-7)',
          border: '1px solid var(--kant-5)',
          color: 'var(--tekst-1-app)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '16px',
          padding: '8px 12px',
          minHeight: '40px',
        }} />
      <div className="flex gap-2 mt-3 flex-wrap">
        <button type="button"
          onClick={() => { setShowConfirm(false); setConfirmText(''); setError(null); setInfo(null) }}
          disabled={pending}
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            background: 'none',
            border: '1px solid var(--kant-5)',
            color: 'var(--tekst-5-app)',
            padding: '8px 18px',
            cursor: pending ? 'default' : 'pointer',
            minHeight: '40px',
          }}>
          Avbryt
        </button>
        <button type="button"
          disabled={confirmText !== 'SLETT' || pending}
          onClick={() => {
            setError(null); setInfo(null)
            startTransition(async () => {
              const res = await requestAccountDeletion()
              if (res.error) { setError(res.error); return }
              setInfo(`Planlagt slettet ${res.scheduledFor ? new Date(res.scheduledFor).toLocaleDateString('nb-NO') : '+7 dager'}`)
              router.refresh()
            })
          }}
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            background: confirmText === 'SLETT' ? '#E11D48' : 'none',
            border: '1px solid ' + (confirmText === 'SLETT' ? '#E11D48' : 'var(--kant-5)'),
            color: confirmText === 'SLETT' ? 'var(--tekst-1-app)' : 'var(--tekst-8-app)',
            padding: '8px 18px',
            cursor: confirmText === 'SLETT' && !pending ? 'pointer' : 'default',
            minHeight: '40px',
          }}>
          {pending ? 'Sletter …' : 'Bekreft'}
        </button>
      </div>
      {error && (
        <p className="text-xs mt-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}
      {info && !error && (
        <p className="text-xs mt-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
          {info}
        </p>
      )}
    </div>
  )
}
