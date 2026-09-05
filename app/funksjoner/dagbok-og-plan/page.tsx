import type { Metadata } from 'next'
import { LandingShell } from '@/components/landing/LandingShell'
import { SportPageHero } from '@/components/landing/SportPageHero'
import { SportFeatureSection, SportPageCTA } from '@/components/landing/SportFeatureSection'
import { buildFeatureMetadata } from '@/lib/landing-meta'
import { InsideMockups } from '@/components/landing/InsideMockups'
import { NYTT_I_VERSJON } from '@/lib/versjon'

export const metadata: Metadata = buildFeatureMetadata({
  title: 'Treningsdagbok og treningsplanlegger – plan og logg i ett',
  description:
    'Slik logger du og planlegger i X-PULSE. Aktivitets-basert dagbok med drag/pause/skyting, plan-modus for fremtid, dagbok-modus for tilbakeblikk, felles notater og trener-kommentarer integrert.',
  path: '/funksjoner/dagbok-og-plan',
})

function DagbokIcon() {
  return (
    <svg viewBox="0 0 48 48" width={140} height={140} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* Bok / kalender */}
      <rect x="8" y="10" width="32" height="32" rx="2" />
      <path d="M8 18 H40" />
      <path d="M14 6 V14" />
      <path d="M34 6 V14" />
      {/* Fylte ruter - øktene */}
      <rect x="14" y="22" width="6" height="4" fill="currentColor" stroke="none" />
      <rect x="22" y="22" width="6" height="4" fill="currentColor" stroke="none" />
      <rect x="22" y="30" width="6" height="4" fill="currentColor" stroke="none" />
      <rect x="30" y="30" width="6" height="4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function DagbokOgPlanPage() {
  return (
    <LandingShell>
      <SportPageHero
        kicker="Dagbok og plan"
        title={<>SLIK LOGGER DU<br/><span style={{ color: '#FF4500' }}>OG PLANLEGGER.</span></>}
        description="To moduser av samme rammeverk. Bygg planen fremover, logg gjennomføringen tilbake - og se sammenligningen automatisk. Trener-kommentarene følger med på øktnivå."
        icon={<DagbokIcon />}
        backgroundImage="/photos/rulleski-skogsvei.jpg"
      />

      {/* Ekte flater fra appen - samme mockups som forsiden. */}
      <InsideMockups />

      <SportFeatureSection
        kicker="Aktivitets-basert logging"
        title="ØKTEN BRYTES NED I DRAG."
        intro="Hver økt kan logges som én lang blokk eller deles i drag/intervaller med egne soner, varigheter, høydemeter og terreng. Pause og aktiv pause registreres som egne rader så aktiv tid er korrekt."
        bullets={[
          { title: 'Drag og intervall', body: 'Splitt en økt i flere drag med egen sone og varighet. Sum og snitt vises automatisk.' },
          { title: 'Pause vs aktiv pause', body: 'Stopp er ikke "tid på trening". Aktiv pause vs full pause skilles, så aktivitets-sum blir korrekt.' },
          { title: 'Skyting som aktivitet', body: 'For skiskyting integreres skyting-blokker som egne rader med treff%, posisjon og tid.' },
        ]}
      />

      <SportFeatureSection
        kicker="Spesialformater"
        title="KONKURRANSE. TEST. REISEDAG."
        intro="Ikke alle økter er trening. Velg riktig type ved logging og rammeverket tilpasses - egne felter for konkurranse-resultater, test-protokoller og hviledag-årsak."
        bullets={[
          { title: 'Konkurranse-modul', body: 'Distanse, posisjon, klasse, deltakerantall - alt strukturert for senere PR-historikk.' },
          { title: 'Testløp og test-økter', body: 'Cooper, FTP, terskel-test og 20+ andre standard-formater forhåndskonfigurert.' },
          { title: 'Hviledag, sykdom, skade og reisedag', body: 'Dagmarkeringer med egne felt - reisedag med timer og notat. Forurenser aldri treningsstatistikken.' },
        ]}
      />

      <SportFeatureSection
        kicker="Plan-modus"
        title="BYGG FREMOVER."
        intro="Plan-kalenderen lar deg legge inn økter på fremtidige datoer med varighet, sone-mål og struktur. Maler kan importeres for hele uker eller hele sesonger."
        bullets={[
          { title: 'Planlagt vs gjennomført', body: 'Hver planlagt økt får et snapshot. Når du logger gjennomføring sammenstilles plan vs faktisk automatisk.' },
          { title: 'Øktmal-bibliotek + egne maler', body: '58 ferdige økter fra OLT-skalaen, pluss dine egne økt-, uke- og planmaler. Søk «6x6» og økta ligger klar.' },
          { title: 'Sone-mål per drag', body: 'Plan-økter spesifiserer mål-tid per sone (I1-I5, Hurtighet) - avvik flagges ved logging.' },
        ]}
      />

      <SportFeatureSection
        kicker={NYTT_I_VERSJON}
        title="PLANLEGGING PÅ SEKUNDER."
        intro="Intervalløkta bygges på fire tastetrykk: antall, dragtid, sone, pause - hele strukturen genereres som aktivitetsrader. Eller velg blant 58 ferdige øktmaler bygget på Olympiatoppens intensitetsskala, med oppvarming og nedjogg klart."
        bullets={[
          { title: 'Intervall-byggeren', body: 'Antall × dragtid × sone / pause. Stable rader for pyramider og progressive økter - skiskyttere velger skyting i pausene.' },
          { title: '58 øktmaler fra OLT-skalaen', body: 'Terskel, I4/I5, motbakke, fartslek, komb og tester - velg, juster, lagre som din egen.' },
          { title: 'Standardøkter', body: 'Koble gjentakelser av samme økt i en serie og se utviklingen som én graf gjennom sesongen.' },
        ]}
      />

      <SportFeatureSection
        kicker="Dagbok-modus"
        title="TILBAKEBLIKK OG ANALYSE."
        intro="Dagbok viser det du faktisk har gjort, sortert på dato med kalender-oversikt. Klikk på en dag for full detalj, søk på tagger, filtrer på sport eller intensitet."
        bullets={[
          { title: 'Kalender og dag-modal', body: 'Måneds-, uke- og dags-visning. Klikk en dag → full liste med tider, soner og notater.' },
          { title: 'Søk og tagger', body: 'F.eks. "alle harde I4-økter på asfalt med dårlig HRV siste 3 måneder" - søkbart.' },
          { title: 'Aggregater per uke', body: 'Volum, høydemeter, sone-tid og økt-antall vises som banner over hver uke.' },
        ]}
      />

      <SportFeatureSection
        kicker="Notater"
        title="TANKER PER UKE OG MÅNED."
        intro="Per-økt-notater fanger hva som skjedde i én økt; per-periode-notater fanger refleksjon over flere økter. To notat-felt per uke (Plan og Dagbok) lar deg skille mellom hva du tenkte du skulle gjøre og hva du faktisk lærte."
        bullets={[
          { title: 'Uke-, måned- og periode-notat', body: 'Én tekst per uke/måned/sesong-periode i både Plan og Dagbok-modus.' },
          { title: 'Plan-notat synlig i Dagbok', body: 'Når du logger uka ser du planen din ved siden av - som read-only-blokk.' },
          { title: 'Trener kan kommentere', body: 'Trener får en egen kommentar-tråd per periode hvis de har tilgang.' },
        ]}
      />

      <SportFeatureSection
        kicker="Trener-dialog"
        title="KOMMENTARER PÅ ØKTNIVÅ."
        intro="Trener-kommentarene ligger der øktene ligger - ikke i en separat innboks. Når treneren skriver noe på dagens økt får du varsel; når du svarer får treneren det."
        bullets={[
          { title: 'Per-økt-tråd', body: 'Kommentar-bobler vises ved siden av økten i kalenderen.' },
          { title: 'Lese-kvittering', body: 'Begge sider ser når den andre har lest meldingen.' },
          { title: 'Direktemelding utenfor økt', body: 'Egen DM-tråd per utøver-trener-relasjon for det som ikke hører til en bestemt økt.' },
        ]}
      />

      <SportPageCTA />
    </LandingShell>
  )
}
