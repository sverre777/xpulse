'use client'

// UNDERSIDENE v2 bolk B1 - topplinja (fasit design/xpulse-underside-langrenn-design.html).
// X-logoen i gradient (samme merke som forsidens topplinje), lenkene Funksjoner ▾ · Idretter ▾ ·
// For trenere · Priser · Om oss, temabryteren som i dag, og to piller til høyre:
// «Gå til forsiden» (ghost) og «Start gratis prøve» (oransje). Under 1100 px går ghost-
// pillen og lenkene bort, hamburgeren kommer fram, og panelet beholder fokusfelle,
// Esc og aria-expanded.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TemaBryter } from '@/components/layout/TemaBryter'
import { Ikon } from '@/components/ui/ikoner'
import { XPulseIcon } from '@/components/branding/XPulseIcon'
import { FEATURE_SPORTS } from '@/lib/landing-meta'

/** Modulene - samme lenker som forsidens nedtrekk. */
const MODULER = [
  { href: '/funksjoner/dagbok-og-plan', label: 'Dagbok og plan' },
  { href: '/funksjoner/analyse',        label: 'Analyse' },
  { href: '/funksjoner/klokkesync',     label: 'Klokkesynk' },
  { href: '/funksjoner/trener',         label: 'For trenere' },
  { href: '/funksjoner/ai-coach',       label: 'AI Coach', snart: true },
] as const

const IDRETTER = FEATURE_SPORTS.map(s => ({ href: `/funksjoner/${s.slug}`, label: s.label }))

export type LandingNavAktiv = 'funksjoner' | 'idretter' | 'trenere' | 'priser' | 'om'

