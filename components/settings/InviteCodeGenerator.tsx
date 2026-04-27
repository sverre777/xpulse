'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { generateInviteCode, type ActiveInviteCode } from '@/app/actions/coach-invite'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  initialCode: ActiveInviteCode | null
  hasActiveCoach: boolean
}

function formatExpiry(iso: string): string {
  const d = new Date(iso)
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft <= 0) return 'utløpt'
  if (daysLeft === 1) return 'utløper om 1 dag'
  return `utløper om ${daysLeft} dager`
}

export function InviteCodeGenerator({ initialCode, hasActiveCoach }: Props) {
  const router = useRouter()
  const [code, setCode] = useState<ActiveInviteCode | null>(initialCode)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onGenerate = () => {
    setError(null); setCopied(false)
    startTransition(async () => {
      const res = await generateInviteCode()
      if ('error' in res) { setError(res.error); return }
      setCode({
        id: '', // ikke returnert, ikke nødvendig for UI
        code: res.code,
        expiresAt: res.expiresAt,
        createdAt: new Date().toISOString(),
      })
      router.refresh()
    })
  }

  const onCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Kunne ikke kopiere automatisk — marker og kopier manuelt.')
    }
  }

  return (
    <section className="p-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-3"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Trener-kode
      </p>

      {code ? (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <code
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                backgroundColor: '#0A0A0B',
                color: ATHLETE_ORANGE,
                border: `1px solid ${ATHLETE_ORANGE}`,
                padding: '10px 16px',
                fontSize: '22px',
                letterSpacing: '0.18em',
                userSelect: 'all',
              }}
            >
              {code.code}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="px-3 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: 'transparent',
                color: '#F0F0F2',
                border: '1px solid #1E1E22',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Kopiert ✓' : 'Kopier'}
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={isPending}
              className="px-3 py-2 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: 'transparent',
                color: '#8A8A96',
                border: '1px solid #1E1E22',
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Genererer…' : 'Ny kode'}
            </button>
          </div>
          <p className="text-xs mt-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Del denne koden med treneren din. {formatExpiry(code.expiresAt)}.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs mb-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {hasActiveCoach
              ? 'Du har aktiv trener. Du kan generere en kode hvis du vil legge til en ny.'
              : 'Generer en kode og del den med treneren din for å koble dere sammen.'}
          </p>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isPending}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: ATHLETE_ORANGE, color: '#0A0A0B',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? 'Genererer…' : 'Generer trener-kode'}
          </button>
        </>
      )}

      {error && (
        <p className="text-xs mt-3"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}
    </section>
  )
}
