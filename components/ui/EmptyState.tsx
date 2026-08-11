import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

// Gjenbrukbar tom-tilstand: kort forklaring på hva som mangler + tydelig CTA
// som løser det. Skal KUN vises når den relevante datamengden faktisk er 0 —
// lasting dekkes av skeletons, feil av LoadError. Server-safe; ctaOnClick
// krever klient-kontekst (send enten ctaHref eller ctaOnClick, ikke begge).

interface EmptyStateProps {
  title: string
  body?: ReactNode
  accent?: string
  compact?: boolean
  ctaLabel?: string
  ctaHref?: string
  ctaOnClick?: () => void
  secondaryLabel?: string
  secondaryHref?: string
}

export function EmptyState({
  title, body, accent = '#FF4500', compact = false,
  ctaLabel, ctaHref, ctaOnClick, secondaryLabel, secondaryHref,
}: EmptyStateProps) {
  const ctaStyle: CSSProperties = {
    display: 'inline-block',
    backgroundColor: accent, color: '#F0F0F2',
    padding: '10px 20px',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 600, fontSize: 13,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    textDecoration: 'none', border: 'none', cursor: 'pointer',
  }
  const secondaryStyle: CSSProperties = {
    ...ctaStyle,
    backgroundColor: 'transparent',
    border: '1px solid #333340',
  }
  return (
    <div
      className="text-center"
      style={{
        padding: compact ? '20px 16px' : '40px 20px',
        backgroundColor: '#13131A',
        border: '1px dashed #333340',
      }}
    >
      <p style={{
        fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
        fontSize: compact ? 17 : 21, letterSpacing: '0.06em', margin: 0,
      }}>
        {title}
      </p>
      {body ? (
        <p className="mx-auto mt-2" style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
          fontSize: 14, lineHeight: 1.65, maxWidth: 460, marginBottom: 0,
        }}>
          {body}
        </p>
      ) : null}
      {(ctaLabel || (secondaryLabel && secondaryHref)) ? (
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          {ctaLabel ? (
            ctaHref ? (
              <Link href={ctaHref} style={ctaStyle}>{ctaLabel}</Link>
            ) : (
              <button type="button" onClick={ctaOnClick} style={ctaStyle}>{ctaLabel}</button>
            )
          ) : null}
          {secondaryLabel && secondaryHref ? (
            <Link href={secondaryHref} style={secondaryStyle}>{secondaryLabel}</Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
