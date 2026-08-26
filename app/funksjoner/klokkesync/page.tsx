import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { SportPageHero } from '@/components/landing/SportPageHero'
import { SportFeatureSection } from '@/components/landing/SportFeatureSection'
import { WaitlistSignup } from '@/components/landing/WaitlistSignup'
import { buildFeatureMetadata } from '@/lib/landing-meta'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'Klokkesync – Strava- og Polar-synk + .fit-import fra alle klokker',
  description:
    'X-PULSE klokkesync: .fit-import for alle, direkte-synk fra Strava og Polar, Garmin Connect kommer snart. Auto-import, soner, splittinger og AI-tolkning når synken er på plass.',
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
        kicker="Strava, Polar og .fit i dag · flere merker kommer"
        title={<>STRAVA, POLAR OG <span style={{ color: '#FF4500' }}>.FIT-OPPLASTING<br/>VIRKER NÅ.</span></>}
        description="Du er på lufta i dag — koble til Strava eller Polar med ett klikk, eller last opp .fit-filer fra hvilken som helst klokke. Direkte-synk for Garmin, Apple Health og Coros kommer snart."
        icon={<ClockIcon />}
      />

      {/* Strava gradvis-utrulling — ærlig melding, .fit fremhevet for alle. */}
      <div style={{ padding: '0 24px', marginTop: '-8px', marginBottom: 8 }}>
        <div style={{
          maxWidth: 780, margin: '0 auto', padding: '16px 22px',
          background: 'var(--kant-2)', border: '1px solid var(--kant-5)', borderLeft: '3px solid #F5C542',
          fontFamily: "'Barlow Condensed', sans-serif",
        }}>
          <div style={{ color: 'var(--tekst-1-land)', fontWeight: 700, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span aria-hidden="true">🟡</span> Strava-sync rulles ut gradvis
            <span style={{ color: '#28A86E' }}>· Polar-synk live nå!</span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(242,240,236,0.6)', margin: '0 0 6px' }}>
            Direkte Strava-synkronisering er i utrulling og tilgjengelig for et begrenset antall brukere nå mens vi utvider kapasiteten. Full tilgang for alle kommer snart.
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(242,240,236,0.82)', margin: 0 }}>
            I mellomtiden kan <strong style={{ color: '#FF4500' }}>alle</strong> laste opp .fit-filer fra Strava, Garmin, Polar, Coros, Suunto og Wahoo — med full pulskurve, lap-data og sone-fordeling.
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(242,240,236,0.82)', margin: '6px 0 0' }}>
            <strong style={{ color: '#28A86E' }}>Polar-synk er live</strong> — direkte-tilkobling mot Polar Flow er åpen for alle, uten utrulling og uten venteliste.
          </p>
        </div>
      </div>

      <SportFeatureSection
        kicker="Hvilke klokker"
        title="ALLE STORE LEVERANDØRER."
        intro="Vi tar støtte for hele bredden av endurance-klokker. Per i dag fungerer .fit-opplasting, Strava OAuth og direkte-synk fra Polar; Garmin Connect og Apple Health kommer snart, med Coros like etter."
        bullets={[
          { title: 'Garmin', body: 'Connect-API direkte-synk kommer snart. .fit-import virker i dag for alle Garmin-modeller.' },
          { title: 'Apple Watch', body: 'Apple Health-eksport via iOS-app. Direkte-synk kommer snart.' },
          { title: 'Polar', body: 'Direkte-synk er live: koble til én gang, så hentes nye økter inn av seg selv. Polar gir de siste 30 dagene — eldre historikk tas med .fit-eksport fra Polar Flow.' },
          { title: 'Coros', body: '.fit-import via Coros-app eller direkte fra klokken. Direkte-synk kommer snart.' },
          { title: 'Wahoo', body: '.fit-import fra Wahoo Element-serien. Strava-omveien fungerer også.' },
        ]}
      />

      <SportFeatureSection
        kicker="Hvordan virker det"
        title="FIRE STIER INN."
        intro="Vi treffer deg der du er. Har du Strava eller Polar, er du på lufta i dag. Venter du på Garmin-synk: bruk .fit-import inntil videre — du mister ingenting når direkte-synken slås på."
        bullets={[
          { title: '.fit-opplasting (alle)', body: 'Last opp .fit-filer manuelt eller drag-drop. Auto-detekterer aktivitet, sone-tid og høydemeter.' },
          { title: 'Strava OAuth (auto)', body: 'Koble til Strava én gang — alle nye økter synkes automatisk innen 5 minutter.' },
          { title: 'Polar (auto)', body: 'Koble til Polar én gang. Nye økter varsles til oss direkte fra Polar Flow og hentes inn automatisk, med sikkerhetsnett som fanger opp resten.' },
          { title: 'Garmin direkte (kommer snart)', body: 'Direkte API-tilgang så data kommer uten Strava-omvei og inkluderer alle felter (ikke bare det Strava eksponerer).' },
        ]}
      />

      <SportFeatureSection
        kicker="Hvordan vi håndterer dine data"
        title="HVERT MERKE HAR SINE REGLER."
        intro="Reglene følger kilden, og vi sier tydelig fra hvilke som gjelder hvor. Stravas API-vilkår krever at rå data slettes etter 7 dager og at all importert Strava-data slettes ved frakobling. Polar har ingen 7-dagers-frist, men gir kun de siste 30 dagene. Bruker du .fit-opplasting? Da bestemmer du selv — ingen eksterne regler."
        bullets={[
          { title: 'Strava OAuth', body: 'Rå sample-data (sekund-puls, GPS, watt-strøm) slettes etter 7 dager. Aggregert vises permanent så lenge Strava er koblet. Ved frakobling: alt slettes innen 48t.' },
          { title: 'Polar', body: 'Ingen 7-dagers-frist på rådata. Polar gir kun økter fra siste 30 dager, og kun de som lastes opp etter at du koblet til. Ved frakobling slettes alle Polar-importerte økter, og X-PULSE avregistreres hos Polar. Datakilde: Polar Ecosystem.' },
          { title: '.fit-opplasting', body: 'Dine egne data, ingen eksterne regler. Permanent lagring av alt inkludert sekund-data.' },
          { title: 'Garmin direkte (kommer snart)', body: 'Direkte fra klokken via Garmin Connect. Du eier dataene fullt ut — vi sletter ikke automatisk.' },
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
        style={{ borderTop: '1px solid var(--kant-2)' }}>
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
              letterSpacing: '0.05em', color: 'var(--tekst-1-land)', marginBottom: 18,
            }}>
              GI BESKJED NÅR<br/>FLERE MERKER ÅPNER.
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,240,236,0.62)', maxWidth: 460 }}>
              Strava og Polar er live nå. Skriv inn e-postadressen så får du beskjed når Garmin-,
              Apple Health- og Coros-koblingene åpner. Du blir også prioritert i beta-tilgangen.
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
