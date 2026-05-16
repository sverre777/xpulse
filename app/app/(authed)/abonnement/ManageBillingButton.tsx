'use client'

// Enkel <a>-link til /api/stripe/portal — server-routen oppretter Stripe
// Billing Portal-sesjon og 302-redirecter til Stripe. Hvis Portal ikke er
// konfigurert i Dashboard, fanger routen feilen og redirecter tilbake til
// /app/abonnement?error=... så brukeren får tydelig tekst i stedet for
// "page not found".

interface Props {
  label: string
  accent: string
}

export function ManageBillingButton({ label, accent }: Props) {
  return (
    <a href="/api/stripe/portal"
      className="inline-block px-4 py-3 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: accent, color: '#FFFFFF',
        textDecoration: 'none',
      }}>
      {label}
    </a>
  )
}
