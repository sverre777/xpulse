// NAVIGASJON v2: postene på «Mer» — én kilde for /app/mer (bolk 4) og PC-nedtrekket (bolk 7).
// Ikonene er navn i Sverres ikonsett (components/ui/ikoner.tsx); MerSide og PcMeny tegner dem.
import { iDagISO } from '@/lib/local-date'
import type { IkonNavn } from '@/components/ui/ikoner'
export interface MerPost { id: string; navn: string; href: string; ikon: IkonNavn; tall?: number }

/** Utøver (3 × 3) eller trener (sju). Poster uten tilgang skjules: AI-coach uten plan. */
export function merPoster(rolle: 'athlete' | 'coach', o: { unreadInboxCount?: number; harPlan?: boolean } = {}): MerPost[] {
  const tall = o.unreadInboxCount ?? 0
  if (rolle === 'coach') return [
    // Sammenligne og Plasser har ikke egne ikoner på arkene: analyse (søyler) og abonnement (kort) er nærmeste.
    { id: 'sammenligne', navn: 'Sammenligne', href: '/app/trener/sammenligne', ikon: 'analyse' },
    { id: 'innboks', navn: 'Innboks & kommentarer', href: '/app/innboks', ikon: 'innboks', tall },
    { id: 'maler', navn: 'Maler & standardøkter', href: '/app/trener/planlegg', ikon: 'maler' },
    { id: 'plasser', navn: 'Plasser & invitasjon', href: '/app/trener#plasser', ikon: 'abonnement' },
    { id: 'grupper', navn: 'Grupper', href: '/app/innstillinger/grupper', ikon: 'fellestrening' },
    { id: 'innstillinger', navn: 'Innstillinger', href: '/app/innstillinger', ikon: 'innstillinger' },
    { id: 'hjelp', navn: 'Hjelp', href: '/kontakt', ikon: 'hjelp' },
  ]
  return [
    { id: 'maler', navn: 'Maler & standardøkter', href: '/app/maler', ikon: 'maler' },
    { id: 'live', navn: 'Live styrke', href: `/app/dagbok?new=${iDagISO()}&styrke=1`, ikon: 'live-styrke' },
    { id: 'utstyr', navn: 'Utstyr & skipark', href: '/app/utstyr', ikon: 'utstyr' },
    { id: 'helse', navn: 'Helse', href: '/app/analyse?tab=helse', ikon: 'helse' },
    ...(o.harPlan === false ? [] : [{ id: 'ai', navn: 'AI-coach', href: '/app/ai-coach', ikon: 'ai-coach' as const }]),
    { id: 'trener', navn: 'Trener', href: '/app/innstillinger/trener', ikon: 'trener' },
    { id: 'innboks', navn: 'Innboks', href: '/app/innboks', ikon: 'innboks', tall },
    { id: 'innstillinger', navn: 'Innstillinger', href: '/app/innstillinger', ikon: 'innstillinger' },
    { id: 'hjelp', navn: 'Hjelp', href: '/kontakt', ikon: 'hjelp' },
  ]
}
