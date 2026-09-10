'use client'

// ＋-KNAPPEN (Sverre 6. sep): flytende ＋ nede til høyre på Hjem, Plan og
// Dagbok — oransje, 54 px, skygge, over evt. bunnlinje (safe-area). Trykk →
// meny med «Før i dagbok» · «Planlegg» · «Live styrke» (ikon + tekst). Valgene
// går via URL-parametrene kalenderen allerede åpner økt-popupen fra
// (?new=<dato>, ?styrke=1) — samme flyt som dagens knapper, ingen ny modal.
// Dagbok/Plan: dagen som er valgt i kalenderen (cd); Hjem: i dag.
// Tastatur: N åpner menyen. Trenervisning: på utøverens vegne, «Live styrke»
// skjult (live er utøver-only, som ellers).

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { iDagISO } from '@/lib/local-date'

const FONT = "'Barlow Condensed', sans-serif"

const Ikon = ({ d }: { d: string }) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
)
const IKON_DAGBOK = 'M5 4h11l3 3v13H5zM8 12h8M8 16h5M9 4v4h6'
const IKON_PLAN = 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15h2M13 15h2'
const IKON_LIVE = 'M6 5l12 7-12 7z'

export function PlussKnapp({ side, targetUserId, basePath = '/app', kanForeDagbok = true, kanPlanlegge = true }: {
  side: 'hjem' | 'dagbok' | 'plan'
  targetUserId?: string
  /** Trener-drilldown: `/app/trener/<id>` — ellers `/app`. */
  basePath?: string
  kanForeDagbok?: boolean
  kanPlanlegge?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [aapen, setAapen] = useState(false)
  const rot = useRef<HTMLDivElement | null>(null)
  const kanLive = !targetUserId
  const dato = (side === 'hjem' ? null : searchParams?.get('cd')) ?? iDagISO()

  useEffect(() => {
    if (!aapen) return
    const klikk = (e: MouseEvent) => { if (rot.current && !rot.current.contains(e.target as Node)) setAapen(false) }
    const tast = (e: KeyboardEvent) => { if (e.key === 'Escape') setAapen(false) }
    document.addEventListener('mousedown', klikk); document.addEventListener('keydown', tast)
    return () => { document.removeEventListener('mousedown', klikk); document.removeEventListener('keydown', tast) }
  }, [aapen])
  // N åpner menyen — ikke når en tekst-kontroll har fokus eller med modifikatorer.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (document.querySelector('[role="dialog"], .xp-popup, [data-workout-modal]')) return
      e.preventDefault(); setAapen(v => !v)
    }
    document.addEventListener('keydown', tast)
    return () => document.removeEventListener('keydown', tast)
  }, [])

  const gaa = useCallback((url: string) => {
    setAapen(false)
    // Samme side: router.push med nye parametre er nok — kalenderen lytter på searchParams.
    router.push(url)
  }, [router])

  const valg: { id: string; navn: string; ikon: string; onClick: () => void }[] = []
  if (kanForeDagbok) valg.push({ id: 'dagbok', navn: 'Før i dagbok', ikon: IKON_DAGBOK, onClick: () => gaa(`${basePath}/dagbok?new=${dato}`) })
  if (kanPlanlegge) valg.push({ id: 'plan', navn: 'Planlegg', ikon: IKON_PLAN, onClick: () => gaa(`${basePath}/plan?new=${dato}`) })
  if (kanLive) valg.push({ id: 'live', navn: 'Live styrke', ikon: IKON_LIVE, onClick: () => gaa(`/app/dagbok?new=${iDagISO()}&styrke=1`) })
  if (valg.length === 0) return null
  void pathname

  return (
    <div ref={rot} data-pluss-knapp style={{ position: 'fixed', right: 16, bottom: 'calc(18px + var(--xp-bunnlinje, 0px) + env(safe-area-inset-bottom, 0px))', zIndex: 45 }}>
      {aapen && (
        <div role="menu" data-pluss-meny className="flex flex-col"
          style={{ position: 'absolute', right: 0, bottom: 64, minWidth: 210, background: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 14, padding: 6, boxShadow: '0 16px 40px rgba(0,0,0,.35)' }}>
          {valg.map(v => (
            <button key={v.id} type="button" role="menuitem" data-pluss-valg={v.id} onClick={v.onClick}
              className="flex items-center gap-3 text-left"
              style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: 'var(--tekst-1-app)', background: 'none', border: 'none', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', minHeight: 44 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--card2)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
              <span style={{ color: v.id === 'live' ? '#28A86E' : 'var(--accent)', display: 'inline-flex' }}><Ikon d={v.ikon} /></span>
              {v.navn}
            </button>
          ))}
        </div>
      )}
      <button type="button" aria-label={aapen ? 'Lukk' : 'Ny økt'} aria-expanded={aapen} aria-haspopup="menu" data-pluss-aapne onClick={() => setAapen(v => !v)}
        style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--accent)', color: 'var(--tekst-1-ren)', border: 'none', cursor: 'pointer', fontSize: 30, lineHeight: 1, boxShadow: '0 10px 30px rgba(255,69,0,.45)', transform: aapen ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }}>
        ＋
      </button>
    </div>
  )
}

