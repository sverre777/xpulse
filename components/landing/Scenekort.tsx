'use client'

// UNDERSIDENE bolk 3: ett animasjonskort (forsidens scene) i en seksjon - erstatter et
// statisk fragment, aldri et avsnitt. Motoren og scenefila lastes lat når kortet nærmer
// seg viewporten (300 px, som AppFragment). Forsidens tokens ligger BARE på wrapperen
// rundt kortet (.xp-forside-tokens) - aldri rundt et AppFragment: 14 av variabelnavnene
// (--card, --line, --line2, --dim, --blue, --gold, --green, --hurt, --orange, --i1..--i5)
// finnes også i appens globals.css, og et fragment inni wrapperen ville skiftet farge.

import { useEffect, useRef } from 'react'
import { lastForsideMotor } from './forside-motor'

export type SceneFil = 'flyt' | 'trener' | 'detaljene'
export interface SceneValg { tittel: string; fil: SceneFil }

export function Scenekort({ scener }: { scener: SceneValg[] }) {
  const rot = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rot.current
    if (!el) return
    let avbrutt = false
    const stoppere: Array<() => void> = []
    const start = () => {
      lastForsideMotor().then(() => {
        if (avbrutt || !window.enScene) return
        el.querySelectorAll<HTMLElement>('[data-scenekort]').forEach(k => {
          const tittel = k.getAttribute('data-scenekort') ?? '', fil = k.getAttribute('data-scenefil') ?? 'flyt'
          window.enScene!(tittel, k, { fil }).then(h => { if (avbrutt) h.stopp(); else stoppere.push(h.stopp) }).catch(e => console.error('[Scenekort]', e))
        })
      }).catch(e => console.error('[Scenekort] motoren lastet ikke', e))
    }
    const io = new IntersectionObserver(p => { if (p.some(x => x.isIntersecting)) { io.disconnect(); start() } }, { rootMargin: '300px' })
    io.observe(el)
    return () => { avbrutt = true; io.disconnect(); stoppere.forEach(s => s()) }
  }, [scener])
  return (
    <div ref={rot} className="lp-scenekort">
      {scener.map(s => <div key={s.tittel} className="xp-forside-tokens" data-scenekort={s.tittel} data-scenefil={s.fil} role="figure" aria-label={s.tittel.toLowerCase()} />)}
    </div>
  )
}
