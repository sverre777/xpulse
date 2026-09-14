'use client'

import { useFavorites } from './FavoritesContext'
import { Ikon, type IkonStorrelse } from '@/components/ui/ikoner'

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

// size er et fritt pixel-tall fra kallerne (historisk) - Ikon tar bare 14/18/22/26,
// så vi runder til nærmeste tillatte størrelse (likt avstand -> størst).
const IKON_STORRELSER: readonly IkonStorrelse[] = [14, 18, 22, 26]
function narmesteStorrelse(n: number): IkonStorrelse {
  return IKON_STORRELSER.reduce((best, cur) => {
    const diff = Math.abs(cur - n), bestDiff = Math.abs(best - n)
    return diff < bestDiff || (diff === bestDiff && cur > best) ? cur : best
  })
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
      <Ikon navn="favoritt" variant={active ? 'fyll' : 'strek'} storrelse={narmesteStorrelse(size)}
        style={{ color: active ? '#FF4500' : 'var(--tekst-8-app)' }} />
    </button>
  )
}
