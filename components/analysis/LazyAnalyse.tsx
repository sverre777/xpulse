'use client'

// YTELSE bolk 5 (Sverre 5. sep 2026): analysegrafene under kalenderen bruker
// recharts (to chunks à 372 KB). Kalender-sida skal ikke laste graf-
// biblioteket før grafen faktisk trengs — komponentene lastes dynamisk og
// monteres først når de er i (nærheten av) synsfeltet.
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type ComponentProps } from 'react'

const CustomBreakdownChartDyn = dynamic(() => import('./CustomBreakdownChart').then(m => m.CustomBreakdownChart), { ssr: false, loading: () => <Plass hoyde={320} /> })
const SkytingChartSectionDyn = dynamic(() => import('./SkytingChartSection').then(m => m.SkytingChartSection), { ssr: false, loading: () => null })

function Plass({ hoyde }: { hoyde: number }) {
  return <div aria-hidden style={{ minHeight: hoyde }} />
}

/** Monterer barna først når wrapperen kommer inn i synsfeltet (200 px margin). */
function NaarSynlig({ hoyde, children }: { hoyde: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [synlig, setSynlig] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setSynlig(true); return }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setSynlig(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} data-lazy-analyse={synlig ? 'lastet' : 'venter'} style={{ minHeight: synlig ? undefined : hoyde }}>{synlig ? children : null}</div>
}

export function LazyCustomBreakdownChart(props: ComponentProps<typeof CustomBreakdownChartDyn>) {
  return <NaarSynlig hoyde={320}><CustomBreakdownChartDyn {...props} /></NaarSynlig>
}

export function LazySkytingChartSection(props: ComponentProps<typeof SkytingChartSectionDyn>) {
  return <NaarSynlig hoyde={0}><SkytingChartSectionDyn {...props} /></NaarSynlig>
}
