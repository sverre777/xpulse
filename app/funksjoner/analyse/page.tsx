import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingSnarvei } from '@/components/landing/LandingSnarvei'
import { LandingSeksjon } from '@/components/landing/LandingSeksjon'
import { LandingFaq } from '@/components/landing/LandingFaq'
import { AndreIdretter } from '@/components/landing/AndreIdretter'
import { LandingBand } from '@/components/landing/LandingBand'
import { buildFeatureMetadata } from '@/lib/landing-meta'

// UNDERSIDENE v2 bolk B6 - modulsidene arver nøyaktig de samme komponentene som
// idrettssidene. Teksten står her, i sida, ikke i komponentene.

export const metadata: Metadata = buildFeatureMetadata({
  title: 'Treningsanalyse - belastning, terskel, laktat og soner',
  description:
    'X-PULSE analyse: CTL/ATL/TSB, sonefordeling per bevegelsesform, terskelhistorikk og laktatprofil, GAP og watt-soner, korrelasjoner mot HRV og søvn, og grafer du bygger selv.',
  path: '/funksjoner/analyse',
})

const SNARVEIER = [
  { id: 'belastning', navn: 'Belastning' },
  { id: 'soner', navn: 'Soner' },
  { id: 'terskel', navn: 'Terskel' },
  { id: 'helse', navn: 'Helse' },
  { id: 'egne', navn: 'Egne grafer' },
  { id: 'faq', navn: 'Spørsmål' },
]

