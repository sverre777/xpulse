'use client'

import { useEffect, useRef } from 'react'

// Tilpasset cursor — ball + sirkel som følger musepekeren med litt etterheng
// (RAF-easing). Speiler implementasjonen fra public/xpulse.html. Skjules
// automatisk på touch-enheter siden de ikke har en hover-cursor.
//
// Farge tas inn som prop slik at hver layout kan bestemme:
//   - utøver-modus / landing → oransje (#FF4500)
//   - trener-modus → blå (#1A6FD4)
//
// Komponenten setter også document.body.style.cursor = 'none' mens den er
// montert, og rydder opp når den unmounts.

interface Props {
  color?: string
  // Sirkel-fargen er hovedfargen med litt opacity. Tilbyr override for
  // ekstreme tilfeller, men default-utregningen passer normalt.
  ringColor?: string
}

export function CustomCursor({ color = '#FF4500', ringColor }: Props) {
  const dotRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Hop ut hvis vi er på en ren touch-enhet — der gir custom cursor
    // ingen mening og blir liggende statisk i hjørnet.
    const isFinePointer = typeof window !== 'undefined' &&
      window.matchMedia('(pointer: fine)').matches
    if (!isFinePointer) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let mx = 0, my = 0
    let rx = 0, ry = 0
    let rafId = 0

    const onMove = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
      dot.style.left = `${mx}px`
      dot.style.top = `${my}px`
    }

    const animate = () => {
      // 0.12 = samme easing som xpulse.html — gir det "myke" etterhenget.
      rx += (mx - rx) * 0.12
      ry += (my - ry) * 0.12
      ring.style.left = `${rx}px`
      ring.style.top = `${ry}px`
      rafId = requestAnimationFrame(animate)
    }

    document.addEventListener('mousemove', onMove)
    rafId = requestAnimationFrame(animate)

    // Skjul system-cursor mens vi har egen. Lagrer forrige verdi så vi
    // restorerer den ved unmount.
    const prev = document.body.style.cursor
    document.body.style.cursor = 'none'

    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafId)
      document.body.style.cursor = prev
    }
  }, [])

  // Sirkel-stroke får 35% opacity på fargen — matcher xpulse.
  const ringStroke = ringColor ?? colorWithAlpha(color, 0.35)

  return (
    <>
      <div ref={dotRef}
        aria-hidden="true"
        style={{
          position: 'fixed', width: 10, height: 10,
          background: color, borderRadius: '50%',
          pointerEvents: 'none', zIndex: 9999,
          transform: 'translate(-50%, -50%)',
          left: -100, top: -100, // start utenfor viewport
        }}
      />
      <div ref={ringRef}
        aria-hidden="true"
        style={{
          position: 'fixed', width: 32, height: 32,
          border: `1px solid ${ringStroke}`,
          borderRadius: '50%',
          pointerEvents: 'none', zIndex: 9998,
          transform: 'translate(-50%, -50%)',
          left: -100, top: -100,
        }}
      />
    </>
  )
}

// #RRGGBB → rgba(R, G, B, alpha). Returnerer fargen direkte hvis den ikke
// er på #RRGGBB-form (fallback for navngitte farger eller rgba-input).
function colorWithAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
