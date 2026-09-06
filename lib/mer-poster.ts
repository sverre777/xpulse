// NAVIGASJON v2: postene på «Mer» — én kilde for /app/mer (bolk 4) og PC-nedtrekket (bolk 7).
export interface MerPost { id: string; navn: string; href: string; ikon: string; tall?: number }

const I = {
  maler: 'M4 4h16v16H4zM8 9h8M8 13h5', live: 'M6 5l12 7-12 7z', utstyr: 'M3 17l6-6M9 11l4-4 4 4-4 4zM17 7l4-4',
  helse: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  ai: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z', trener: 'M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0',
  innboks: 'M3 7h18v12H3zM3 7l9 6 9-6',
  innstillinger: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  hjelp: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01',
  utovere: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  plasser: 'M4 4h16v16H4zM4 12h16M12 4v16',
  grupper: 'M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 21v-1a5 5 0 0 1 5-5h2M22 21v-1a5 5 0 0 0-5-5h-2M12 21v-4a4 4 0 0 1 4-4',
}
export const MER_IKON = I

function iDag(): string { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` }

/** Utøver (3 × 3) eller trener (sju). Poster uten tilgang skjules: AI-coach uten plan. */
export function merPoster(rolle: 'athlete' | 'coach', o: { unreadInboxCount?: number; harPlan?: boolean } = {}): MerPost[] {
  const tall = o.unreadInboxCount ?? 0
  if (rolle === 'coach') return [
    { id: 'utovere', navn: 'Utøvere', href: '/app/trener/utovere', ikon: I.utovere },
    { id: 'innboks', navn: 'Innboks & kommentarer', href: '/app/innboks', ikon: I.innboks, tall },
    { id: 'maler', navn: 'Maler & standardøkter', href: '/app/trener/planlegg', ikon: I.maler },
    { id: 'plasser', navn: 'Plasser & invitasjon', href: '/app/trener#plasser', ikon: I.plasser },
    { id: 'grupper', navn: 'Grupper', href: '/app/innstillinger/grupper', ikon: I.grupper },
    { id: 'innstillinger', navn: 'Innstillinger', href: '/app/innstillinger', ikon: I.innstillinger },
    { id: 'hjelp', navn: 'Hjelp', href: '/kontakt', ikon: I.hjelp },
  ]
  return [
    { id: 'maler', navn: 'Maler & standardøkter', href: '/app/maler', ikon: I.maler },
    { id: 'live', navn: 'Live styrke', href: `/app/dagbok?new=${iDag()}&styrke=1`, ikon: I.live },
    { id: 'utstyr', navn: 'Utstyr & skipark', href: '/app/utstyr', ikon: I.utstyr },
    { id: 'helse', navn: 'Helse', href: '/app/analyse?tab=helse', ikon: I.helse },
    ...(o.harPlan === false ? [] : [{ id: 'ai', navn: 'AI-coach', href: '/app/ai-coach', ikon: I.ai }]),
    { id: 'trener', navn: 'Trener', href: '/app/innstillinger/trener', ikon: I.trener },
    { id: 'innboks', navn: 'Innboks', href: '/app/innboks', ikon: I.innboks, tall },
    { id: 'innstillinger', navn: 'Innstillinger', href: '/app/innstillinger', ikon: I.innstillinger },
    { id: 'hjelp', navn: 'Hjelp', href: '/kontakt', ikon: I.hjelp },
  ]
}
