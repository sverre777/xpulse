import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingShell } from '@/components/landing/LandingShell'
import { SportPageHero } from '@/components/landing/SportPageHero'
import { SportFeatureSection, SportPageCTA } from '@/components/landing/SportFeatureSection'
import { buildFeatureMetadata } from '@/lib/landing-meta'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'Trener',
  description:
    'X-PULSE trener-modul: utøveroversikt, plan- og årsplan-maler med push, kommentarer og direktemeldinger, sammenligning av utøvere, skipark-tilsyn og fleksibel pristier (Basic / Pro / Pro AI).',
  path: '/funksjoner/trener',
})

function TrenerIcon() {
  return (
    <svg viewBox="0 0 48 48" width={140} height={140} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="24" cy="14" r="5" />
      <path d="M14 38 Q14 28 24 28 Q34 28 34 38" />
      <path d="M6 24 H12" />
      <path d="M36 24 H42" />
      <path d="M9 18 L13 22" />
      <path d="M39 18 L35 22" />
    </svg>
  )
}

export default function TrenerPage() {
  return (
    <LandingShell>
      <SportPageHero
        kicker="For trenere"
        title={<>SPAR TID MED <span style={{ color: '#1A6FD4' }}>X-PULSE TRENER.</span></>}
        description="Trener-modulen er ikke en utøver-app du må omgå. Den er bygget rundt jobben treneren faktisk gjør — overvåke et helt lag, push planer raskt og holde direkte dialog med hver utøver."
        icon={<TrenerIcon />}
        backgroundImage="/photos/DSC08247-2_thumb.jpg"
      />

      <SportFeatureSection
        accent="blue"
        kicker="Utøveroversikt"
        title="HELE TROPPEN — ÉN SIDE."
        intro="Trener-panelet viser alle utøvere du følger: navn, gren, siste økt, ukentlig volum, eventuelle varsler. Klikk på en utøver så åpnes deres dagbok i samme vinkel som deres egen visning — ingen kontekst-bytte."
        bullets={[
          { title: 'Status-kolonner', body: 'Siste økt, uke-volum, status (på plan / bak plan / over plan), dagsform.' },
          { title: 'Varsler', body: 'Røde flagg ved høy belastning, dårlig recovery eller manglende logging.' },
          { title: 'Utøver-detalj-modal', body: 'Klikk åpner full dagbok-uke for utøveren — du ser hva de ser.' },
        ]}
      />

      <SportFeatureSection
        accent="blue"
        kicker="Maler og push"
        title="ÉN PLAN — MANGE UTØVERE."
        intro="Bygg én plan-mal eller årsplan-mal og push den til utvalgte utøvere eller hele grupper. Hver mottaker får sin egen kopi med personlige konkurransedatoer; endringer på malen ramler ikke automatisk inn — du velger om de skal pushes."
        bullets={[
          { title: 'Plan-mal', body: 'Uke- eller måned-mal med øktstruktur som kan pushes til mange utøvere samtidig.' },
          { title: 'Årsplan-mal', body: 'Sesongstruktur med faser, peak-target og konkurransekalender — kopieres med justering på datoer.' },
          { title: 'Selektiv push', body: 'Velg hvilke utøvere som skal motta og se forhåndsvisning før push.' },
        ]}
      />

      <SportFeatureSection
        accent="blue"
        kicker="Kommunikasjon"
        title="KOMMENTARER OG DM."
        intro="Kommentarene ligger på øktnivå — utøveren ser dem ved siden av sin egen logging, ikke i en separat innboks. Ren dialog, ingen e-post-tråder eller WhatsApp-kaos."
        bullets={[
          { title: 'Kommentar per økt', body: 'Trener kan kommentere før, under og etter økten; utøver svarer i samme tråd.' },
          { title: 'Direktemelding', body: 'Privat trådsamtale per utøver for det som ikke hører hjemme på en økt.' },
          { title: 'Lese-kvittering', body: 'Se når utøveren har lest kommentaren; varsel hvis ingen aktivitet på en uke.' },
        ]}
      />

      <SportFeatureSection
        accent="blue"
        kicker="Sammenligning"
        title="2 TIL N UTØVERE — SIDE OM SIDE."
        intro="Sammenlignings-modulen plotter belastning, sonefordeling, test-utvikling og andre KPI-er for opp til N utøvere i samme graf. Pro-tier; ikke i Basic."
        bullets={[
          { title: 'Multi-akse-sammenligning', body: 'CTL/ATL/TSB, sone-tid, distanse, høydemeter — flere akser kan plottes samtidig.' },
          { title: 'Test-PR-rangering', body: 'Liste-form for hvem som har best/dårligst på en gitt test.' },
          { title: 'Lagrede oppsett', body: 'Sammenlignings-konfigurasjoner kan lagres og gjenåpnes raskt.' },
        ]}
      />

      <SportFeatureSection
        accent="blue"
        kicker="Skipark-tilsyn"
        title="FOR LANGRENN-TRENERE."
        intro="Følg ski-tester per utøver, registrer dagens føre og forhold for hele laget på en konkurransedag. En egen modul som kobler skipark-data til lag-kontekst."
        bullets={[
          { title: 'Lag-skipark', body: 'Se ski-merker, slip og smøring per utøver i én tabell.' },
          { title: 'Konkurranse-dag-logg', body: 'Registrer føre, snøtype, lufttemp én gang for hele laget.' },
          { title: 'Test-resultat-deling', body: 'Trener kan dele "raskest ski under disse forholdene" med utøvere.' },
        ]}
      />

      <section className="px-6 lg:px-14 py-20 md:py-24"
        style={{ borderTop: '1px solid #1A1A1E', background: '#0D0D11' }}>
        <div className="max-w-[1240px] mx-auto">
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
            fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase',
            color: '#1A6FD4', marginBottom: 18, display: 'flex',
            alignItems: 'center', gap: 12,
          }}>
            <span style={{ width: 28, height: 1, background: '#1A6FD4' }} />
            Tre tier-er for trenere
          </div>
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 0.95,
            letterSpacing: '0.05em', color: '#F2F0EC', marginBottom: 32,
          }}>
            VELG NIVÅET SOM PASSER LAGET DITT.
          </h2>
          <div className="grid gap-px md:grid-cols-3" style={{ background: '#262629' }}>
            <TierCard tier="Basic" price="199 kr/mnd"
              points={['Maks 10 utøvere', '0 inkluderte lisenser', 'Plan- og årsplan-maler', 'Kommentarer og DM', 'Grupper']} />
            <TierCard tier="Pro" price="279 kr/mnd" featured
              points={['Ubegrenset utøvere', '5 inkluderte lisenser', 'Egen Athlete Pro-profil', 'Sammenligning av utøvere', 'Alt i Basic']} />
            <TierCard tier="Pro AI" price="499 kr/mnd" coming
              points={['10 inkluderte lisenser', 'AI-analyse på utøveres data', 'Auto-ukesoppsummeringer', 'AI-anbefalinger per utøver', 'Alt i Pro']} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app/registrer?role=coach&amp;tier=pro"
              style={{
                background: '#FF4500', color: '#F2F0EC', padding: '14px 28px',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase',
                textDecoration: 'none',
              }}>
              Start trener-prøve (Pro)
            </Link>
            <Link href="/xpulse.html#priser"
              style={{
                color: '#F2F0EC', padding: '14px 28px',
                border: '1px solid #262629', textDecoration: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase',
              }}>
              Se full prissammenligning
            </Link>
          </div>
        </div>
      </section>

      <SportPageCTA
        title="Start trener-prøve"
        subtitle="Trener Pro inkluderer 5 Athlete Pro-lisenser — egen profil for deg som trener og 4 utøvere."
        href="/app/registrer?role=coach&tier=pro"
        label="Start gratis prøve (Pro)"
      />
    </LandingShell>
  )
}

