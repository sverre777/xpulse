import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicFooter } from '@/components/legal/PublicFooter'

export const metadata: Metadata = {
  title: 'Pris — X-PULSE',
  description: 'Velg ditt abonnement. 30 dagers gratis prøve. Avslutt når som helst.',
}

// Tier-katalog. priceTier matcher key i Stripe-checkout (Fase C).
//   status='active'  → "Start gratis prøve"-knapp (Stripe-checkout aktiveres i Fase C)
//   status='soon'    → "Bli varslet"-knapp (mailto til support; feature_waitlist i Fase B)
type Tier = {
  id: string
  name: string
  priceMonthly: number
  priceTier: string | null
  status: 'active' | 'soon'
  features: string[]
  highlight?: boolean
}

const ATHLETE_TIERS: Tier[] = [
  {
    id: 'athlete_pro',
    name: 'Athlete Pro',
    priceMonthly: 59,
    priceTier: 'athlete_pro',
    status: 'active',
    features: [
      'Full klokkesync (Strava + .fit fra Garmin/Polar/Coros/Suunto/Wahoo)',
      'Treningsplan med periodisering (årsplan, faser, samlinger, konkurranser)',
      'Detaljert øktlogging — sport-spesifikk for langrenn, skiskyting, løping, sykling, triatlon',
      'Pulskurve, sone-fordeling, lap-tabell, dyp øktanalyse',
      'Belastning (ATL/CTL/TSB), trender, PR-er, tester og laktat-målinger',
      'Plan vs gjennomført-sammenligning',
      'Skiskyting-spesifikk skytinganalyse',
      'Maler for økter og planer',
    ],
  },
  {
    id: 'athlete_pro_ai',
    name: 'Athlete Pro AI',
    priceMonthly: 129,
    priceTier: null,
    status: 'soon',
    features: [
      'Alt i Athlete Pro pluss AI-funksjoner (Claude Haiku)',
      'Auto-tagging av lap (oppvarming, intervall, pause, nedjogg)',
      'Ukentlig AI-sammendrag av treningsuken',
      'AI-kommentar på hver økt — kort innsikt',
      'Korrelasjon-analyse: HRV vs prestasjon, søvn vs energi, belastning vs sykdom',
      'Dyp uke-, måned-, og årsanalyse med AI-tolkning',
      'Light long-term memory om dine treningsmønstre',
      'Ingen chat eller automatisk planlegging — det får du i Ultimate',
    ],
  },
  {
    id: 'athlete_ultimate_ai',
    name: 'Athlete Ultimate AI',
    priceMonthly: 399,
    priceTier: null,
    status: 'soon',
    features: [
      'Alt i Athlete Pro AI pluss premium AI (Claude Sonnet/Opus)',
      'Chat med AI-coach 24/7 — kun treningsrelatert',
      'Dagbok via chat: "Var ute en time, kjente meg sliten" → økt opprettes automatisk',
      'Bilde/PDF/lyd-import — håndskrevet dagbok, konkurransekalender, lyd-notat',
      'Komplett plangenerering basert på dine mål, sport og historikk',
      'Adaptiv plan: justerer seg ved sykdom, dårlige dager, prestasjons-endring',
      'Custom-grafer på forespørsel og prestasjon-prediksjon',
      'Engasjement-velger: Verktøy- / Coach- / Autopilot-modus + granulære toggles',
    ],
    highlight: true,
  },
]

const TRAINER_TIERS: Tier[] = [
  {
    id: 'trener_basic',
    name: 'Trener Basic',
    priceMonthly: 199,
    priceTier: 'trener_basic',
    status: 'active',
    features: [
      'Inntil 10 utøvere (utøvere betaler eget Athlete-tier)',
      'Treningsplan-bygging for utøvere + plan-maler (uker, måneder, sesonger)',
      'Push planer/økter til utøvere',
      'Se utøvers gjennomførte økter + trener-tilgang til utøvers analyse (med samtykke)',
      'Trener-kalender med Delta-funksjon',
      'Innboks/meldinger med utøvere',
      'Konkurranseplanlegging',
    ],
  },
  {
    id: 'trener_pro',
    name: 'Trener Pro',
    priceMonthly: 279,
    priceTier: 'trener_pro',
    status: 'active',
    features: [
      'Alt i Trener Basic pluss:',
      'Ubegrenset antall utøvere',
      '5 Athlete Pro-lisenser inkludert (utøvere får Pro gratis via deg)',
      'Sammenligning på tvers av utøvere',
      'Avansert gruppe-trening (felles økter)',
      'Lag-statistikk',
    ],
    highlight: true,
  },
  {
    id: 'trener_pro_ai',
    name: 'Trener Pro AI',
    priceMonthly: 499,
    priceTier: null,
    status: 'soon',
    features: [
      'Alt i Trener Pro pluss AI for trener og lag',
      'Athlete Pro AI for treneren selv (auto-tagging, sammendrag, korrelasjoner)',
      'AI-analyse på alle utøvere du følger',
      'Auto-tagging og korrelasjon for hele laget',
      'AI-sammendrag av lagets utvikling per uke',
    ],
  },
  {
    id: 'trener_ultimate_ai',
    name: 'Trener Ultimate AI',
    priceMonthly: 999,
    priceTier: null,
    status: 'soon',
    features: [
      'Alt i Trener Pro AI pluss premium AI for trener-arbeid',
      'Athlete Ultimate AI for trenerens egen trening',
      '10 Athlete Pro AI-lisenser inkludert',
      'Plan-bygging via chat eller bilde: "Lag 4-ukers grunnperiode for utøver X"',
      'Velg hvem AI pusher til — utøver-utvalg, ikke hele laget',
      'Lag-prediksjon, adaptive lag-planer, custom rapporter (PDF)',
      'Engasjement-velger med trener-perspektiv',
    ],
  },
]

