'use client'

import { useState, useTransition } from 'react'
import { joinWaitlist, type WaitlistResult } from '@/app/actions/waitlist'
import { ArrowRightIcon } from '@/components/branding/nav-icons'

// E-post-skjema for waitlist (klokkesync, AI-tier). Optimistisk UI: viser
// "Sender …" mens server-action kjører, og tydelig kvittering eller feil
// ved svar. Ingen state-store-bibliotek nødvendig.

const REASON_TEXT: Record<Exclude<WaitlistResult, { ok: true }>['reason'], string> = {
  invalid_email: 'Sjekk at e-postadressen er riktig.',
  already_signed_up: 'Du er allerede på listen — vi sender beskjed når det er klart.',
  unknown: 'Noe gikk galt. Prøv igjen om en stund.',
}

export interface WaitlistSignupProps {
  feature: 'klokkesync' | 'athlete_pro_ai' | 'trener_pro_ai'
  // Valgfri ledende tekst over skjemaet.
  intro?: string
  // Tekst over input-feltet.
  label?: string
  // Knappe-tekst.
  cta?: string
}

export function WaitlistSignup({
  feature, intro, label = 'E-postadresse', cta = 'Bli varslet',
}: WaitlistSignupProps) {
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<WaitlistResult | null>(null)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    startTransition(async () => {
      const res = await joinWaitlist(email, feature)
      setResult(res)
      if (res.ok) setEmail('')
    })
  }

  const success = result?.ok === true
  const errorText = result && !result.ok ? REASON_TEXT[result.reason] : null

  return (
    <div id="waitlist" style={{
      background: '#13131A', border: '1px solid #262629',
      padding: 32, maxWidth: 560,
    }}>
      {intro && (
        <p style={{
          fontSize: 14, lineHeight: 1.7, color: 'rgba(242,240,236,0.65)',
          marginBottom: 20,
        }}>
          {intro}
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
        <label className="flex-1">
          <span className="sr-only">{label}</span>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={label}
            disabled={pending || success}
            style={{
              width: '100%',
              background: '#1A1A1E', border: '1px solid #262629',
              padding: '14px 16px', color: '#F2F0EC', outline: 'none',
              fontFamily: "'Barlow', sans-serif", fontSize: 14,
              opacity: success ? 0.6 : 1,
            }}
          />
        </label>
        <button type="submit" disabled={pending || success}
          className="inline-flex items-center justify-center gap-2"
          style={{
            background: success ? '#155DB8' : '#FF4500',
            color: '#F2F0EC', padding: '14px 22px', border: 'none',
            cursor: pending || success ? 'default' : 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
          {success ? '✓ Du er på listen' : pending ? 'Sender …' : (
            <>
              {cta}
              <ArrowRightIcon size={14} />
            </>
          )}
        </button>
      </form>
      {errorText && (
        <p role="alert" style={{
          marginTop: 14, fontSize: 13,
          color: result && 'reason' in result && result.reason === 'already_signed_up'
            ? 'rgba(245,197,66,0.85)' : 'rgba(225,29,72,0.85)',
        }}>
          {errorText}
        </p>
      )}
    </div>
  )
}
