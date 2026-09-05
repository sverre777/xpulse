import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { SportPageHero } from '@/components/landing/SportPageHero'
import { SportFeatureSection } from '@/components/landing/SportFeatureSection'
import { WaitlistSignup } from '@/components/landing/WaitlistSignup'
import { buildFeatureMetadata } from '@/lib/landing-meta'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'Klokkesync – Garmin-, COROS-, Wahoo-, Zepp-, Polar- og Strava-synk + .fit-import',
  description:
    'X-PULSE klokkesync: direktesynk fra Garmin, COROS, Wahoo og Zepp (beta) i tillegg til Strava og Polar, pluss .fit-import for alle. Auto-import, soner, splittinger og helsedata hver natt.',
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
        kicker="6 merker med direktesynk · .fit for alle"
        title={<>GARMIN, COROS, WAHOO OG ZEPP <span style={{ color: '#FF4500' }}>SYNKER NÅ<br/>DIREKTE.</span></>}
        description="Koble klokka med ett klikk - Garmin, COROS, Wahoo og Zepp er live i beta, i tillegg til Strava og Polar. Eller last opp .fit-filer fra hvilken som helst klokke, inkludert Suunto. Apple Health kommer."
        icon={<ClockIcon />}
      />

      {/* Strava gradvis-utrulling - ærlig melding, .fit fremhevet for alle. */}
      <div style={{ padding: '0 24px', marginTop: '-8px', marginBottom: 8 }}>
        <div style={{
          maxWidth: 780, margin: '0 auto', padding: '16px 22px',
          background: 'var(--kant-2)', border: '1px solid var(--kant-5)', borderLeft: '3px solid #F5C542',
          fontFamily: "'Barlow Condensed', sans-serif",
        }}>
          <div style={{ color: 'var(--tekst-1-land)', fontWeight: 700, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: '#28A86E' }}>Garmin, COROS, Wahoo og Zepp: direktesynk live</span>
            <span aria-hidden="true">🟡</span> i beta
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgb(var(--tekst-land-rgb) / 0.82)', margin: '0 0 6px' }}>
            Koble klokka én gang, så kommer nye økter og helsedata av seg selv. Synken for de fire merkene går gjennom vår klokkesynk-leverandør og er ny - derfor beta-merket. Strava og Polar er live som før.
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgb(var(--tekst-land-rgb) / 0.82)', margin: 0 }}>
            Og uansett merke kan <strong style={{ color: '#FF4500' }}>alle</strong> laste opp .fit-filer - inkludert Suunto - med full pulskurve, lap-data og sone-fordeling.
          </p>
        </div>
      </div>

      <SportFeatureSection
        kicker="Hvilke klokker"
        title="ALLE STORE LEVERANDØRER."
        intro="Vi støtter hele bredden av endurance-klokker. Direktesynk er live for Garmin, COROS, Wahoo og Zepp (beta) i tillegg til Strava og Polar - og .fit-opplasting virker for alle."
        bullets={[
          { title: 'Garmin (beta)', body: 'Direktesynk er live: økter med full pulskurve, og helsedata (søvn, HRV, hvilepuls, skritt) hver natt. Tilkobling backfyller rundt 90 dager historikk.' },
          { title: 'COROS (beta)', body: 'Direktesynk er live: økter automatisk, pluss søvn og HRV. Noe smalere helsedata enn Garmin.' },
          { title: 'Wahoo (beta)', body: 'Direktesynk er live for økter fra Element-serien.' },
          { title: 'Zepp (beta)', body: 'Direktesynk er live for økter fra Amazfit-klokkene.' },
          { title: 'Polar', body: 'Direkte-synk er live: koble til én gang, så hentes nye økter inn av seg selv. Polar gir de siste 30 dagene - eldre historikk tas med .fit-eksport fra Polar Flow.' },
          { title: 'Apple Watch', body: 'Apple Health-eksport via iOS-app. Direkte-synk kommer.' },
          { title: 'Suunto', body: '.fit-import virker i dag - eksporter fra Suunto-appen og last opp.' },
        ]}
      />

      <SportFeatureSection
        kicker="Hvordan virker det"
        title="FIRE STIER INN."
        intro="Vi treffer deg der du er. Har du Garmin, COROS, Wahoo, Zepp, Strava eller Polar, er du på lufta i dag - og .fit-import dekker resten."
        bullets={[
          { title: 'Direktesynk (beta, auto)', body: 'Garmin, COROS, Wahoo og Zepp: koble til én gang via vår klokkesynk-leverandør. Nye økter kommer som original-FIT med alle felter, og helsedata følger med der klokka har dem.' },
          { title: 'Strava OAuth (auto)', body: 'Koble til Strava én gang - alle nye økter synkes automatisk innen 5 minutter.' },
          { title: 'Polar (auto)', body: 'Koble til Polar én gang. Nye økter varsles til oss direkte fra Polar Flow og hentes inn automatisk, med sikkerhetsnett som fanger opp resten.' },
          { title: '.fit-opplasting (alle)', body: 'Last opp .fit-filer manuelt eller drag-drop. Auto-detekterer aktivitet, sone-tid og høydemeter.' },
        ]}
      />

      <SportFeatureSection
        kicker="Hvordan vi håndterer dine data"
        title="HVERT MERKE HAR SINE REGLER."
        intro="Reglene følger kilden, og vi sier tydelig fra hvilke som gjelder hvor. Stravas API-vilkår krever at rå data slettes etter 7 dager og at all importert Strava-data slettes ved frakobling. Polar har ingen 7-dagers-frist, men gir kun de siste 30 dagene. Bruker du .fit-opplasting? Da bestemmer du selv - ingen eksterne regler."
        bullets={[
          { title: 'Garmin · COROS · Wahoo · Zepp (beta)', body: 'Original-FIT direkte fra klokka via vår klokkesynk-leverandør. Økta er din - vi sletter ikke automatisk. Frakobling stopper nye økter; det som alt er importert, står i dagboka di. Detaljer i personvernerklæringen.' },
          { title: 'Strava OAuth', body: 'Rå sample-data (sekund-puls, GPS, watt-strøm) slettes etter 7 dager. Aggregert vises permanent så lenge Strava er koblet. Ved frakobling: alt slettes innen 48t.' },
          { title: 'Polar', body: 'Ingen 7-dagers-frist på rådata. Polar gir kun økter fra siste 30 dager, og kun de som lastes opp etter at du koblet til. Ved frakobling slettes alle Polar-importerte økter, og X-PULSE avregistreres hos Polar. Datakilde: Polar Ecosystem.' },
          { title: '.fit-opplasting', body: 'Dine egne data, ingen eksterne regler. Permanent lagring av alt inkludert sekund-data.' },
        ]}
      />

      <SportFeatureSection
        kicker="Hva synken gir deg"
        title="MER ENN RASKERE IMPORT."
        intro="Direktesynk gir detaljene .fit-eksport ikke alltid har med - og helsedata klokka aldri eksporterer som fil: søvnfaser, natt-HRV og hvilepuls lander i helse-loggen hver natt, automatisk."
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
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgb(var(--tekst-land-rgb) / 0.62)', maxWidth: 460 }}>
              Garmin, COROS, Wahoo, Zepp (beta), Strava og Polar er live nå. Skriv inn
              e-postadressen så får du beskjed når Apple Health-koblingen åpner.
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
