'use client'

import { useFavorites } from './FavoritesContext'

// Stjerne-knapp som plasseres øverst til høyre i hver graf. Fylt #FF4500 når
// aktiv, dempet omriss når inaktiv. Klikk toggler via FavoritesContext.

interface StarButtonProps {
  chartKey: string
  size?: number
  className?: string
  title?: string
  /** Grafens gjeldende oppsett — lagres med favoritten (fase 122). */
  config?: Record<string, unknown> | null
}

export function StarButton({ chartKey, size = 20, className, title, config }: StarButtonProps) {
  const { favorites, toggle, readOnly } = useFavorites()
  const active = favorites.has(chartKey)
  // Trenervisning: utøverens favoritter er lesing — vis bare den fylte
  // stjerna der utøveren har stjernet, ingen knapp ellers.
  if (readOnly && !active) return null

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (readOnly) return
    void toggle(chartKey, config ?? null)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={readOnly ? 'Utøverens favoritt' : active ? 'Fjern fra favoritter' : 'Legg til i favoritter'}
      title={title ?? (readOnly ? 'Utøverens favoritt' : active ? 'Fjern fra favoritter' : 'Legg til i favoritter')}
      disabled={readOnly}
      className={className}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 4,
        cursor: readOnly ? 'default' : 'pointer',
        lineHeight: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={active ? '#FF4500' : 'none'}
        stroke={active ? '#FF4500' : 'var(--tekst-8-app)'}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <polygon points="12 2.5 15 9.3 22.2 10.1 16.8 15 18.4 22 12 18.3 5.6 22 7.2 15 1.8 10.1 9 9.3 12 2.5" />
      </svg>
    </button>
  )
}
