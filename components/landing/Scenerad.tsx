'use client'

// UNDERSIDENE bolk 3: HELE trener-raden (fem scener) med forsidens karusell - under
// tekstinnledningen på /funksjoner/trener, med kapittelraden. Samme markup og id-er som
// #tflyt på forsiden (prefiks t), så scener-trener.js kaller karusell(SC3, KAP3, 't') selv
// når fila lastes. Forsidens tokens ligger på raden (ingen fragmenter inni).

import { useEffect, useRef } from 'react'
import { lastForsideMotor, lastSkript } from './forside-motor'

export function Scenerad() {
  const rot = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rot.current
    if (!el) return
    let avbrutt = false
    const io = new IntersectionObserver(p => {
      if (!p.some(x => x.isIntersecting)) return
      io.disconnect()
      lastForsideMotor()
        .then(() => lastSkript('/forside/oktgraf.js'))
        .then(() => { if (!avbrutt) return lastSkript('/forside/scener-trener.js') })
        .catch(e => console.error('[Scenerad]', e))
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => { avbrutt = true; io.disconnect() }
  }, [])
  return (
    <div ref={rot} id="tflyt" className="xp-forside-tokens lp-scenerad fb" aria-roledescription="karusell" aria-label="For trenere" tabIndex={0}>
      <div className="fb-kap" role="tablist" id="tkap" />
      <div className="fb-spor" id="tspor" />
      <div className="fb-ktl"><div className="prikker" id="tprikker" /><button className="rundknapp" id="tspill" type="button" aria-label="Pause" /><div className="pilpar"><button className="rundknapp" id="tforr" type="button" aria-label="Forrige" /><button className="rundknapp" id="tnest" type="button" aria-label="Neste" /></div></div>
    </div>
  )
}
