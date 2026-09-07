'use client'

// ROLLEBYTTE (Sverre 6. sep: «byttet er treigt, og jeg må reloade for at det skal
// funke - bedre med skjelettvisning»). To ting skjer her:
//  1) Overlegget gir tilbakemelding med en gang: appens ramme som skjelett i den
//     rollen du bytter TIL - blå for trener, oransje for utøver.
//  2) Det holder brukeren på siden til den harde navigasjonen lander. Uten det
//     lukket menyen seg først, komponenten som skulle navigere ble avmontert, og
//     rollen var byttet på serveren uten at noe skjedde i nettleseren.

import { useEffect, useState } from 'react'
import type { Role } from '@/lib/types'

const ORANSJE = '#FF4500'
const BLAA = '#1A6FD4'
const FONT = "'Barlow Condensed', sans-serif"
export const ROLLEBYTTE_HENDELSE = 'xp:rollebytte'

/** Kalles fra rollebytterne når skjemaet sendes. */
export function startRollebytte(rolle: Role) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ROLLEBYTTE_HENDELSE, { detail: { rolle } }))
}

export function RollebytteSkjelett() {
  const [rolle, setRolle] = useState<Role | null>(null)
  useEffect(() => {
    const paa = (e: Event) => {
      const r = (e as CustomEvent<{ rolle: Role }>).detail?.rolle
      if (r) setRolle(r)
    }
    window.addEventListener(ROLLEBYTTE_HENDELSE, paa)
    // Sikkerhetsnett: går noe galt, skal ikke overlegget bli stående for alltid.
    return () => window.removeEventListener(ROLLEBYTTE_HENDELSE, paa)
  }, [])
  useEffect(() => {
    if (!rolle) return
    const t = window.setTimeout(() => setRolle(null), 20000)
    return () => window.clearTimeout(t)
  }, [rolle])

  if (!rolle) return null
  const aksent = rolle === 'coach' ? BLAA : ORANSJE
  const boks = (h: number, b?: string): React.CSSProperties => ({
    height: h, borderRadius: 14, background: b ?? 'var(--flate-10)',
    border: '1px solid var(--line)', animation: 'xp-rolle-puls 1.1s ease-in-out infinite',
  })
  return (
    <div data-rollebytte-skjelett={rolle} role="status" aria-live="polite"
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--flate-3)', overflow: 'hidden' }}>
      <style>{'@keyframes xp-rolle-puls{0%,100%{opacity:.55}50%{opacity:.9}}@media (prefers-reduced-motion:reduce){[data-rollebytte-skjelett] *{animation:none!important}}'}</style>
      <div style={{ height: 3, background: aksent, animation: 'xp-rolle-puls 1.1s ease-in-out infinite' }} />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: aksent, opacity: .9 }} />
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: aksent }}>
            Bytter til {rolle === 'coach' ? 'trener' : 'utøver'}-modus
          </span>
          <span style={{ marginLeft: 'auto', ...boks(34), width: 120 }} />
        </div>
        <div style={boks(120)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div style={boks(180)} /><div style={boks(180)} /><div style={boks(180)} />
        </div>
        <div style={boks(260)} />
      </div>
    </div>
  )
}