export function LandingNav({ aktiv }: { aktiv?: LandingNavAktiv }) {
  const [aapen, setAapen] = useState<'funksjoner' | 'idretter' | null>(null)
  const [panel, setPanel] = useState(false)
  const rot = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Klikk utenfor lukker nedtrekket.
  useEffect(() => {
    if (!aapen) return
    const ned = (e: MouseEvent) => { if (rot.current && !rot.current.contains(e.target as Node)) setAapen(null) }
    document.addEventListener('mousedown', ned)
    return () => document.removeEventListener('mousedown', ned)
  }, [aapen])

  // Esc lukker begge, og panelet holder fokus inne mens det er åpent.
  const paaTast = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { setAapen(null); setPanel(false); return }
    if (e.key !== 'Tab' || !panelRef.current) return
    const felt = panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),summary')
    if (felt.length === 0) return
    const forste = felt[0], siste = felt[felt.length - 1]
    if (e.shiftKey && document.activeElement === forste) { e.preventDefault(); siste.focus() }
    else if (!e.shiftKey && document.activeElement === siste) { e.preventDefault(); forste.focus() }
  }, [])
  useEffect(() => {
    document.addEventListener('keydown', paaTast)
    return () => document.removeEventListener('keydown', paaTast)
  }, [paaTast])
  useEffect(() => {
    if (!panel) return
    const forrige = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('a[href],button')?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = ''; forrige?.focus?.() }
  }, [panel])

  return (
    <>
      <header className="lp-topp">
        <div className="lp-topp-inn" ref={rot}>
          <Link href="/xpulse.html" className="lp-merke" aria-label="X-PULSE">
            <XPulseIcon size={26} variant="gradient" />
            <b>PULSE</b>
          </Link>

          <nav className="lp-lenker" aria-label="Hovedmeny">
            <div style={{ position: 'relative' }}>
              <button type="button" className={`lp-ln${aktiv === 'funksjoner' || aapen === 'funksjoner' ? ' on' : ''}`}
                aria-haspopup="menu" aria-expanded={aapen === 'funksjoner'}
                onClick={() => setAapen(v => v === 'funksjoner' ? null : 'funksjoner')}>
                Funksjoner <i aria-hidden>▾</i>
              </button>
              {aapen === 'funksjoner' && (
                <div className="lp-nedtrekk" role="menu">
                  {MODULER.map(m => (
                    <Link key={m.href} href={m.href} role="menuitem" onClick={() => setAapen(null)}>
                      {m.label}{'snart' in m && m.snart && <span className="lp-snart">Kommer</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button type="button" className={`lp-ln${aktiv === 'idretter' || aapen === 'idretter' ? ' on' : ''}`}
                aria-haspopup="menu" aria-expanded={aapen === 'idretter'}
                onClick={() => setAapen(v => v === 'idretter' ? null : 'idretter')}>
                Idretter <i aria-hidden>▾</i>
              </button>
              {aapen === 'idretter' && (
                <div className="lp-nedtrekk" role="menu">
                  {IDRETTER.map(s => (
                    <Link key={s.href} href={s.href} role="menuitem" onClick={() => setAapen(null)}>{s.label}</Link>
                  ))}
                  <hr />
                  {MODULER.map(m => (
                    <Link key={m.href} href={m.href} role="menuitem" onClick={() => setAapen(null)}>{m.label}</Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/funksjoner/trener" className={`lp-ln${aktiv === 'trenere' ? ' on' : ''}`}>For trenere</Link>
            <Link href="/xpulse.html#priser" className={`lp-ln${aktiv === 'priser' ? ' on' : ''}`}>Priser</Link>
            <Link href="/om-oss" className={`lp-ln${aktiv === 'om' ? ' on' : ''}`}>Om oss</Link>
          </nav>

          <div className="lp-topp-h">
            <TemaBryter accent="#FF4500" />
            <Link href="/xpulse.html" className="lp-pill ghost">Gå til forsiden</Link>
            <Link href="/xpulse.html#priser" className="lp-pill">Start gratis prøve</Link>
            <button type="button" className="lp-burger" aria-label="Åpne meny" aria-expanded={panel}
              aria-controls="lp-panel" onClick={() => setPanel(true)}>
              <Ikon navn="hamburgermeny" storrelse={22} />
            </button>
          </div>
        </div>
      </header>

      {panel && (
        /* Mobilpanelet er BYGGET LIKT forsidens (public/xpulse.html .nav-panel):
           logo + lukk, tre ikonknapper (Logg inn · FAQ · Kontakt), radene
           Idretter ▾ · Funksjoner ▾ · For trenere · Priser · Om oss, og den
           oransje pillen nederst. Eneste forskjell er «Gå til forsiden», som
           bare gir mening her (Sverre 11. sep). Endres det ene, endres det andre. */
        <div className="lp-panel" id="lp-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Hovedmeny">
          <div className="lp-panel-topp">
            <Link href="/xpulse.html" className="lp-merke" onClick={() => setPanel(false)} aria-label="X-PULSE">
              <XPulseIcon size={32} variant="gradient" /><b>PULSE</b>
            </Link>
            <button type="button" className="lp-panel-lukk" aria-label="Lukk meny" onClick={() => setPanel(false)}>
              <Ikon navn="lukk" storrelse={26} />
            </button>
          </div>

          <div className="lp-panel-ikoner">
            <Link href="/app" className="lp-panel-ikon" onClick={() => setPanel(false)}>
              <Ikon navn="apne-fane" storrelse={22} />
              Logg inn
            </Link>
            <Link href="/xpulse.html#faq" className="lp-panel-ikon" onClick={() => setPanel(false)}>
              <Ikon navn="sok" storrelse={22} />
              FAQ
            </Link>
            <Link href="/kontakt" className="lp-panel-ikon" onClick={() => setPanel(false)}>
              <Ikon navn="innboks" storrelse={22} />
              Kontakt
            </Link>
          </div>

          <div className="lp-panel-lenker" role="navigation" aria-label="Sider">
            <details className="lp-panel-gruppe">
              <summary>Idretter <span className="lp-panel-chev" aria-hidden>▾</span></summary>
              <div className="lp-panel-under">
                {IDRETTER.map(s => <Link key={s.href} href={s.href} onClick={() => setPanel(false)}>{s.label}</Link>)}
              </div>
            </details>
            <details className="lp-panel-gruppe">
              <summary>Funksjoner <span className="lp-panel-chev" aria-hidden>▾</span></summary>
              <div className="lp-panel-under">
                {MODULER.map(m => <Link key={m.href} href={m.href} onClick={() => setPanel(false)}>{m.label}{'snart' in m && m.snart ? <span className="lp-panel-snart">Kommer snart</span> : null}</Link>)}
              </div>
            </details>
            <Link href="/funksjoner/trener" onClick={() => setPanel(false)}>For trenere</Link>
            <Link href="/xpulse.html#priser" onClick={() => setPanel(false)}>Priser</Link>
            <Link href="/om-oss" onClick={() => setPanel(false)}>Om oss</Link>
            <Link href="/xpulse.html" onClick={() => setPanel(false)}>Gå til forsiden</Link>
          </div>

          <Link href="/xpulse.html#priser" className="lp-panel-cta" onClick={() => setPanel(false)}>Start 30 dagers gratis prøve</Link>
        </div>
      )}
    </>
  )
}