export default function AnalysePage() {
  return (
    <LandingShell aktiv="funksjoner">
      <LandingHero
        bilde="loping-hoved-fjell-gress"
        alt="Utøver i fjellterreng"
        smuler={[{ navn: 'Forsiden', href: '/xpulse.html' }, { navn: 'Funksjoner', href: '/xpulse.html#features' }, { navn: 'Analyse' }]}
        kicker="Dyp analyse"
        overskrift="Treningsanalyse som vet hva du planla"
        ingress="Data uten sammenheng er bare tall. Analysen kobler plan, dagbok, klokke og helse - så du ser hva økta faktisk gjorde med deg, og hvordan sesongen har utviklet seg."
        bevis={['CTL · ATL · TSB', 'Soner per bevegelsesform', 'Terskel og laktat', 'GAP og watt-soner', 'Favoritt-grafer', 'Trenervisning']}
        ctaSekHref="#belastning"
      />
      <LandingSnarvei punkter={SNARVEIER} />

      <LandingSeksjon
        id="belastning" kicker="Belastning" tittel="CTL, ATL OG TSB - FORKLART PÅ NORSK."
        ingress="Tre kurver som viser hvor du er i form-syklusen: form (CTL), tretthet (ATL) og overskudd (TSB). Konkurransene ligger på samme akse, så du ser hva formen var den dagen det gjaldt."
        punkter={[
          { tittel: 'Oppdateres med hver økt', tekst: 'Belastningen regnes fra det du faktisk gjorde - også når klokka ikke var med.' },
          { tittel: 'Konkurranser på kurven', tekst: 'A-, B- og C-løp vises i belastningsgrafen, så toppformen kan etterprøves.' },
          { tittel: 'RPE når watt mangler', tekst: 'Har økta hverken puls eller watt, brukes opplevd belastning - ingen hull i kurven.' },
        ]}
        media={{ type: 'app', navn: 'custom-graf', kap: 'Egen graf: timer per uke fordelt på soner', hoyde: 520 }}
      />

      <LandingSeksjon
        id="soner" kicker="Sonefordeling" tittel="HVOR LIGGER VOLUMET EGENTLIG?"
        ingress="Sonetid per uke, måned og sesong - og per bevegelsesform. Se om planen om mye I1 og litt I5 faktisk stemmer med det du gjorde, eller om alt havnet i midten."
        punkter={[
          { tittel: 'Per bevegelsesform', tekst: 'Løping, sykling, ski og styrke har egne soner, så tallene ikke blander seg.' },
          { tittel: 'Plan mot gjennomført', tekst: 'Planlagt sonefordeling ved siden av den faktiske - grunnlaget for trenerpraten.' },
          { tittel: 'I6-I8 teller med', tekst: 'Hurtighet og spenst ligger i sonesummene der de hører hjemme.' },
        ]}
        media={{ type: 'foto', bilde: 'loping-bane-to-utovere', alt: 'To løpere på bane' }}
        speilvendt
      />

      <LandingSeksjon
        id="terskel" kicker="Terskel og laktat" tittel="TESTENE STYRER SONENE DINE."
        ingress="Terskelverdiene ligger som data med dato - ikke som en innstilling du glemmer. Legg inn en ny test, og sonene og historikken regnes riktig fra den datoen. Laktatpunktene ligger på kurven der de ble tatt."
        punkter={[
          { tittel: 'Terskelhistorikk', tekst: 'Puls, tempo, watt og laktat per test. Estimater foreslås, men skrives aldri automatisk.' },
          { tittel: 'GAP og watt-soner', tekst: 'Stigningsjustert tempo på løping, Coggan-soner og NP/IF på sykkel.' },
          { tittel: 'Prestasjon over tid', tekst: 'Fart og watt ved terskel fulgt gjennom sesongen, sesong mot sesong.' },
        ]}
        media={{ type: 'foto', bilde: 'loping-sti-host', alt: 'Løper på sti om høsten' }}
      />

      <LandingSeksjon
        id="helse" kicker="Helse mot belastning" tittel="HVA HENGER FAKTISK SAMMEN?"
        ingress="HRV mot belastning. Søvn mot dagsform. Hvilepuls mot uker med mye. Korrelasjonene regnes på dine egne tall, og sier fra når det er for lite data til å konkludere."
        punkter={[
          { tittel: 'Søvn, hvilepuls og HRV', tekst: 'Kommer inn fra klokka hver natt, og kan alltid overstyres manuelt.' },
          { tittel: 'Sykdom og skade som lag', tekst: 'Periodene legges over belastningskurven, så mønsteret blir synlig.' },
          { tittel: 'Sier fra ved for lite data', tekst: 'Under ti punkter vises ingen korrelasjon - bare at grunnlaget er for tynt.' },
        ]}
        media={{ type: 'app', navn: 'helse', kap: 'Helse: søvn, hvilepuls og HRV', hoyde: 780 }}
        speilvendt
      />

      <LandingSeksjon
        id="egne" kicker="Egne grafer" tittel="DINE EGNE SPØRSMÅL, DINE EGNE GRAFER."
        ingress="Bygg grafen som svarer på akkurat ditt spørsmål: filtrer på bevegelsesform, teknikk, periode, sone eller økttype. Stjernemerk den, så ligger den først neste gang."
        punkter={[
          { tittel: 'Favoritter først', tekst: 'De du stjernemerker møter deg på Oversikt - i den rekkefølgen du selv drar dem.' },
          { tittel: 'Filter som henger sammen', tekst: 'Periode, bevegelsesform og teknikk kan kombineres fritt, også i egne grafer.' },
          { tittel: 'Treneren ser det samme', tekst: 'Har du gitt treneren tilgang, ser hen dine favoritter - ikke sine egne.' },
        ]}
        media={{ type: 'foto', bilde: 'molle-lab', alt: 'Testlab med mølle' }}
      />

      <LandingFaq poster={[
        { sporsmal: 'Hva er CTL, ATL og TSB?', svar: 'CTL er den langsiktige formen din, ATL er den kortsiktige trettheten, og TSB er forskjellen - overskuddet ditt. Alle tre regnes fra belastningen i øktene dine og vises i samme kurve, med konkurransene på samme akse.' },
        { sporsmal: 'Må jeg ha watt eller puls for å få belastning?', svar: 'Nei. Har økta puls eller watt brukes de; ellers regnes belastningen fra opplevd belastning (RPE) og varighet, så kurven ikke får hull.' },
        { sporsmal: 'Hvordan settes sonene mine?', svar: 'Fra terskelverdiene dine, som ligger som historikk med dato. Endrer du en terskel, regnes historikken riktig fra den datoen - og hver bevegelsesform har sine egne.' },
        { sporsmal: 'Kan jeg bygge mine egne grafer?', svar: 'Ja. Du filtrerer på bevegelsesform, teknikk, periode, sone og økttype, og kan stjernemerke grafen så den ligger først på Oversikt.' },
        { sporsmal: 'Hva vises av helsedata?', svar: 'Søvn, hvilepuls og HRV fra klokka, sammen med belastningen. Alt kan overstyres manuelt, og manuelle verdier vinner alltid over klokkas.' },
        { sporsmal: 'Ser treneren analysen min?', svar: 'Bare hvis du kobler deg til en trener og gir tilgang. Helsedata deles kun hvis du slår det på, og frakobling fjerner tilgangen umiddelbart.' },
      ]} />

      <AndreIdretter />
      <LandingBand />
    </LandingShell>
  )
}
