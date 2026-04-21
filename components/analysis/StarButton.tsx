'use client'

import { useFavorites } from './FavoritesContext'

// Stjerne-knapp som plasseres øverst til høyre i hver graf. Fylt #FF4500 når
// aktiv, dempet omriss når inaktiv. Klikk toggler via FavoritesContext.

interface StarButtonProps {
  chartKey: string
  size?: number
  className?: string
  title?: string
}

export function StarButton({ chartKey, size = 20, className, title }: StarButtonProps) {
  const { favorites, toggle } = useFavorites()
  const active = favorites.has(chartKey)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    void toggle(chartKey)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? 'Fjern fra favoritter' : 'Legg til i favoritter'}
      title={title ?? (active ? 'Fjern fra favoritter' : 'Legg til i favoritter')}
      className={className}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 4,
        cursor: 'pointer',
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
        stroke={active ? '#FF4500' : '#555560'}
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
