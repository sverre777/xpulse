'use client'

// «MER» SOM OVERLEGG (Sverre 6. sep): Mer skal ikke være et smalt nedtrekk, men
// åpne det samme innholdet som /app/mer i et panel OVER siden - på PC som
// avatar-menyen (samme ramme, skygge, avstand under knappen, klikk utenfor og
// Esc), og på mobil som et ark opp fra bunnlinja der Mer-fanen står.
// ÉN kilde til innhold: MerSide + lib/mer-poster. /app/mer består som side.

import { useEffect, useRef } from 'react'
import { MerSide } from './MerSide'
import type { AvatarMenyProps } from './AvatarMeny'

export type MerPanelProps = AvatarMenyProps & {
  harPlan?: boolean
  harSkiskyting?: boolean
  plassering: 'pc' | 'mobil'
  onLukk: () => void
}

/** Over profil-påminnelsen (z-40), ＋-knappen (45) og glass-linja (48). */
const Z = 130

export function MerPanel({ plassering, onLukk, ...props }: MerPanelProps) {
  const rot = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const klikk = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (rot.current && !rot.current.contains(t) && !t.closest?.('[data-pc-mer], [data-glass-fane="mer"]')) onLukk()
    }
    const tast = (e: KeyboardEvent) => { if (e.key === 'Escape') onLukk() }
    document.addEventListener('mousedown', klikk); document.addEventListener('keydown', tast)
    return () => { document.removeEventListener('mousedown', klikk); document.removeEventListener('keydown', tast) }
  }, [onLukk])

  const glass: React.CSSProperties = {
    background: 'color-mix(in srgb, var(--card) 97%, transparent)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)',
    border: '1px solid color-mix(in srgb, var(--line2) 80%, transparent)',
    boxShadow: '0 18px 48px rgba(0,0,0,.4)',
  }

  if (plassering === 'pc') {
    return (
      <div ref={rot} role="menu" data-mer-panel="pc" aria-label="Mer"
        style={{ position: 'absolute', left: 0, top: 'calc(100% + 8px)', width: 'min(560px, calc(100vw - 32px))', zIndex: Z, borderRadius: 18, padding: 4, ...glass }}
        onClick={e => { if ((e.target as HTMLElement).closest('a')) onLukk() }}>
        <MerSide {...props} />
      </div>
    )
  }

  // Mobil: arket kommer opp fra bunnlinja. --xp-bunnlinje settes av GlassLinje.
  return (
    <>
      <div data-mer-bakteppe onClick={onLukk} aria-hidden
        style={{ position: 'fixed', inset: 0, zIndex: Z - 1, background: 'rgba(0,0,0,.45)' }} />
      <div ref={rot} role="dialog" aria-modal="true" aria-label="Mer" data-mer-panel="mobil"
        style={{
          position: 'fixed', left: 8, right: 8, zIndex: Z, borderRadius: 22, padding: 4, maxHeight: '76svh', overflowY: 'auto',
          /* --xp-bunnlinje er 88 = pille 64 + 12 under + 12 luft. Arket skal ligge
             rett over selve pilla, ikke over lufta: 88 - 12 + 8 px klaring. */
          bottom: 'calc(var(--xp-bunnlinje, 88px) - 16px + env(safe-area-inset-bottom, 0px))',
          animation: 'xp-mer-opp .22s cubic-bezier(.2,.7,.2,1)', ...glass,
        }}
        onClick={e => { if ((e.target as HTMLElement).closest('a')) onLukk() }}>
        <span aria-hidden style={{ display: 'block', width: 38, height: 4, borderRadius: 999, margin: '8px auto 0', background: 'var(--line2)' }} />
        <MerSide {...props} />
        <style>{'@keyframes xp-mer-opp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){[data-mer-panel]{animation:none!important}}'}</style>
      </div>
    </>
  )
}
