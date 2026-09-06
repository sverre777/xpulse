'use client'

// UNDERSIDENE v2 bolk B4 - ekte produktflate i seksjonene. Fragmentene i
// public/forside/ ER appens egne komponenter, serialisert fra /forside-eksport
// (regel 11) - de samme som forsiden bruker. Lastes lat, ett tema om gangen, og
// byttes når temaet eller breakpointet endrer seg.

import { useEffect, useRef, useState } from 'react'

export function AppFragment({ navn, hoyde = 180 }: { navn: string; hoyde?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [synlig, setSynlig] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(p => { if (p.some(x => x.isIntersecting)) { setSynlig(true); io.disconnect() } }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !synlig) return
    let avbrutt = false
    const last = () => {
      const tema = document.documentElement.getAttribute('data-tema') === 'lys' ? 'lys' : 'mork'
      const smal = window.matchMedia('(max-width: 560px)').matches ? '.m' : ''
      fetch(`/forside/${navn}.${tema}${smal}.html`)
        .then(r => (r.ok ? r.text() : ''))
        .then(html => { if (!avbrutt && html) el.innerHTML = html })
        .catch(() => {})
    }
    last()
    const mo = new MutationObserver(last)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] })
    const mq = window.matchMedia('(max-width: 560px)')
    mq.addEventListener('change', last)
    return () => { avbrutt = true; mo.disconnect(); mq.removeEventListener('change', last) }
  }, [navn, synlig])

  return <div className="lp-eks" ref={ref} style={{ ['--lp-eks-h' as string]: `${hoyde}px` }} aria-hidden />
}
