import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getActiveSubscription, hasActiveAccess } from '@/lib/subscriptions'

export const metadata: Metadata = {
  title: 'Velg ditt abonnement — X-PULSE',
  description: '30 dagers gratis prøve. Promo-kode kan brukes ved kassen.',
}

// Pris-velger for nye brukere. Krever innlogget bruker. Hvis brukeren allerede
// har en aktiv subscription: rediriges direkte til /app/dagbok så de ikke
// kjører checkout to ganger.

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
    id: 'athlete_pro', name: 'Athlete Pro', priceMonthly: 59,
    priceTier: 'athlete_pro', status: 'active',
    features: [
      'Full klokkesync (Strava + .fit)',
      'Treningsplan med periodisering',
      'Detaljert øktlogging + analyse',
      'Pulskurve, sone-fordeling, lap-tabell',
      'Belastning, trender, PR-er, tester',
    ],
  },
  {
    id: 'athlete_pro_ai', name: 'Athlete Pro AI', priceMonthly: 129,
    priceTier: null, status: 'soon',
    features: [
      'Alt i Athlete Pro + AI-funksjoner',
      'Auto-tagging av lap',
      'Ukentlig AI-sammendrag',
      'Korrelasjon-analyse',
    ],
  },
  {
    id: 'athlete_ultimate_ai', name: 'Athlete Ultimate AI', priceMonthly: 399,
    priceTier: null, status: 'soon',
    features: [
      'Alt i Pro AI + premium AI',
      'Chat med AI-coach 24/7',
      'Dagbok via chat + bilde-import',
      'Komplett plangenerering',
    ],
  },
]

const TRAINER_TIERS: Tier[] = [
  {
    id: 'trener_basic', name: 'Trener Basic', priceMonthly: 199,
    priceTier: 'trener_basic', status: 'active',
    features: [
      'Inntil 10 utøvere',
      'Treningsplan-bygging + maler',
      'Push planer/økter til utøvere',
      'Trener-kalender + innboks',
      'Sammenligning, gruppe-trening, lag-statistikk',
    ],
  },
  {
    id: 'trener_pro', name: 'Trener Pro', priceMonthly: 279,
    priceTier: 'trener_pro', status: 'active', highlight: true,
    features: [
      'Alt i Trener Basic',
      'Ubegrenset antall utøvere',
      '3 inkluderte Athlete Pro-lisenser',
    ],
  },
  {
    id: 'trener_pro_ai', name: 'Trener Pro AI', priceMonthly: 499,
    priceTier: null, status: 'soon',
    features: [
      'Alt i Trener Pro + AI for trener og lag',
      '5 inkluderte Athlete Pro-lisenser',
      'AI-analyse på utøvere',
    ],
  },
  {
    id: 'trener_ultimate_ai', name: 'Trener Ultimate AI', priceMonthly: 999,
    priceTier: null, status: 'soon',
    features: [
      'Alt i Trener Pro AI + premium AI',
      '10 inkluderte Athlete Pro-lisenser',
      'Plan-bygging via chat eller bilde',
      'Lag-prediksjon, custom rapporter',
    ],
  },
]

const ATHLETE_ACCENT = '#FF4500'
const COACH_ACCENT = '#1A6FD4'

export default async function OnboardingAbonnementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  // Allerede aktivt abonnement → rett til dagbok (skip onboarding).
  const sub = await getActiveSubscription(supabase, user.id)
  if (hasActiveAccess(sub)) redirect('/app/dagbok')

  return (
    <main style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-12 lg:py-16">
        <div className="text-center mb-8">
          <h1 className="mb-3"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: 'clamp(32px, 5vw, 44px)', letterSpacing: '0.08em' }}>
            Velg ditt abonnement
          </h1>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '15px', letterSpacing: '0.04em' }}>
            30 dagers gratis prøve. Avslutt når som helst. Promo-kode kan brukes ved kassen.
          </p>
        </div>

        <section className="mb-10">
          <GroupHeader accent={ATHLETE_ACCENT} label="For utøvere" />
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {ATHLETE_TIERS.map(t => <TierCard key={t.id} tier={t} accent={ATHLETE_ACCENT} />)}
          </div>
        </section>

        <section className="mb-10">
          <GroupHeader accent={COACH_ACCENT} label="For trenere" />
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {TRAINER_TIERS.map(t => <TierCard key={t.id} tier={t} accent={COACH_ACCENT} />)}
          </div>
        </section>

        <p className="text-center mt-8 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Allerede har abonnement?{' '}
          <Link href="/app/dagbok" style={{ color: ATHLETE_ACCENT, textDecoration: 'underline' }}>
            Gå til Dagbok
          </Link>
        </p>
      </div>
    </main>
  )
}

function GroupHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span style={{ width: '24px', height: '3px', backgroundColor: accent, display: 'inline-block' }} />
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.08em', margin: 0 }}>
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
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.04em', margin: 0 }}>
            {tier.name}
          </h3>
          {isSoon && (
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#D4A017', border: '1px solid #D4A017',
              padding: '1px 6px', fontSize: '10px', letterSpacing: '0.08em',
              textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              🟡 Kommer
            </span>
          )}
        </div>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: accent, fontSize: '28px', letterSpacing: '0.04em', margin: 0, lineHeight: 1.1 }}>
          {tier.priceMonthly} <span style={{ fontSize: '13px', color: '#8A8A96', letterSpacing: '0.06em' }}>kr/mnd</span>
        </p>
      </div>

      <ul className="space-y-1.5 flex-1 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', lineHeight: 1.5 }}>
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span style={{ color: accent, marginTop: '1px' }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {isSoon ? (
        <a href={`mailto:support@x-pulse.no?subject=Varsle%20meg%20n%C3%A5r%20${encodeURIComponent(tier.name)}%20er%20klar`}
          className="block text-center px-4 py-3 text-xs tracking-widest uppercase transition-colors hover:bg-[#1A1A22]"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#D4A017', border: '1px solid #D4A017', textDecoration: 'none',
          }}>
          Bli varslet
        </a>
      ) : (
        <Link href={`/api/checkout?tier=${tier.priceTier}`}
          className="block text-center px-4 py-3 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: accent, color: '#FFFFFF', textDecoration: 'none',
          }}>
          Start gratis prøve
        </Link>
      )}
    </div>
  )
}
