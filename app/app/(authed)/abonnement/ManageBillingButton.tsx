'use client'

import { useTransition, useState } from 'react'
import { createBillingPortalSession } from '@/app/actions/billing-portal'

// Knapp som oppretter Stripe Billing Portal-session og redirecter dit.
// Bruker server-action; ingen klient-side Stripe-pakke trengs.

interface Props {
  label: string
  accent: string
}

export function ManageBillingButton({ label, accent }: Props) {
  const [busy, startBusy] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handle = () => {
    setError(null)
    startBusy(async () => {
      const res = await createBillingPortalSession()
      if (res.error || !res.url) {
        setError(res.error ?? 'Kunne ikke åpne kundeportalen')
        return
      }
      window.location.href = res.url
    })
  }

  return (
    <>
      <button type="button" onClick={handle} disabled={busy}
        className="inline-block px-4 py-3 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: accent, color: '#FFFFFF', border: 'none',
          cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
        }}>
        {busy ? 'Åpner kundeportalen…' : label}
      </button>
      {error && (
        <p className="mt-2 text-xs"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48',
          }}>
          {error}
        </p>
      )}
    </>
  )
}