/** Navigasjon v2 bolk 6: ＋ for trener på Hjem/Planlegg/Kalender — Ny fellestrening · Push til utøver. */
export function PlussKnappTrener({ variant = 'hjem' }: { variant?: 'hjem' | 'kalender' } = {}) {
  const router = useRouter()
  const [aapen, setAapen] = useState(false)
  const rot = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!aapen) return
    const klikk = (e: MouseEvent) => { if (rot.current && !rot.current.contains(e.target as Node)) setAapen(false) }
    const tast = (e: KeyboardEvent) => { if (e.key === 'Escape') setAapen(false) }
    document.addEventListener('mousedown', klikk); document.addEventListener('keydown', tast)
    return () => { document.removeEventListener('mousedown', klikk); document.removeEventListener('keydown', tast) }
  }, [aapen])
  const valg = variant === 'kalender' ? [
    { id: 'fellestrening', navn: 'Ny fellestrening', ikon: IKON_PLAN, href: '/app/trener/kalender?ny=fellestrening' },
    { id: 'notat', navn: 'Trener-notat', ikon: IKON_DAGBOK, href: '/app/trener/kalender?ny=notat' },
  ] : [
    { id: 'fellestrening', navn: 'Ny fellestrening', ikon: IKON_PLAN, href: '/app/trener/kalender?ny=fellestrening' },
    { id: 'push', navn: 'Push til utøver', ikon: IKON_LIVE, href: '/app/trener/planlegg' },
  ]
  return (
    <div ref={rot} data-pluss-knapp="trener" style={{ position: 'fixed', right: 16, bottom: 'calc(18px + var(--xp-bunnlinje, 0px) + env(safe-area-inset-bottom, 0px))', zIndex: 45 }}>
      {aapen && (
        <div role="menu" data-pluss-meny className="flex flex-col" style={{ position: 'absolute', right: 0, bottom: 64, minWidth: 210, background: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 14, padding: 6, boxShadow: '0 16px 40px rgba(0,0,0,.35)' }}>
          {valg.map(v => (
            <button key={v.id} type="button" role="menuitem" data-pluss-valg={v.id} onClick={() => { setAapen(false); router.push(v.href) }} className="flex items-center gap-3 text-left"
              style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: 'var(--tekst-1-app)', background: 'none', border: 'none', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', minHeight: 44 }}>
              <span style={{ color: '#1A6FD4', display: 'inline-flex' }}><Ikon d={v.ikon} /></span>{v.navn}
            </button>
          ))}
        </div>
      )}
      <button type="button" aria-label={aapen ? 'Lukk' : 'Ny'} aria-expanded={aapen} aria-haspopup="menu" data-pluss-aapne onClick={() => setAapen(v => !v)}
        style={{ width: 54, height: 54, borderRadius: '50%', background: '#1A6FD4', color: 'var(--tekst-1-ren)', border: 'none', cursor: 'pointer', fontSize: 30, lineHeight: 1, boxShadow: '0 10px 30px rgba(26,111,212,.45)', transform: aapen ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }}>
        ＋
      </button>
    </div>
  )
}

/** Rettelser 6. sep («＋ skal være lik overalt»): utøverens ＋ montert i layouten — side etter ruta.
 *  Skjult i live-økta (egen bunnlinje). Plan/Dagbok i trener-drilldown monterer sin egen (targetUserId). */
export function PlussKnappAuto() {
  const pathname = usePathname() ?? ''
  if (pathname.startsWith('/app/okt/')) return null
  const side: 'hjem' | 'dagbok' | 'plan' = pathname.startsWith('/app/plan') || pathname.startsWith('/app/periodisering') ? 'plan' : pathname.startsWith('/app/dagbok') ? 'dagbok' : 'hjem'
  return <PlussKnapp side={side} />
}

const TRENER_EGNE_RUTER = new Set(['planlegg', 'kalender', 'sammenligne', 'utovere', 'grupper', 'plasser'])

/** Trenerens ＋ montert i trener-layouten — variant etter ruta. Inne på en utøver (/app/trener/<id>/…)
 *  monterer Plan/Dagbok sin egen ＋ på utøverens vegne, så her returneres null. */
export function PlussKnappTrenerAuto() {
  const pathname = usePathname() ?? ''
  const m = /^\/app\/trener\/([^/]+)/.exec(pathname)
  if (m && !TRENER_EGNE_RUTER.has(m[1])) return null
  return <PlussKnappTrener variant={pathname.startsWith('/app/trener/kalender') ? 'kalender' : 'hjem'} />
}
