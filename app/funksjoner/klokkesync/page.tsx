import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { SportPageHero } from '@/components/landing/SportPageHero'
import { SportFeatureSection } from '@/components/landing/SportFeatureSection'
import { WaitlistSignup } from '@/components/landing/WaitlistSignup'
import { buildFeatureMetadata } from '@/lib/landing-meta'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'Klokkesync',
  description:
    'X-PULSE klokkesync (Q3 2026): .fit-import for alle, Strava OAuth-synk, Garmin Connect direkte. Auto-import, soner, splittinger og AI-tolkning når synken er på plass.',
  path: '/funksjoner/klokkesync',
})

function ClockIcon() {
  return (
    <svg viewBox="0 0 48 48" width={140} height={140} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="24" cy="24" r="18" />
      <path d="M24 12 V24 L32 28" />
      <path d="M24 4 V8" />
      <path d="M24 40 V44" />
      <path d="M4 24 H8" />
      <path d="M40 24 H44" />
    </svg>
  )
}

export default function KlokkesyncPage() {
  return (
    <LandingShell>
      <SportPageHero
        kicker="Strava + .fit i dag · direkte Q3 2026"
        title={<>STRAVA OG <span style={{ color: '#FF4500' }}>.FIT-OPPLASTING<br/>VIRKER NÅ.</span></>}
        description="Du er på lufta i dag — koble Strava OAuth med ett klikk eller last opp .fit-filer fra hvilken som helst klokke. Direkte-synk for Garmin, Apple Health, Polar og Coros åpner Q3 2026."
        icon={<ClockIcon />}
      />

      <SportFeatureSection
        kicker="Hvilke klokker"
        title="ALLE STORE LEVERANDØRER."
        intro="Vi tar støtte for hele bredden av endurance-klokker. Per i dag fungerer .fit-opplasting og Strava OAuth; direkte-synk via Garmin Connect og Apple Health legger seg på Q3 2026, med Polar og Coros like etter."
        bullets={[
          { title: 'Garmin', body: 'Connect-API direkte-synk Q3 2026. .fit-import virker i dag for alle Garmin-modeller.' },
          { title: 'Apple Watch', body: 'Apple Health-eksport via iOS-app. Direkte-synk i Q3 2026.' },
          { title: 'Polar', body: 'Polar Flow-eksport som .fit fungerer; direkte-synk vurderes Q3-Q4 2026.' },
          { title: 'Coros', body: '.fit-import via Coros-app eller direkte fra klokken. Direkte-synk Q4 2026.' },
          { title: 'Wahoo', body: '.fit-import fra Wahoo Element-serien. Strava-omveien fungerer også.' },
        ]}
      />

      <SportFeatureSection
        kicker="Hvordan virker det"
        title="TRE STIER INN."
        intro="Vi treffer deg der du er. Hvis du har Strava er du på lufta i dag. Hvis du har en Garmin og venter på direkte-synk: bruk .fit-import inntil videre — du mister ingenting når direkte-synken slås på."
        bullets={[
          { title: '.fit-opplasting (alle)', body: 'Last opp .fit-filer manuelt eller drag-drop. Auto-detekterer aktivitet, sone-tid og høydemeter.' },
          { title: 'Strava OAuth (auto)', body: 'Koble til Strava én gang — alle nye økter synkes automatisk innen 5 minutter.' },
          { title: 'Garmin direkte (Q3 2026)', body: 'Direkte API-tilgang så data kommer uten Strava-omvei og inkluderer alle felter (ikke bare det Strava eksponerer).' },
        ]}
      />

      <SportFeatureSection
        kicker="Hva blir mulig"
        title="NÅR SYNKEN ER PÅ PLASS."
        intro="Direkte-synk åpner ikke bare for raskere import — det gir oss tilgang til detaljer som .fit ikke alltid har. Effekt-balanse, løpe-dynamikk, sove-faser og temperatur kommer med."
        bullets={[
          { title: 'Auto-import', body: 'Gjennomført økt synkes innen minutter. Ingen manuell jobb.' },
          { title: 'Auto-soner', body: 'Sone-tid regnes fra hjertepuls + dine personlige soner; kvalitetssjekk på avvik.' },
          { title: 'Splitt aktiviteter', body: 'Multi-disiplin-økter (brick, triatlon) kan auto-splittes fra .fit-data.' },
          { title: 'AI-tolkning', body: 'Klokken beskriver hva du gjorde; AI-tier-tolker setter det inn i kontekst.' },
        ]}
      />

      <section className="px-6 lg:px-14 py-20 md:py-24"
        style={{ borderTop: '1px solid #1A1A1E' }}>
        <div className="max-w-[1240px] mx-auto grid gap-12 md:grid-cols-2 items-start">
          <div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase',
              color: '#FF4500', marginBottom: 18, display: 'flex',
              alignItems: 'center', gap: 12,
            }}>
              <span style={{ width: 28, height: 1, background: '#FF4500' }} />
              Bli varslet
            </div>
            <h2 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 0.95,
              letterSpacing: '0.05em', color: '#F2F0EC', marginBottom: 18,
            }}>
              GI BESKJED NÅR<br/>KLOKKESYNC ÅPNER.
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,240,236,0.62)', maxWidth: 460 }}>
              Skriv inn e-postadressen så får du beskjed når Garmin-, Apple Health- og direkte-koblingene
              åpner. Du blir også prioritert i beta-tilgangen.
            </p>
          </div>
          <WaitlistSignup
            feature="klokkesync"
            label="Din e-postadresse"
            cta="Bli varslet"
          />
        </div>
      </section>
    </LandingShell>
  )
}
