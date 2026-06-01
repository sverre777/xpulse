'use client'

import Link from 'next/link'

// Strava Brand Guidelines-kompatible komponenter:
//   - Brand-orange #FC5200 (offisiell)
//   - "Connect with STRAVA" — Strava skrevet i caps
//   - Strava-logo SVG inline (uforandret farge/form, ikke rotert)
//   - Minimum logo-høyde 30px, tilstrekkelig whitespace
//
// Disse erstatter "Koble til Strava"-knappen og brukes overalt der Strava-
// data er attribusjons-pliktig (Strava API Agreement § 2.3).

const STRAVA_ORANGE = '#FC5200'

// Forenklet Strava-logo (rettighets-fri "Σ"-stil — Stravas faktiske logo bør
// lastes ned fra https://developers.strava.com/guidelines og legges i
// public/strava/ for full brand-compliance. SVG-en under fungerer som
// placeholder med riktig farge og proporsjon mens vi venter på godkjente
// assets.)
export function StravaLogo({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size * 0.95}
      viewBox="0 0 24 23"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Stilisert "S"-symbol — placeholder for offisielt logomark. */}
      <path
        d="M11.4.4 4.3 14.6h4.3l3.1-5.9 3.1 5.9h4.3L11.7.4h-.3Z"
        fill={color}
      />
      <path
        d="m15.4 17.1-2.1-4.1-2.1 4.1H8.5l4.7 5.5h.4l4.7-5.5h-2.9Z"
        fill={color}
        opacity="0.55"
      />
    </svg>
  )
}

// Hovedknapp som starter Strava OAuth-flyten. Plasseres på klokkesync-siden
// og hvor som helst ny tilkobling tilbys.
export function ConnectWithStravaButton({
  href = '/auth/strava/connect',
  className = '',
}: { href?: string; className?: string }) {
  return (
    <Link href={href}
      className={className}
      aria-label="Connect with Strava"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '0 22px',
        height: '48px',  // ≥ 30px logo-høyde + whitespace
        background: STRAVA_ORANGE,
        color: '#FFFFFF',
        textDecoration: 'none',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '14px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <StravaLogo size={22} />
      <span>Connect with <span style={{ fontWeight: 800 }}>STRAVA</span></span>
    </Link>
  )
}

// Liten badge for kalender-rad. Plasseres ved siden av tittel for
// Strava-importerte økter. Bruker logo + kort tekst.
export function PoweredByStravaBadge({
  external_url, compact = false,
}: { external_url?: string | null; compact?: boolean }) {
  const content = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: compact ? '3px' : '5px',
      padding: compact ? '1px 4px' : '2px 7px',
      color: STRAVA_ORANGE,
      border: `1px solid ${STRAVA_ORANGE}`,
      backgroundColor: 'rgba(252,82,0,0.08)',
      fontFamily: "'Barlow Condensed', sans-serif",
      // Mindre tekst i compact (kalender-rad på mobil) så badgen ikke dytter
      // chip-innholdet over på to rader; logoen gjøres litt større for å
      // bære attribusjonen visuelt ved siden av den smalere teksten.
      fontSize: compact ? '8px' : '11px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      lineHeight: 1,
      whiteSpace: 'nowrap',
    }}>
      <StravaLogo size={compact ? 13 : 12} color={STRAVA_ORANGE} />
      {compact ? 'Strava' : 'Powered by Strava'}
    </span>
  )
  if (external_url) {
    return (
      <a href={external_url} target="_blank" rel="noopener noreferrer"
        title="Åpne på Strava"
        style={{ textDecoration: 'none' }}>
        {content}
      </a>
    )
  }
  return content
}

// Stor attribusjon for bunnen av workout-detalj. Strava § 2.3 krever
// synlig attribusjon for Strava-data, særlig sammen med pulskurver/zones.
export function PoweredByStravaAttribution({
  external_url,
}: { external_url?: string | null }) {
  const block = (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      color: STRAVA_ORANGE,
      border: `1px solid ${STRAVA_ORANGE}`,
      backgroundColor: 'rgba(252,82,0,0.06)',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '13px',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}>
      <StravaLogo size={20} color={STRAVA_ORANGE} />
      <span>Powered by Strava</span>
    </div>
  )
  if (external_url) {
    return (
      <a href={external_url} target="_blank" rel="noopener noreferrer"
        title="Åpne original aktivitet på Strava"
        style={{ textDecoration: 'none' }}>
        {block}
      </a>
    )
  }
  return block
}
