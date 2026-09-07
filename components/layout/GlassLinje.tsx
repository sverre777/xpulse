'use client'

// NAVIGASJON v2 bolk 1 — GLASS-LINJE NEDERST (fasit design/xpulse-app-navigasjon-
// design.html + -trener-design.html). Fem faner per rolle, flytende pille 12 px
// fra kantene, 64 px høy, blur + svak kant + innvendig lys topplinje — alt via
// color-mix på tokens så lysmodus følger. Ikoner = dagens strekikon-sett (strek
// 1,7 · 23 px), etikett 10,5 px Barlow Condensed. Aktiv fane følger ruta:
// utøver oransje, trener COACH_BLUE. safe-area-inset-bottom. Vises bare når
// erMobilNav() er sann (≤ 620 px eller Capacitor).

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useErMobilNav } from '@/lib/er-app'
import { HomeGlyph, CalendarGlyph, BookGlyph, ChartGlyph, CalendarPlusGlyph, UsersGlyph, MerGlyph } from './NavLinkIcons'
import { MerPanel } from './MerPanel'
import type { AvatarMenyProps } from './AvatarMeny'

const FONT = "'Barlow Condensed', sans-serif"
const ORANSJE = '#FF4500'
const COACH_BLUE = '#1A6FD4'
/** Høyden innholdet må gi plass til (pille 64 + 12 under + 12 luft). */
export const GLASS_LINJE_HOYDE = 88

type Fane = { id: string; navn: string; href: string; Ikon: (p: { size?: number; strokeWidth?: number }) => React.ReactNode; aktiv: (p: string) => boolean }

const UTOVER: Fane[] = [
  { id: 'hjem', navn: 'Hjem', href: '/app/oversikt', Ikon: HomeGlyph, aktiv: p => p === '/app/oversikt' || p === '/app' },
  { id: 'plan', navn: 'Plan', href: '/app/plan', Ikon: CalendarGlyph, aktiv: p => p.startsWith('/app/plan') || p.startsWith('/app/periodisering') },
  { id: 'dagbok', navn: 'Dagbok', href: '/app/dagbok', Ikon: BookGlyph, aktiv: p => p.startsWith('/app/dagbok') || p.startsWith('/app/okt/') },
  { id: 'analyse', navn: 'Analyse', href: '/app/analyse', Ikon: ChartGlyph, aktiv: p => p.startsWith('/app/analyse') },
  { id: 'mer', navn: 'Mer', href: '/app/mer', Ikon: MerGlyph, aktiv: () => false },
]
const TRENER: Fane[] = [
  { id: 'hjem', navn: 'Hjem', href: '/app/trener', Ikon: HomeGlyph, aktiv: p => p === '/app/trener' },
  { id: 'planlegg', navn: 'Planlegg', href: '/app/trener/planlegg', Ikon: CalendarPlusGlyph, aktiv: p => p.startsWith('/app/trener/planlegg') },
  { id: 'kalender', navn: 'Kalender', href: '/app/trener/kalender', Ikon: CalendarGlyph, aktiv: p => p.startsWith('/app/trener/kalender') },
  { id: 'utovere', navn: 'Utøvere', href: '/app/trener/utovere', Ikon: UsersGlyph, aktiv: p => p.startsWith('/app/trener/utovere') },
  { id: 'mer', navn: 'Mer', href: '/app/mer', Ikon: MerGlyph, aktiv: () => false },
]

// Trenerens egne undersider (Sammenligne, grupper, plasser …) hører til Mer; bare
// /app/trener/<utøver-id>/… er drilldown der ingen fane skal lyse.
const TRENER_EGNE_RUTER = new Set(['planlegg', 'kalender', 'sammenligne', 'utovere', 'grupper', 'plasser'])
function erUtoverDrilldown(p: string): boolean {
  const m = /^\/app\/trener\/([^/]+)/.exec(p)
  return !!m && !TRENER_EGNE_RUTER.has(m[1])
}

export function GlassLinje({ rolle, meny }: {
  rolle: 'athlete' | 'coach'
  /** Sverre 6. sep: Mer-fanen løfter det samme panelet som PC, opp fra bunnlinja. */
  meny?: Omit<AvatarMenyProps, 'rolle'> & { harPlan?: boolean }
}) {
  const vis = useErMobilNav()
  const pathname = usePathname() ?? ''
  const [merAapen, setMerAapen] = useState(false)
  // Innholdet under scroller under glasset (padding-bottom 130 via .xp-app-innhold);
  // ＋-knappen løftes over linja gjennom --xp-bunnlinje.
  useEffect(() => {
    if (!vis) return
    document.documentElement.style.setProperty('--xp-bunnlinje', `${GLASS_LINJE_HOYDE}px`)
    document.documentElement.setAttribute('data-app-nav', '1')
    return () => { document.documentElement.style.removeProperty('--xp-bunnlinje'); document.documentElement.removeAttribute('data-app-nav') }
  }, [vis])
  if (!vis) return null
  const faner = rolle === 'coach' ? TRENER : UTOVER
  const aksent = rolle === 'coach' ? COACH_BLUE : ORANSJE
  const noenAktiv = faner.some(f => f.aktiv(pathname))
  return (
    <nav aria-label="Hovednavigasjon" data-glass-linje={rolle}
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', height: 64, zIndex: 48,
        display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', alignItems: 'stretch',
        borderRadius: 22, padding: 4,
        background: 'color-mix(in srgb, var(--flate-3) 72%, transparent)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)',
        border: '1px solid color-mix(in srgb, var(--line2) 70%, transparent)',
        boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--tekst-1-app) 14%, transparent), 0 12px 32px color-mix(in srgb, #000 35%, transparent)',
      }}>
      {faner.map(f => {
        const aktiv = f.aktiv(pathname) || (f.id === 'mer' && (merAapen || (!noenAktiv && pathname !== '/app' && !erUtoverDrilldown(pathname) && pathname !== '/app/trener' && !pathname.startsWith('/app/oversikt'))))
        const stil: React.CSSProperties = { textDecoration: 'none', color: aktiv ? aksent : 'var(--tekst-5-app)', borderRadius: 18, background: aktiv ? `color-mix(in srgb, ${aksent} 14%, transparent)` : 'transparent', minHeight: 44, transition: 'color .15s, background .15s', border: 'none', cursor: 'pointer' }
        const innhold = (
          <>
            <f.Ikon size={23} strokeWidth={1.7} />
            <span style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>{f.navn}</span>
          </>
        )
        // Mer åpner panelet i stedet for å navigere - men bare når vi har menydataene.
        // Uten dem (eldre montering) står dyplenka til /app/mer.
        if (f.id === 'mer' && meny) return (
          <button key={f.id} type="button" data-glass-fane={f.id} aria-haspopup="dialog" aria-expanded={merAapen}
            onClick={() => setMerAapen(v => !v)} className="flex flex-col items-center justify-center gap-0.5" style={stil}>
            {innhold}
          </button>
        )
        return (
          <Link key={f.id} href={f.href} data-glass-fane={f.id} aria-current={aktiv ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-0.5" style={stil}>
            {innhold}
          </Link>
        )
      })}
      {merAapen && meny && <MerPanel plassering="mobil" rolle={rolle} {...meny} onLukk={() => setMerAapen(false)} />}
    </nav>
  )
}
