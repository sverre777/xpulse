import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingSnarvei } from '@/components/landing/LandingSnarvei'
import { LandingSeksjon } from '@/components/landing/LandingSeksjon'
import { LandingFaq } from '@/components/landing/LandingFaq'
import { AndreIdretter } from '@/components/landing/AndreIdretter'
import { LandingBand } from '@/components/landing/LandingBand'
import { WaitlistSignup } from '@/components/landing/WaitlistSignup'
import { buildFeatureMetadata } from '@/lib/landing-meta'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'AI Coach - kommer',
  description:
    'AI Coach i X-PULSE er under arbeid: tolkning av økter, ukesammendrag, chat om egen trening og planforslag. Ingenting av dette er live ennå - meld deg på ventelista.',
  path: '/funksjoner/ai-coach',
})

const SNARVEIER = [
  { id: 'status', navn: 'Status' },
  { id: 'planen', navn: 'Planen' },
  { id: 'kontroll', navn: 'Kontroll' },
  { id: 'venteliste', navn: 'Venteliste' },
  { id: 'faq', navn: 'Spørsmål' },
]

export default function AiCoachPage() {
  return (
    <LandingShell aktiv="funksjoner">
      <LandingHero
        bilde="loping-grusvei-sommer"
        alt="Løper på grusvei om sommeren"
        smuler={[{ navn: 'Forsiden', href: '/xpulse.html' }, { navn: 'Funksjoner', href: '/xpulse.html#features' }, { navn: 'AI Coach' }]}
        kicker="AI Coach · kommer"
        overskrift="AI Coach for treningen din"
        ingress="Dette er ikke live ennå. Her står det vi faktisk bygger, og hva vi ikke lover - så du vet hva du melder deg på."
        bevis={['Kommer', 'Tolkning av økter', 'Ukesammendrag', 'Chat om egen trening', 'Planforslag', 'Du bestemmer hva den ser']}
        ctaHref="#venteliste"
        ctaTekst="Meld deg på ventelista"
        ctaSekHref="#status"
        ctaSekTekst="Se hva som kommer"
      />
      <LandingSnarvei punkter={SNARVEIER} />

      <LandingSeksjon
        id="status" kicker="Status" tittel="INGENTING AV DETTE ER LIVE."
        ingress="AI Coach er under arbeid. Vi skriver det her i klartekst fordi det er lett å love for mye om AI - og fordi du skal kunne stole på resten av det som står på disse sidene."
        punkter={[
          { tittel: 'Under arbeid', tekst: 'Funksjonene under er det vi bygger mot, ikke noe du får i dag.' },
          { tittel: 'Priser er ikke satt', tekst: 'AI-planene prises når de faktisk finnes.' },
          { tittel: 'Ingen data brukes til modelltrening', tekst: 'Dataene dine trener ingen modeller - det gjelder også når AI kommer.' },
        ]}
        media={{ type: 'foto', bilde: 'loping-asfalt-lofoten', alt: 'Løper på asfaltvei i Lofoten' }}
      />

      <LandingSeksjon
        id="planen" kicker="Planen" tittel="DET VI BYGGER MOT."
        ingress="Målet er en assistent som kjenner treningshistorikken din og hjelper med det som tar tid: tolke økta, oppsummere uka og foreslå justeringer du selv godkjenner."
        punkter={[
          { tittel: 'Tolkning av økta', tekst: 'Kjenne igjen oppvarming, drag, pause og nedjogg i rundene fra klokka.' },
          { tittel: 'Ukesammendrag', tekst: 'Hva du gjorde, hva som skilte seg fra forrige uke, og hva som peker seg ut.' },
          { tittel: 'Planforslag du godkjenner', tekst: 'Forslag til justering ved sykdom eller dårlig uke - aldri endringer bak ryggen din.' },
        ]}
        media={{ type: 'foto', bilde: 'multisport-natur', alt: 'Utøver i natur' }}
        speilvendt
      />

      <LandingSeksjon
        id="kontroll" kicker="Kontroll" tittel="DU BESTEMMER HVA DEN SER."
        ingress="Når AI kommer, kommer den med brytere: hvor mye den gjør, og hvilke data den får se. Standard blir det minst inngripende valget."
        punkter={[
          { tittel: 'Nivå du velger', tekst: 'Fra «svarer når du spør» til «foreslår selv» - du setter grensen.' },
          { tittel: 'Datakategorier hver for seg', tekst: 'Trening, helsedata, notater og konkurranser kan slås av og på hver for seg.' },
          { tittel: 'Trenerdeling er et eget valg', tekst: 'Om treneren ser AI-svarene dine bestemmer du selv.' },
        ]}
        media={{ type: 'foto', bilde: 'langlop-solnedgang-spor', alt: 'Spor i solnedgang' }}
      />

      <section className="lp-faq" id="venteliste">
        <div className="lp-kap">Venteliste</div>
        <h2>SI FRA NÅR DEN ER KLAR.</h2>
        <p className="lp-ing" style={{ marginBottom: 18 }}>
          Meld deg på, så sier vi fra når AI Coach er klar til å prøves. Ingen forpliktelse, og du kan melde deg av når som helst.
        </p>
        <WaitlistSignup feature="athlete_pro_ai" />
      </section>

      <LandingFaq poster={[
        { sporsmal: 'Kan jeg bruke AI Coach i dag?', svar: 'Nei. Den er under arbeid, og ingenting av det som står på denne siden er live ennå.' },
        { sporsmal: 'Hva vil den koste?', svar: 'Prisen settes når funksjonen finnes. Vi vil ikke oppgi et tall for noe du ikke kan bruke.' },
        { sporsmal: 'Brukes dataene mine til å trene modeller?', svar: 'Nei. Treningsdataene dine trener ingen modeller, og det gjelder også når AI Coach kommer.' },
        { sporsmal: 'Kan AI endre planen min uten at jeg vet det?', svar: 'Nei. Målet er forslag du godkjenner. Du velger selv hvor mye den skal gjøre.' },
        { sporsmal: 'Får treneren min se AI-svarene?', svar: 'Bare hvis du velger det. Deling er et eget valg, som helsedata ellers i appen.' },
        { sporsmal: 'Hva får jeg i dag, uten AI?', svar: 'Hele plattformen: øktbygger, plan mot gjennomført, klokkesynk, analyse med terskel og belastning, årsplan og trenerpanel.' },
      ]} />

      <AndreIdretter />
      <LandingBand />
    </LandingShell>
  )
}
