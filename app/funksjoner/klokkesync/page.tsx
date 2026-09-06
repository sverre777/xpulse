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
  title: 'Klokkesynk - Garmin, COROS, Wahoo, Zepp, Polar og .fit',
  description:
    'X-PULSE klokkesynk: direktesynk for Garmin, COROS, Wahoo og Zepp (beta), Polar under utrulling, Strava-import og .fit-fil fra alle merker. Rundene flettes med planen, og du eier dataene.',
  path: '/funksjoner/klokkesync',
})

const MERKER = {
  type: 'merker' as const,
  merker: [
    { navn: 'Garmin', status: 'Beta' },
    { navn: 'COROS', status: 'Beta' },
    { navn: 'Wahoo', status: 'Beta' },
    { navn: 'Zepp', status: 'Beta' },
    { navn: 'Polar', status: 'Utrulling' },
    { navn: 'Strava', status: 'Import' },
    { navn: '.fit-fil', status: 'Alle merker, også Suunto' },
    { navn: 'Intervals.icu', status: 'På vei', pavei: true },
    { navn: 'Whoop', status: 'På vei', pavei: true },
  ],
  fot: 'Synken for Garmin, COROS, Wahoo og Zepp går gjennom vår klokkesynk-leverandør. Apple Health kommer.',
}

const SNARVEIER = [
  { id: 'merker', navn: 'Merker' },
  { id: 'flett', navn: 'Flett' },
  { id: 'helse', navn: 'Helse' },
  { id: 'data', navn: 'Dataene dine' },
  { id: 'faq', navn: 'Spørsmål' },
]

export default function KlokkesyncPage() {
  return (
    <LandingShell aktiv="funksjoner">
      <LandingHero
        bilde="langrenn-hoved-rulleski-kollen"
        alt="Utøver på rulleski"
        smuler={[{ navn: 'Forsiden', href: '/xpulse.html' }, { navn: 'Funksjoner', href: '/xpulse.html#features' }, { navn: 'Klokkesynk' }]}
        kicker="Klokkesynk"
        overskrift="Klokkesynk som fyller ut resten"
        ingress="Økta kommer inn av seg selv etter trening, og rundene legges oppå planen din. Du fyller bare på med det klokka ikke vet."
        bevis={['Garmin · COROS · Wahoo · Zepp', 'Polar under utrulling', 'Strava-import', '.fit fra alle merker', 'Søvn, hvilepuls og HRV', 'Du eier dataene']}
        ctaSekHref="#merker"
      />
      <LandingSnarvei punkter={SNARVEIER} />

      <LandingSeksjon
        id="merker" kicker="Merker" tittel="KOBLE TIL ÉN GANG."
        ingress="Garmin, COROS, Wahoo og Zepp synker direkte i beta, Polar er under utrulling, og Strava-historikken kan importeres. Har du et annet merke, laster du opp .fit-fila - også fra Suunto. Intervals.icu og Whoop er på vei."
        punkter={[
          { tittel: 'Direktesynk i beta', tekst: 'Garmin, COROS, Wahoo og Zepp: koble til én gang, så kommer nye økter inn av seg selv.' },
          { tittel: 'Polar under utrulling', tekst: 'Polar varsler oss når en ny økt er lastet opp, og vi henter den inn.' },
          { tittel: '.fit dekker resten', tekst: 'Last opp fila fra klokka eller appen - aktivitet, runder og sonetid leses ut.' },
        ]}
        media={MERKER}
      />

      <LandingSeksjon
        id="flett" kicker="Flett" tittel="RUNDENE LEGGES OPPÅ PLANEN."
        ingress="Klokkas runder legges inntil den økta du hadde planlagt. Du velger om de skal stå samlet eller splittet, og det du har ført manuelt vinner alltid over det klokka gjettet."
        punkter={[
          { tittel: 'Samlet eller splittet', tekst: 'Like runder etter hverandre kan vises som én rad - dataene er fortsatt splittet.' },
          { tittel: 'Manuelt vinner', tekst: 'Har du ført tid, distanse eller sone selv, overskrives det aldri av synken.' },
          { tittel: 'Kilde per verdi', tekst: 'Hver verdi vet om den kom fra klokka eller fra deg.' },
        ]}
        media={{ type: 'app', navn: 'samlet-bryter', kap: 'Samlet eller splittet i økta', hoyde: 120 }}
        speilvendt
      />

      <LandingSeksjon
        id="helse" kicker="Helse" tittel="SØVN, HVILEPULS OG HRV - HVER NATT."
        ingress="Helsedataene kommer inn av seg selv der klokka gir dem, og vises sammen med treningsbelastningen. Alt kan også føres manuelt, og manuelle verdier vinner."
        punkter={[
          { tittel: 'Søvn i detalj', tekst: 'Leggetid, våknetid og faser der klokka leverer det - ikke bare ett tall.' },
          { tittel: 'HRV og hvilepuls', tekst: 'Trendene ligger ved siden av belastningen, så sammenhengen blir synlig.' },
          { tittel: 'Manuelt går alltid', tekst: 'Har du ikke klokke, fører du selv - samme felt, samme grafer.' },
        ]}
        media={{ type: 'app', navn: 'helse', kap: 'Helse: søvn, hvilepuls og HRV', hoyde: 780 }}
      />

      <LandingSeksjon
        id="data" kicker="Dataene dine" tittel="VI LESER BARE."
        ingress="Vi henter økter og helsedata for å vise dem for deg. Vi skriver ingenting tilbake til klokka di, og kobler du fra, sletter vi det vi har hentet."
        punkter={[
          { tittel: 'Frakobling sletter', tekst: 'Tar du bort tilkoblingen, fjernes det vi har hentet fra den kilden.' },
          { tittel: 'Reglene følger kilden', tekst: 'Strava har egne krav til hvor lenge rådata kan ligge - de følger vi.' },
          { tittel: 'Deling er ditt valg', tekst: 'Treneren ser helsedata kun hvis du slår det på.' },
        ]}
        media={{ type: 'foto', bilde: 'molle-lab', alt: 'Testlab med mølle' }}
        speilvendt
      />

      <LandingFaq poster={[
        { sporsmal: 'Hvilke klokker synker direkte i dag?', svar: 'Garmin, COROS, Wahoo og Zepp synker direkte i beta, gjennom vår klokkesynk-leverandør. Polar er under utrulling. Strava-historikken kan importeres, og alle andre merker dekkes av .fit-opplasting - også Suunto.' },
        { sporsmal: 'Kommer Intervals.icu og Whoop?', svar: 'Ja, begge er på vei. De virker ikke i dag, og vi sier ikke noe annet før de gjør det.' },
        { sporsmal: 'Hva skjer med økta jeg allerede hadde planlagt?', svar: 'Klokkas runder legges oppå den planlagte økta. Du velger samlet eller splittet visning, og det du har ført manuelt vinner alltid.' },
        { sporsmal: 'Får jeg søvn og HRV inn automatisk?', svar: 'Der klokka leverer det, ja - hver natt. Alt kan også føres manuelt, og manuelle verdier vinner over klokkas.' },
        { sporsmal: 'Skriver dere noe tilbake til klokka mi?', svar: 'Nei. Vi leser bare. Kobler du fra, sletter vi det vi har hentet fra den kilden.' },
        { sporsmal: 'Kan jeg bruke appen uten klokke?', svar: 'Ja. Alt kan føres manuelt, og belastningen regnes fra opplevd belastning når puls og watt mangler.' },
      ]} />

      <AndreIdretter />
      <LandingBand />
    </LandingShell>
  )
}
