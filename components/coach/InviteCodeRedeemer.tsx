'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { redeemInviteCode } from '@/app/actions/coach-invite'

const COACH_BLUE = '#1A6FD4'

export function InviteCodeRedeemer() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    setCode('')
    setFeedback(null)
  }

  const submit = () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) { setFeedback({ kind: 'err', message: 'Lim inn en kode' }); return }
    startTransition(async () => {
      const res = await redeemInviteCode(trimmed)
      if ('error' in res) {
        setFeedback({ kind: 'err', message: res.error })
        return
      }
      const name = res.athleteName ?? 'utøveren'
      const msg = res.alreadyConnected
        ? `Du er allerede koblet til ${name}.`
        : `Invitasjon godtatt — du er nå koblet til ${name}.`
      setFeedback({ kind: 'ok', message: msg })
      setCode('')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: COACH_BLUE, color: '#F0F0F2',
          border: 'none', cursor: 'pointer',
        }}
      >
        + Legg til utøver
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '60px 16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '460px',
              backgroundColor: '#13131A', border: '1px solid #1E1E22',
            }}
          >
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid #1E1E22' }}
            >
              <div
                className="text-lg"
                style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}
              >
                Legg til utøver
              </div>
              <button
                type="button"
                onClick={close}
                className="text-xs tracking-widest uppercase px-2 py-1"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: '#8A8A96', background: 'transparent', border: '1px solid #1E1E22',
                  cursor: 'pointer',
                }}
              >
                Lukk
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <p className="text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Lim inn trener-koden fra utøveren for å opprette kobling.
              </p>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                placeholder="XP-XXXXXXXX"
                spellCheck={false}
                autoComplete="off"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  backgroundColor: '#1A1A22',
                  color: '#F0F0F2',
                  border: '1px solid #1E1E22',
                  padding: '10px 12px',
                  fontSize: '20px',
                  letterSpacing: '0.18em',
                  outline: 'none',
                }}
              />
              {feedback && (
                <p
                  className="text-xs px-3 py-2"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: feedback.kind === 'ok' ? '#28A86E' : '#E11D48',
                    border: `1px solid ${feedback.kind === 'ok' ? '#28A86E' : '#E11D48'}`,
                  }}
                >
                  {feedback.message}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={submit}
                  disabled={isPending || !code.trim()}
                  className="px-4 py-2 text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    backgroundColor: COACH_BLUE, color: '#F0F0F2',
                    border: 'none',
                    cursor: isPending || !code.trim() ? 'not-allowed' : 'pointer',
                    opacity: isPending || !code.trim() ? 0.5 : 1,
                  }}
                >
                  {isPending ? 'Kobler…' : 'Koble til'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
