import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { SportPageHero } from '@/components/landing/SportPageHero'
import { SportFeatureSection, SportPageCTA } from '@/components/landing/SportFeatureSection'
import { buildFeatureMetadata } from '@/lib/landing-meta'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'Analyse',
  description:
    'X-PULSE analyse-modul: ATL/CTL/TSB belastningsmodell, sonefordeling per sport, korrelasjoner mellom HRV og prestasjon, laktat-profil over tid og custom grafer du kan markere som favoritt.',
  path: '/funksjoner/analyse',
})

function AnalyseIcon() {
  return (
    <svg viewBox="0 0 48 48" width={140} height={140} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 38 V8" />
      <path d="M6 38 H42" />
      <path d="M10 32 L18 22 L26 26 L34 14 L42 18" />
      <circle cx="18" cy="22" r="2" fill="currentColor" stroke="none" />
      <circle cx="26" cy="26" r="2" fill="currentColor" stroke="none" />
      <circle cx="34" cy="14" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function AnalysePage() {
  return (
    <LandingShell>
      <SportPageHero
        kicker="Dyp analyse"
        title={<>FORSTÅ <span style={{ color: '#FF4500' }}>DIN<br/>EGEN UTVIKLING.</span></>}
        description="Data uten innsikt er bare tall. Analyse-modulen kobler puls, HRV, laktat og subjektiv følelse i én helhetlig oversikt — slik at du faktisk lærer av hver økt og av sesongen som helhet."
        icon={<AnalyseIcon />}
        backgroundImage="/photos/DSC05290_thumb.jpg"
      />

      <SportFeatureSection
        kicker="Belastnings-modell"
        title="ATL · CTL · TSB."
        intro="Tre tall som forteller hvor du er i form-syklusen. ATL er trøtthet (siste 7 dager), CTL er fitness (siste 42 dager), TSB er forskjellen — formkurven din. X-PULSE plotter alle tre i samme graf og forklarer dem på norsk."
        bullets={[
          { title: 'Daglig oppdatering', body: 'Hver økt påvirker tallene umiddelbart. Sammenlign hvor du var samme uke i fjor.' },
          { title: 'Forms-prognose', body: 'Ekstrapoler 4 uker frem så du ser når TSB topper hvis treningen fortsetter som nå.' },
          { title: 'Forklart i klartekst', body: 'Tooltip og hjelp-side med konkrete eksempler — ingen forutsetninger om sportsvitenskap.' },
        ]}
      />

      <SportFeatureSection
        kicker="Sonefordeling"
        title="HVOR LIGGER VOLUMET?"
        intro="Sone-statistikk per uke, måned og sesong — og per sport. Polariserende trening krever mye sone 1 og noe sone 5; X-PULSE viser om du faktisk gjør det eller om du driver i no man's land."
        bullets={[
          { title: 'Per-sport-soner', body: 'Soner registreres uavhengig per disiplin så svømme-stats ikke forurenser løpe-stats.' },
          { title: 'Plan vs faktisk', body: 'Sammenlign planlagt sone-fordeling mot det du faktisk gjorde — viktig for trener-kommunikasjon.' },
          { title: 'Polarisert vs pyramidisk', body: 'Mønster-tag som viser om sesongen din følger en kjent trenings-modell.' },
        ]}
      />

      <SportFeatureSection
        kicker="Korrelasjoner"
        title="HVA HENGER SAMMEN?"
        intro="HRV mot belastning. Dagsform mot 3-dagers-load. Snittpuls i intervaller mot HRV. Helse-fanen i analyse-modulen plotter alle disse som scatter-grafer med Pearson-korrelasjon — og finner mønstre i dine egne data, ikke generiske råd."
        bullets={[
          { title: 'HRV vs treningsvolum', body: 'Hvordan henger din HRV sammen med summen av timer siste 7 dager? Scatter-plot + korrelasjons-koeffisient.' },
          { title: 'Dagsform vs 3-dagers-belastning', body: 'Subjektiv dagsform-rating mot akkumulert belastning siste 3 dager — ser du fall etter harde uker?' },
          { title: 'Sykdom vs belastning', body: 'Markering av sykedager mot foregående belastning — finn dine egne overtrenings-grenser.' },
          { title: 'Skadehistorikk', body: 'Skadeperioder spores mot belastnings-trend så du ser om volum-spikes utløste skadene.' },
        ]}
      />

      <SportFeatureSection
        kicker="Laktat over tid"
        title="TERSKEL-UTVIKLING."
        intro="Laktat er gull hvis du har målinger. X-PULSE lar deg logge multiple målinger per økt, plotter dem mot puls og pace, og sporer terskel-utviklingen din over måneder."
        bullets={[
          { title: 'Multiple per økt', body: 'Steg-test med 4-6 målinger logges hver for seg; X-PULSE bygger laktat-kurven.' },
          { title: 'Terskel-pace', body: 'Pace ved 4 mmol estimeres automatisk og spores som egen PR.' },
          { title: 'Terskel-puls-utvikling', body: 'Hvilken puls produserer 4 mmol denne måneden vs forrige? Indikator for aerob fremgang.' },
        ]}
      />

      <SportFeatureSection
        kicker="Tester og PR"
        title="REGISTRER FRA HVOR SOM HELST."
        intro="Tester loggføres med standard maler eller egne formater. Cooper, 5K, FTP-test, Vingate — eller en favoritt-runde du tester deg på hvert kvartal. PR-historikk plottes for hver test-type."
        bullets={[
          { title: 'Standard-maler', body: '20+ kjente test-formater forhåndskonfigurert med riktig protokoll og felter.' },
          { title: 'Egne tester', body: 'Lag dine egne hvis du har et signatur-format — trener kan dele med hele laget.' },
          { title: 'Trend per test', body: 'Hver test får egen graf med årstall-akse — se sesong-til-sesong-fremgang.' },
        ]}
      />

      <SportFeatureSection
        kicker="Custom grafer"
        title="DINE EGNE SPØRSMÅL."
        intro="Custom-graf-bygger lar deg filtrere på sport, workout-type, periode, sone og bevegelsesform — og bygge en graf som svarer på akkurat ditt spørsmål. Marker som favoritt så vises den i Oversikt."
        bullets={[
          { title: 'Filter-kombinasjon', body: '6+ filter-akser kan kombineres fritt; resultatet blir en delbar graf.' },
          { title: 'Favoritt-marker', body: 'Inntil 6 grafer vises automatisk på Oversikt-siden din.' },
          { title: 'Trener-tilgang', body: 'Trenere kan se utøverens custom-grafer hvis tilgang er gitt.' },
        ]}
      />

      <SportPageCTA />
    </LandingShell>
  )
}
