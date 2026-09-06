import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingSnarvei } from '@/components/landing/LandingSnarvei'
import { LandingSeksjon } from '@/components/landing/LandingSeksjon'
import { LandingFaq } from '@/components/landing/LandingFaq'
import { AndreIdretter } from '@/components/landing/AndreIdretter'
import { LandingBand } from '@/components/landing/LandingBand'
import { buildFeatureMetadata } from '@/lib/landing-meta'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'Trenerverktøy - hele troppen på én skjerm',
  description:
    'X-PULSE for trenere: status for hele gruppa, push av plan- og årsplanmaler, kommentarer i selve økta, sammenligning side om side og utøvere som eier sine egne helsedata.',
  path: '/funksjoner/trener',
})

const SNARVEIER = [
  { id: 'troppen', navn: 'Troppen' },
  { id: 'push', navn: 'Push' },
  { id: 'dialog', navn: 'Dialog' },
  { id: 'sammenlign', navn: 'Sammenlign' },
  { id: 'personvern', navn: 'Personvern' },
  { id: 'faq', navn: 'Spørsmål' },
]

export default function TrenerPage() {
  return (
    <LandingShell aktiv="trenere">
      <LandingHero
        bilde="langrenn-to-utovere-snoskog"
        alt="To utøvere i snødekt skog"
        smuler={[{ navn: 'Forsiden', href: '/xpulse.html' }, { navn: 'Funksjoner', href: '/xpulse.html#features' }, { navn: 'For trenere' }]}
        kicker="For trenere"
        overskrift="Trenerverktøy for hele troppen"
        ingress="Se hvem som har trent, hvem som ligger bak plan og hvem som har lav restitusjon - før samtalen, ikke etter. Push planer, kommentér i økta, og la utøveren beholde eierskapet til dataene sine."
        bevis={['Status for hele gruppa', 'Push av planmaler', 'Kommentar i økta', 'Side om side', 'Egne terskler per utøver', 'Utøveren eier dataene']}
        ctaSekHref="#troppen"
      />
      <LandingSnarvei punkter={SNARVEIER} />

      <LandingSeksjon
        id="troppen" kicker="Troppen" tittel="HELE GRUPPA PÅ ÉN SKJERM."
        ingress="Trener-hjem viser utøverne med timer, prosent av plan, sonefordeling og siste økt - og flagger dem som ligger bak eller har lav restitusjon. Klikk deg inn, så ser du det utøveren ser."
        punkter={[
          { tittel: 'Status nå', tekst: 'Timer, plan, soner, skudd og helse for perioden du velger - i én henting.' },
          { tittel: 'Vis mer per utøver', tekst: 'Detaljpanelet åpner uten å laste siden på nytt, og husker det du allerede har hentet.' },
          { tittel: 'Kort eller tabell', tekst: 'Bytt visning etter hvor mange du følger opp.' },
        ]}
        media={{ type: 'foto', bilde: 'skiskyting-sh-motbakke', alt: 'Utøver i motbakke', blaa: true }}
        blaa
      />

      <LandingSeksjon
        id="push" kicker="Push" tittel="ÉN PLAN, MANGE UTØVERE."
        ingress="Bygg en uke- eller årsplanmal én gang og send den til én utøver eller hele gruppa. Hver mottaker får sin egen kopi, og sonene regnes fra deres egne terskler - ikke dine."
        punkter={[
          { tittel: 'Plan- og årsplanmaler', tekst: 'Uker, perioder og hele sesonger kan pushes og justeres etterpå.' },
          { tittel: 'Velg hvem som får den', tekst: 'Send til utvalgte utøvere eller hele gruppa, med forhåndsvisning før du sender.' },
          { tittel: 'Personlige soner', tekst: 'Samme økt, ulike soner - hver utøver får sine egne terskler lagt til grunn.' },
        ]}
        media={{ type: 'app', navn: 'aarsplan', kap: 'Årsplanen med perioder og nøkkeldatoer', hoyde: 420 }}
        speilvendt blaa
      />

      <LandingSeksjon
        id="dialog" kicker="Dialog" tittel="KOMMENTAREN LIGGER DER ØKTA LIGGER."
        ingress="Tilbakemeldingen står ved siden av økta utøveren førte - ikke i en egen innboks eller en meldingstråd som forsvinner. Det som ikke hører til en økt, tar du i en egen samtale."
        punkter={[
          { tittel: 'Kommentar per økt', tekst: 'Før, under og etter - og utøveren svarer samme sted.' },
          { tittel: 'Innboks for resten', tekst: 'Beskjeder som ikke hører til en bestemt økt ligger for seg.' },
          { tittel: 'Du ser hva de ser', tekst: 'Trenerens visning er utøverens flate, ikke en egen forenklet versjon.' },
        ]}
        media={{ type: 'app', navn: 'oktkort-gjennomfort', kap: 'Gjennomført økt i dagboka', hoyde: 120 }}
        blaa
      />

      <LandingSeksjon
        id="sammenlign" kicker="Sammenlign" tittel="TO ELLER FLERE, SIDE OM SIDE."
        ingress="Legg utøverne ved siden av hverandre for samme periode: timer, soner, belastning, terskler, tester og skyting. Oppsettet kan lagres, så du åpner det samme bildet neste uke."
        punkter={[
          { tittel: 'Én kolonne per utøver', tekst: 'Velg metrikkene du bryr deg om, og se dem i samme rad.' },
          { tittel: 'Felles kurver', tekst: 'CTL og sonefordeling for flere utøvere i samme graf.' },
          { tittel: 'Lagret oppsett', tekst: 'Sammenligningen du bruker mest ligger klar neste gang.' },
        ]}
        media={{ type: 'foto', bilde: 'skiskyting-staaende-vinter', alt: 'Skiskyttere på standplass om vinteren', blaa: true }}
        speilvendt blaa
      />

      <LandingSeksjon
        id="personvern" kicker="Personvern" tittel="UTØVEREN EIER DATAENE SINE."
        ingress="Tilgangen gis av utøveren, ikke av deg. Helsedata som HRV og søvn deles bare hvis utøveren slår det på, og frakobling fjerner tilgangen umiddelbart - håndhevet i databasen, ikke bare i grensesnittet."
        punkter={[
          { tittel: 'Utøveren gir tilgang', tekst: 'Invitasjon og samtykke ligger hos utøveren - alltid.' },
          { tittel: 'Helsedata er et eget valg', tekst: 'Trening kan deles uten at søvn og HRV følger med.' },
          { tittel: 'Frakobling virker med én gang', tekst: 'Tilgangen fjernes i det utøveren kobler fra.' },
        ]}
        media={{ type: 'foto', bilde: 'langrenn-fjell-solnedgang', alt: 'Skiløper i fjellet', blaa: true }}
        blaa
      />

      <LandingFaq poster={[
        { sporsmal: 'Hva koster trenerplanene?', svar: 'Trener Basic koster 199 kr i måneden og Trener Pro 279 kr. Begge inkluderer din egen Athlete Pro. Trener Basic har 30 dagers gratis prøve, og utøverplasser kan kjøpes ved behov.' },
        { sporsmal: 'Hvor mange utøvere kan jeg følge?', svar: 'Trener Basic gir plass til inntil ti tilkoblede utøvere, og du kjøper lisenser etter behov. Trenger du flere, er Trener Pro laget for det.' },
        { sporsmal: 'Regnes sonene fra mine terskler eller utøverens?', svar: 'Fra utøverens. Pusher du samme økt til hele gruppa, får hver utøver sonene sine regnet fra sine egne terskler.' },
        { sporsmal: 'Ser jeg helsedataene til utøverne?', svar: 'Bare hvis utøveren slår det på. Trening kan deles uten at HRV og søvn følger med, og frakobling fjerner tilgangen umiddelbart.' },
        { sporsmal: 'Kan jeg sammenligne utøvere?', svar: 'Ja. Side om side viser én kolonne per utøver for samme periode, med felles kurver for belastning og soner. Oppsettet kan lagres.' },
        { sporsmal: 'Kan jeg planlegge for utøveren?', svar: 'Ja. Du kan bygge planen i utøverens kalender, pushe maler til grupper, og kommentere i selve økta. Utøveren fører fortsatt dagboka selv.' },
      ]} />

      <AndreIdretter />
      <LandingBand />
    </LandingShell>
  )
}
