import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingShell } from '@/components/landing/LandingShell'
import { SportPageHero } from '@/components/landing/SportPageHero'
import { SportFeatureSection } from '@/components/landing/SportFeatureSection'
import { WaitlistSignup } from '@/components/landing/WaitlistSignup'
import { buildFeatureMetadata } from '@/lib/landing-meta'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'AI Coach',
  description:
    'X-PULSE AI Coach (kommer Q3 2026): auto-tolkning av økter etter klokkesync, smart anbefalinger basert på dine data, anbefalte økter ut fra form og mål, ukesoppsummeringer og korrelasjons-innsikt.',
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
        kicker="AI Coach — kommer Q3 2026"
        title={<>AI-DREVET<br/><span style={{ color: '#FF4500' }}>TRENINGS-INNSIKT.</span></>}
        description="En AI som leser dine data, dine kommentarer og dine mønstre — og blir smartere for hver økt du logger. Modulen lanseres Q3 2026 sammen med direkte klokkesync. Bli varslet ved lansering."
        icon={<AiCoachIcon />}
        backgroundImage="/photos/DSC09222_thumb.jpg"
      />

      <SportFeatureSection
        kicker="Hva blir mulig"
        title="AUTO-TOLKNING AV ØKTER."
        intro="Etter klokkesync kommer dataene inn rå. AI-en tolker øktstrukturen — gjenkjenner intervaller, varierende intensitet, drag-mønster — og fyller ut lap-typer automatisk. Du bekrefter eller justerer."
        bullets={[
          { title: 'Lap-type-deteksjon', body: 'Sone, varighet og puls-mønster avslører om dette var et 4×8-min I4-drag eller en jevn I2-langtur.' },
          { title: 'Plan-match', body: 'Sammenligner gjennomføring mot planlagt økt — hvor traff du, hvor avvek du, og hvorfor (puls-rate, terreng).' },
          { title: 'Subjektive notater', body: 'Brukeren-skrevne kommentarer parses for stikkord ("dårlig form", "kald", "presset for hardt") og kobles til datapunkter.' },
        ]}
      />

      <SportFeatureSection
        kicker="Smart anbefalinger"
        title="ANBEFALTE ØKTER."
        intro="Basert på din nåværende form (CTL/ATL/TSB), kommende konkurranser og søvn/HRV-trend foreslår AI-en hva neste økt bør være. Ikke generiske 'i dag bør du løpe lett'-tips — konkrete drag-strukturer i din typiske tone."
        bullets={[
          { title: 'Form-tilpasset', body: 'Hvis TSB er negativ foreslås rolig økt; hvis du er på vei mot peak foreslås race-pace-drag.' },
          { title: 'Mål-orientert', body: 'Sesong-mål påvirker forslaget — peaking mot Birken gir andre økter enn peaking mot 5K.' },
          { title: 'Personlig terskel', body: 'AI-en lærer dine egne grenser — f.eks. "Sveco trenger 3 dager etter en hard I4-økt for å gå hardt igjen".' },
        ]}
      />

      <SportFeatureSection
        kicker="Auto-rapport"
        title="UKESOPPSUMMERINGER."
        intro="Hver søndag får du (og treneren din, hvis du har en) en ukesoppsummering: hva du gjorde, hva som skiller seg ut fra forrige uke, og hvilke trender som tegner seg. Klar tekst, ikke bare tall."
        bullets={[
          { title: 'Volum og fordeling', body: 'Total tid, sonefordeling, sammenligning mot forrige uke og samme uke i fjor.' },
          { title: 'Avvik fra plan', body: 'Hvor traff du, hvor falt du av — og om treneren bør justere fremover.' },
          { title: 'Form-prognose', body: 'Hvor er du på vei? Estimat for TSB om 2-4 uker hvis treningen fortsetter som nå.' },
        ]}
      />

      <SportFeatureSection
        kicker="Korrelasjons-innsikt"
        title="HVORFOR PRESTERER DU BEDRE?"
        intro="AI-en finner sammenhenger i dine egne data over måneder. Ikke generiske råd — personlige terskler basert på dine tall."
        bullets={[
          { title: 'HRV-prestasjons-mønstre', body: 'F.eks. "dine beste dager er når HRV > 65 og du har sovet > 7.5 t to netter på rad".' },
          { title: 'Belastnings-utbrenthets-grenser', body: 'AI-en finner din egen "for mye"-terskel basert på tidligere overtrenings-perioder.' },
          { title: 'Sesong-til-sesong', body: 'Sammenligning av tilsvarende uker over år — er du foran eller bak fjorårets forberedelse?' },
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
              GI BESKJED NÅR<br/>AI COACH ÅPNER.
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,240,236,0.62)', maxWidth: 460 }}>
              Q3 2026 lanseres modulen for både utøvere (Athlete Pro AI · 129 kr/mnd) og
              trenere (Trener Pro AI · 499 kr/mnd). Beta-tilgang prioriteres til de på listen.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/xpulse.html#priser"
                style={{
                  color: '#F2F0EC', padding: '10px 18px',
                  border: '1px solid #262629', textDecoration: 'none',
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                  fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
                }}>
                Se Pro AI-priser
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
