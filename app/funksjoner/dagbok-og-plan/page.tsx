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
  title: 'Treningsdagbok og treningsplan - plan mot gjennomført',
  description:
    'X-PULSE dagbok og plan: øktbygger med hurtigoppsett, 58 øktmaler, plan mot gjennomført, ukevisning og kalender, notater per uke og trenerkommentarer i selve økta.',
  path: '/funksjoner/dagbok-og-plan',
})

const SNARVEIER = [
  { id: 'okt', navn: 'Øktbyggeren' },
  { id: 'plan', navn: 'Plan' },
  { id: 'dagbok', navn: 'Dagbok' },
  { id: 'notater', navn: 'Notater' },
  { id: 'trener', navn: 'Trener' },
  { id: 'faq', navn: 'Spørsmål' },
]

export default function DagbokOgPlanPage() {
  return (
    <LandingShell aktiv="funksjoner">
      <LandingHero
        bilde="langrenn-rulleski-skogsvei"
        alt="Rulleskiløper på skogsvei"
        smuler={[{ navn: 'Forsiden', href: '/xpulse.html' }, { navn: 'Funksjoner', href: '/xpulse.html#features' }, { navn: 'Dagbok og plan' }]}
        kicker="Dagbok og plan"
        overskrift="Treningsdagbok og plan i samme app"
        ingress="Planen ligger ved siden av dagboka, ikke i et annet regneark. Du ser hva du skulle gjøre, hva du gjorde, og forskjellen - uke for uke."
        bevis={['Øktbygger med rader', 'Hurtigoppsett', '58 øktmaler', 'Plan mot gjennomført', 'Ukevisning', 'Trenerkommentarer']}
        ctaSekHref="#okt"
      />
      <LandingSnarvei punkter={SNARVEIER} />

      <LandingSeksjon
        id="okt" kicker="Øktbyggeren" tittel="BYGG ØKTA SLIK DU TENKER DEN."
        ingress="Radene er editoren - ingen dra-og-slipp. Skriv 8 × 45/15 i hurtigoppsettet, så ligger hele økta klar med oppvarming, drag, pauser og nedjogg. Bytt sone eller distanse på én rad, og resten regner seg selv."
        punkter={[
          { tittel: 'Hurtigoppsett', tekst: 'Antall × dragtid / pause og sone - økta genereres som vanlige rader du kan justere fritt.' },
          { tittel: '58 ferdige øktmaler', tekst: 'Bygget på Olympiatoppens intensitetsskala. Lagre dine egne som maler.' },
          { tittel: 'Felt per bevegelsesform', tekst: 'Watt, motstand, stigning, fart og kadens dukker opp der de gir mening.' },
        ]}
        media={{ type: 'app', navn: 'hurtigoppsett', kap: 'Hurtigoppsett i øktbyggeren', hoyde: 420 }}
      />

      <LandingSeksjon
        id="plan" kicker="Plan" tittel="PLANEN VET HVA SOM BLE GJORT."
        ingress="Legg økter på framtidige datoer med varighet, sone og struktur - eller hent inn en hel uke fra en mal. Når økta er gjennomført, ligger plan og virkelighet ved siden av hverandre."
        punkter={[
          { tittel: 'Plan mot gjennomført', tekst: 'Hver planlagte økt tar vare på seg selv, så avviket kan leses etterpå.' },
          { tittel: 'Uke- og planmaler', tekst: 'Hele uker og perioder kan lagres og settes inn på nytt, for deg eller for gruppa.' },
          { tittel: 'Årsplanen over ukene', tekst: 'Periodene fra årsplanen ligger som stripe over ukene i planen.' },
        ]}
        media={{ type: 'app', navn: 'kalender-uke', kap: 'Plan-kalenderen med uke og periodestripe', hoyde: 420 }}
        speilvendt
      />

      <LandingSeksjon
        id="dagbok" kicker="Dagbok" tittel="ØKTA, RAD FOR RAD."
        ingress="Dagboka viser det du faktisk gjorde: drag, pauser, terreng, laktat, ernæring og skyting. Klokkas runder kan flettes inn - samlet eller splittet - og det du fører selv vinner alltid."
        punkter={[
          { tittel: 'Drag og pause som egne rader', tekst: 'Aktiv tid blir riktig, også når du sto og ventet.' },
          { tittel: 'Punkter på kurven', tekst: 'Laktat, ernæring og notat legges der de skjedde - planlagt teller aldri som målt.' },
          { tittel: 'Uke og dag i samme bilde', tekst: 'Ukevisningen viser sju dager med dagsdetalj under - også på mobil.' },
        ]}
        media={{ type: 'app', navn: 'oktgraf', kap: 'Økt-grafen i dagboka', hoyde: 1140 }}
      />

      <LandingSeksjon
        id="notater" kicker="Notater" tittel="TANKENE DINE HØRER MED."
        ingress="Notat per økt fanger dagen. Notat per uke, måned og periode fanger det som bare kan sees over tid - og planens notat står ved siden av når du fører uka."
        punkter={[
          { tittel: 'Uke, måned og periode', tekst: 'Én tekst per nivå, både i plan og i dagbok.' },
          { tittel: 'Plan-notatet synlig i dagboka', tekst: 'Du ser hva som var meningen mens du skriver hva som skjedde.' },
          { tittel: 'Opplevd belastning', tekst: 'RPE og følelse ligger på økta og teller inn i belastningen når puls mangler.' },
        ]}
        media={{ type: 'foto', bilde: 'langrenn-fjell-solnedgang', alt: 'Skiløper i fjellet ved solnedgang' }}
        speilvendt
      />

      <LandingSeksjon
        id="trener" kicker="For trenere" tittel="KOMMENTAREN LIGGER DER ØKTA LIGGER."
        ingress="Treneren kommenterer i selve økta - ikke i en egen innboks. Du ser tilbakemeldingen ved siden av det du førte, og svarer samme sted."
        punkter={[
          { tittel: 'Kommentar per økt', tekst: 'Før, under og etter - tråden hører til økta.' },
          { tittel: 'Push av planer', tekst: 'Treneren kan sende uke- og årsplanmaler til deg eller hele gruppa.' },
          { tittel: 'Du eier dataene dine', tekst: 'Helsedata deles bare hvis du sier ja, og frakobling fjerner tilgangen umiddelbart.' },
        ]}
        media={{ type: 'foto', bilde: 'langrenn-to-utovere-snoskog', alt: 'To utøvere i snødekt skog', blaa: true }}
        blaa
      />

      <LandingFaq poster={[
        { sporsmal: 'Må jeg føre alt manuelt?', svar: 'Nei. Er klokka koblet til, kommer økta inn av seg selv og legges oppå planen din. Du fyller bare på med det klokka ikke vet - følelse, laktat, ernæring og skyting.' },
        { sporsmal: 'Hva er hurtigoppsettet?', svar: 'Du skriver antall × dragtid / pause og sone, for eksempel 8 × 45/15. Økta genereres som vanlige rader med oppvarming, drag, pauser og nedjogg, som du kan justere fritt etterpå.' },
        { sporsmal: 'Kan jeg lage mine egne maler?', svar: 'Ja. Både enkeltøkter, hele uker og perioder kan lagres som maler, i tillegg til de 58 ferdige øktmalene.' },
        { sporsmal: 'Ser jeg plan og gjennomført ved siden av hverandre?', svar: 'Ja. Den planlagte økta tas vare på, så du ser avviket mellom det du skulle gjøre og det du gjorde - både per økt og per uke.' },
        { sporsmal: 'Virker det på mobil?', svar: 'Ja. Ukevisningen, dagboka og øktbyggeren er bygget for mobil også, med samme data som på PC.' },
        { sporsmal: 'Kan treneren min skrive i dagboka mi?', svar: 'Treneren kan kommentere i økta og pushe planer, men fører ikke dagboka for deg. Det du fører selv vinner alltid.' },
      ]} />

      <AndreIdretter />
      <LandingBand />
    </LandingShell>
  )
}
