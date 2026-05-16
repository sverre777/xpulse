import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingShell } from '@/components/landing/LandingShell'
import { SportPageHero } from '@/components/landing/SportPageHero'
import { SportFeatureSection } from '@/components/landing/SportFeatureSection'
import { WaitlistSignup } from '@/components/landing/WaitlistSignup'
import { buildFeatureMetadata } from '@/lib/landing-meta'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'AI-Coach',
  description:
    'X-PULSE AI-Coach (kommer Q4 2026): personlig coach som forstår deg, lærer av deg, og handler etter din vilje. Du bestemmer engasjement-nivå — fra verktøy til full autopilot. Dagbok via chat, bilde-import, adaptive planer.',
  path: '/funksjoner/ai-coach',
})

function AiCoachIcon() {
  return (
    <svg viewBox="0 0 48 48" width={140} height={140} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* Hjerne / krets — abstrakt AI-symbol */}
      <circle cx="24" cy="24" r="14" />
      <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none" />
      <path d="M24 10 V14" />
      <path d="M24 34 V38" />
      <path d="M10 24 H14" />
      <path d="M34 24 H38" />
      <path d="M14 14 L17 17" />
      <path d="M31 17 L34 14" />
      <path d="M14 34 L17 31" />
      <path d="M31 31 L34 34" />
      {/* Indre noder */}
      <circle cx="18" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="30" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="24" cy="30" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function AiCoachPage() {
  return (
    <LandingShell>
      <SportPageHero
        kicker="AI-Coach 🟡 Kommer snart"
        title={<>AI-COACH<br/><span style={{ color: '#FF4500' }}>SOM FORSTÅR DEG.</span></>}
        description="Få en personlig coach som forstår deg, lærer av deg, og handler etter din vilje. Du bestemmer hvor mye AI-en gjør for deg — fra enkelt verktøy til full autopilot. Du kan skrive en setning og få økten lagt inn i dagboken, eller la AI-en justere planen din automatisk basert på hvordan du føler deg. Personvernet ditt er alltid under din kontroll."
        icon={<AiCoachIcon />}
        backgroundImage="/photos/DSC09222_thumb.jpg"
      />

      <SportFeatureSection
        kicker="Athlete Pro AI · 129 kr/mnd 🟡"
        title="DET DU FÅR MED PRO AI."
        intro="Claude Haiku gjør auto-tolkning av økter, gir korte innsikter og finner korrelasjoner i dataene dine. Ingen chat eller plangenerering — det får du i Ultimate."
        bullets={[
          { title: 'Auto-tagging av lap', body: 'Oppvarming, intervall, pause, nedjogg — AI gjenkjenner mønsteret og merker hver lap.' },
          { title: 'Ukentlig sammendrag', body: 'Hver søndag: hva du gjorde, hva som skiller seg fra forrige uke, hvilke trender tegner seg.' },
          { title: 'Korrelasjon-analyse', body: 'HRV vs prestasjon, søvn vs energi, belastning vs sykdom — sammenhenger AI finner i dine egne tall.' },
        ]}
      />

      <SportFeatureSection
        kicker="Athlete Ultimate AI · 399 kr/mnd 🟡"
        title="DET DU FÅR MED ULTIMATE AI."
        intro="Claude Sonnet/Opus med full long-term memory. Chat 24/7, dagbok via tekst eller bilde, komplett plangenerering, adaptive planer som justerer seg ved sykdom eller dårlige dager."
        bullets={[
          { title: 'Chat med AI-coach 24/7', body: 'Kun treningsrelatert — off-topic avvises høflig. AI husker hele treningshistorikken og samtaler.' },
          { title: 'Dagbok via chat', body: 'Skriv "Var ute en time, kjente meg sliten" — økten kommer rett i dagboken. Hvis klokkesync har en økt samme dag, knyttes de automatisk.' },
          { title: 'Bilde/PDF/lyd-import', body: 'Ta bilde av håndskrevet dagbok, send konkurransekalender som PDF, eller spill inn lyd-notat — AI tolker og legger inn.' },
          { title: 'Komplett plangenerering', body: 'Skriv "Lag en 12-ukers plan mot Birken" — AI bygger basert på dine mål, sport, historikk og periodisering.' },
          { title: 'Adaptiv plan', body: '"Jeg er forkjølet" → AI omorganiserer kommende uke. Justerer seg automatisk ved sykdom, dårlige dager, prestasjon-endring.' },
          { title: 'Custom-grafer på forespørsel', body: '"Vis meg pace ved 150 bpm siste 3 mnd" — AI bygger grafen direkte. Pluss prestasjon-prediksjon og morgen-brief.' },
        ]}
      />

      <SportFeatureSection
        kicker="Trener Ultimate AI · 999 kr/mnd 🟡"
        title="DET TRENERE FÅR MED ULTIMATE."
        intro="Premium AI bygd for trener-arbeid. Plan-bygging via chat eller bilde, lag-prediksjon, adaptive lag-planer, custom rapporter for sponsorer."
        bullets={[
          { title: 'Plan-bygging via chat eller bilde', body: 'Skriv "Lag 4-ukers grunnperiode for utøver X med 3 økter/uke" eller ta bilde av en håndskrevet plan — AI lager den og legger i utøverens plan.' },
          { title: 'Velg hvem AI pusher til', body: '"Push denne planen til Anna, Per og Lise" — AI pusher kun til de tre, ikke hele laget.' },
          { title: 'Lag-prediksjon', body: '"Hvem av utøverne mine bør jeg gi en hard intervalløkt i morgen?" — AI svarer basert på belastning, prestasjon, restitusjon.' },
          { title: 'Adaptive lag-planer', body: 'AI justerer planer for hele laget basert på fellestreninger, konkurranser, sesongfase.' },
          { title: 'Custom rapporter', body: '"Lag en rapport for sponsor om Annas utvikling siste 6 mnd" — AI genererer PDF.' },
        ]}
      />

      <SportFeatureSection
        kicker="Du er alltid i kontroll"
        title="ENGASJEMENT-VELGER + PERSONVERN."
        intro="Du bestemmer hvor mye AI gjør, og hva den ser. Bytt mellom Verktøy-, Coach- eller Autopilot-modus + granulære toggles per funksjon. Personvern-toggles for hver datakategori."
        bullets={[
          { title: 'Verktøy-modus', body: 'AI svarer kun når du spør. Ingen auto-handlinger.' },
          { title: 'Coach-modus', body: 'AI gir proaktive anbefalinger og kommentarer, men du må bekrefte alle endringer.' },
          { title: 'Autopilot-modus', body: 'AI fører dagbok, justerer planen og tagger økter automatisk. Du kan overstyre når som helst.' },
          { title: 'Granulære toggles', body: 'Slå av/på per funksjon: dagbok-skriving, plan-endring, morgen-brief, økt-kommentar, lap-tagging, klokkesync-kobling.' },
          { title: 'Personvern per datakategori', body: 'Velg hva AI ser: treningsøkter, helsedata (HRV/søvn/vekt), notater, konkurranseresultater, fysiologiske tester.' },
          { title: 'Trener-tilkobling', body: 'For Ultimate AI med trener: velg om treneren kan se AI-svar og chat-historikken (default: AV).' },
          { title: 'Lovkrav', body: 'AI-data brukes ALDRI til modelltrening på Strava-data (Strava API Agreement § 2.14.4).' },
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
              GI BESKJED NÅR<br/>AI-COACH ÅPNER.
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,240,236,0.62)', maxWidth: 460 }}>
              Forventet lansering Q4 2026. Modulen kommer for utøvere (Pro AI · 129 og Ultimate AI · 399 kr/mnd)
              og trenere (Pro AI · 499 og Ultimate AI · 999 kr/mnd). Beta-tilgang prioriteres til de på listen.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/pris"
                style={{
                  color: '#F2F0EC', padding: '10px 18px',
                  border: '1px solid #262629', textDecoration: 'none',
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                  fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
                }}>
                Se alle priser
              </Link>
            </div>
          </div>
          <WaitlistSignup
            feature="athlete_pro_ai"
            label="Din e-postadresse"
            cta="Bli varslet"
            intro="Skriv inn e-postadressen så får du beskjed når AI Coach åpner — du blir også prioritert i beta-tilgangen."
          />
        </div>
      </section>
    </LandingShell>
  )
}