function TierCard({
  tier, price, points, featured, coming,
}: {
  tier: string; price: string; points: string[]; featured?: boolean; coming?: boolean
}) {
  return (
    <div style={{
      background: featured ? '#191317' : '#1A1A1E',
      padding: 28, position: 'relative',
      borderTop: featured ? '2px solid #FF4500' : '2px solid transparent',
      opacity: coming ? 0.78 : 1,
    }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
        fontSize: 13, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: '#F2F0EC', marginBottom: 12,
      }}>
        {tier}
        {coming && (
          <span style={{
            marginLeft: 8, padding: '2px 8px',
            background: 'rgba(245,197,66,0.18)', color: '#F5C542',
            border: '1px solid rgba(245,197,66,0.4)',
            fontSize: 9, letterSpacing: '0.18em',
          }}>
            Kommer snart
          </span>
        )}
      </div>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 36,
        letterSpacing: '0.04em', color: '#F2F0EC', marginBottom: 18,
      }}>
        {price}
      </div>
      <ul className="list-none p-0 flex flex-col gap-2">
        {points.map(p => (
          <li key={p} style={{
            fontSize: 13, lineHeight: 1.6, color: 'rgba(242,240,236,0.62)',
            paddingLeft: 18, position: 'relative',
          }}>
            <span style={{
              position: 'absolute', left: 0,
              color: featured ? '#FF4500' : '#1A6FD4', fontWeight: 700,
            }}>✓</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}