const ATHLETE_ACCENT = '#FF4500'
const COACH_ACCENT = '#1A6FD4'

export default function PrisPage() {
  return (
    <>
      <main style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-12 lg:py-20">
          <div className="text-center mb-10">
            <h1 className="mb-3"
              style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: 'clamp(36px, 6vw, 52px)', letterSpacing: '0.08em' }}>
              Velg ditt abonnement
            </h1>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '16px', letterSpacing: '0.04em' }}>
              30 dagers gratis prøve. Avslutt når som helst.
            </p>
          </div>

          <section className="mb-12">
            <SectionHeader accent={ATHLETE_ACCENT} label="For utøvere" />
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {ATHLETE_TIERS.map(t => (
                <TierCard key={t.id} tier={t} accent={ATHLETE_ACCENT} />
              ))}
            </div>
          </section>

          <section className="mb-12">
            <SectionHeader accent={COACH_ACCENT} label="For trenere" />
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {TRAINER_TIERS.map(t => (
                <TierCard key={t.id} tier={t} accent={COACH_ACCENT} />
              ))}
            </div>
          </section>

          <div className="text-center mt-10 space-y-3">
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
              AI-tiers lanseres Q4 2026 — klikk &laquo;Bli varslet&raquo; for tidlig tilgang.
            </p>
            <Link href="/"
              className="inline-block text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ATHLETE_ACCENT, textDecoration: 'none' }}>
              ← Tilbake til forsiden
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  )
}

function SectionHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span style={{ width: '24px', height: '3px', backgroundColor: accent, display: 'inline-block' }} />
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.08em', margin: 0 }}>
        {label}
      </h2>
    </div>
  )
}

function TierCard({ tier, accent }: { tier: Tier; accent: string }) {
  const isSoon = tier.status === 'soon'
  return (
    <div className="p-5 flex flex-col gap-4"
      style={{
        backgroundColor: '#13131A',
        border: `1px solid ${tier.highlight ? accent : '#1E1E22'}`,
        borderTop: `3px solid ${tier.highlight ? accent : 'transparent'}`,
      }}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em', margin: 0 }}>
            {tier.name}
          </h3>
          {isSoon && (
            <span title="AI-funksjoner er under utvikling — bli varslet ved lansering"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#D4A017', border: '1px solid #D4A017',
                padding: '1px 6px', fontSize: '10px', letterSpacing: '0.08em',
                textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>
              🟡 Kommer
            </span>
          )}
        </div>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: accent, fontSize: '32px', letterSpacing: '0.04em', margin: 0, lineHeight: 1.1 }}>
          {tier.priceMonthly} <span style={{ fontSize: '14px', color: '#8A8A96', letterSpacing: '0.06em' }}>kr/mnd</span>
        </p>
      </div>

      <ul className="space-y-1.5 flex-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px', lineHeight: 1.5 }}>
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span style={{ color: accent, marginTop: '1px' }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <TierCta tier={tier} accent={accent} />
    </div>
  )
}

function TierCta({ tier, accent }: { tier: Tier; accent: string }) {
  if (tier.status === 'soon') {
    const subject = encodeURIComponent(`Varsle meg når ${tier.name} er klar`)
    return (
      <a href={`mailto:support@x-pulse.no?subject=${subject}`}
        title="AI-funksjoner er under utvikling — bli varslet ved lansering"
        className="block text-center px-4 py-3 text-sm tracking-widest uppercase transition-colors hover:bg-[#1A1A22]"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#D4A017', border: '1px solid #D4A017',
          textDecoration: 'none',
        }}>
        Bli varslet
      </a>
    )
  }
  // Direkte til checkout-route: utlogget bruker blir sendt til /login av
  // route-en selv (og redirected tilbake hit etter innlogging). Innlogget
  // bruker går rett til Stripe Checkout.
  return (
    <Link href={`/api/checkout?tier=${tier.priceTier}`}
      className="block text-center px-4 py-3 text-sm tracking-widest uppercase transition-opacity hover:opacity-90"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: accent, color: '#FFFFFF',
        textDecoration: 'none',
      }}>
      Start gratis prøve
    </Link>
  )
}
