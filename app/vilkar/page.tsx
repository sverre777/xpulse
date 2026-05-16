import Link from 'next/link'
import { LegalLayout, LegalH2, LegalP, LegalUL, LegalLI } from '@/components/legal/LegalLayout'

export const metadata = {
  title: 'Brukervilkår — X-PULSE',
  description: 'Vilkår for bruk av X-PULSE.',
}

export default function VilkarPage() {
  return (
    <LegalLayout title="Brukervilkår" updatedAt="2026-05-18">
      <LegalP>
        Disse vilkårene gjelder for din bruk av X-PULSE («tjenesten»). Ved å registrere
        deg eller bruke tjenesten godtar du vilkårene. Tjenesten leveres av
        <strong> X-PULSE AS</strong> (org.nr <strong>923 830 146</strong>).
      </LegalP>

      <LegalH2>1. Tjenesten</LegalH2>
      <LegalP>
        X-PULSE er en treningsapp for utholdenhetsidretter (løping, langrenn, skiskyting,
        triatlon m.fl.). Tjenesten lar deg logge økter, planlegge sesonger, analysere
        treningen og dele data med trener.
      </LegalP>
      <LegalP>
        <strong>Beta:</strong> tjenesten er for tiden i beta. Det kan forekomme feil,
        nedetid og endringer i funksjonalitet. Ikke bruk tjenesten som eneste lagring av
        kritiske data — ta egne sikkerhetskopier.
      </LegalP>

      <LegalH2>2. Konto og ansvar</LegalH2>
      <LegalUL>
        <LegalLI>Du må være minst 16 år for å opprette konto på egen hånd. Mellom 13 og 16 år kreves samtykke fra foresatte.</LegalLI>
        <LegalLI>Du er ansvarlig for å holde passordet ditt hemmelig og for all aktivitet på kontoen din.</LegalLI>
        <LegalLI>Du må gi korrekte opplysninger ved registrering og holde kontoinformasjonen oppdatert.</LegalLI>
        <LegalLI>Én konto per person. Kontoen er personlig og kan ikke overdras.</LegalLI>
      </LegalUL>

      <LegalH2>3. Aksepterbar bruk</LegalH2>
      <LegalP>Du forplikter deg til å ikke:</LegalP>
      <LegalUL>
        <LegalLI>Bruke tjenesten i strid med norsk lov.</LegalLI>
        <LegalLI>Forsøke å hacke, omgå sikkerhet, eller hente ut data du ikke har tilgang til.</LegalLI>
        <LegalLI>Laste opp skadevare, trakasserende eller ulovlig innhold.</LegalLI>
        <LegalLI>Bruke automatiske skript til å belaste tjenesten unødig.</LegalLI>
        <LegalLI>Etterligne andre eller misbruke trener-utøver-funksjonen.</LegalLI>
      </LegalUL>
      <LegalP>
        Brudd kan føre til umiddelbar suspensjon av kontoen.
      </LegalP>

      <LegalH2>4. Helse og medisinsk ansvarsfraskrivelse</LegalH2>
      <LegalP>
        X-PULSE er <strong>ikke</strong> en medisinsk tjeneste. Innholdet, beregningene og
        rådene i appen er ikke medisinske råd og erstatter ikke konsultasjon med lege,
        fysioterapeut eller kvalifisert trener. Du bruker tjenesten på eget ansvar. Ved
        skade, sykdom eller helseproblemer skal du oppsøke kvalifisert helsepersonell.
      </LegalP>
      <LegalP>
        Beregninger som puls-soner, treningsbelastning og lignende er estimater basert på
        modeller som ikke nødvendigvis passer for alle individer.
      </LegalP>

      <LegalH2>5. Eierskap til data</LegalH2>
      <LegalP>
        Du beholder eierskapet til dataene du legger inn (økter, notater, planer m.m.).
        Ved å bruke tjenesten gir du oss en begrenset, ikke-eksklusiv lisens til å lagre,
        behandle og vise dataene tilbake til deg slik at vi kan levere tjenesten.
      </LegalP>
      <LegalP>
        Vi gjør ikke krav på dataene dine og selger dem ikke videre.
      </LegalP>

      <LegalH2>6. Trener-utøver-relasjon</LegalH2>
      <LegalP>
        Når du som utøver kobler deg til en trener, gir du treneren tilgang til å se
        treningsdata, planer og notater du deler. Du kan når som helst koble fra i
        innstillingene. X-PULSE er ikke part i avtalen mellom utøver og trener.
      </LegalP>

      <LegalH2>7. Pris og betaling</LegalH2>
      <LegalP>
        I beta er tjenesten gratis. Når kommersielle vilkår innføres, vil eksisterende
        brukere varsles i god tid før eventuell betaling kreves, og kan velge å si opp
        kontoen før det.
      </LegalP>

      <LegalH2>8. Oppsigelse</LegalH2>
      <LegalP>
        Du kan slette kontoen din når som helst i innstillingene. Ved sletting fjernes
        dataene dine permanent innen 30 dager.
      </LegalP>
      <LegalP>
        Vi kan suspendere eller terminere kontoen din ved vesentlig brudd på vilkårene,
        eller dersom tjenesten avsluttes. Du varsles på forhånd der det er mulig.
      </LegalP>

      <LegalH2>9. Ansvarsbegrensning</LegalH2>
      <LegalP>
        Tjenesten leveres «som den er». I den grad loven tillater det, fraskriver vi oss
        ansvar for indirekte tap, tapt fortjeneste, tap av data og følgeskader. Vårt
        samlede ansvar er begrenset til det du har betalt for tjenesten de siste 12
        månedene (kr 0 i beta).
      </LegalP>
      <LegalP>
        Ansvarsbegrensningen gjelder ikke for skade som skyldes grov uaktsomhet eller
        forsett, eller annet som ikke kan begrenses etter ufravikelig lov.
      </LegalP>

      <LegalH2 id="abonnement">10. Abonnement og betaling</LegalH2>
      <LegalP>X-PULSE tilbyr følgende abonnement-tiers:</LegalP>
      <LegalUL>
        <LegalLI>Athlete Pro 59 kr/mnd</LegalLI>
        <LegalLI>Athlete Pro AI 129 kr/mnd (kommer)</LegalLI>
        <LegalLI>Athlete Ultimate AI 399 kr/mnd (kommer)</LegalLI>
        <LegalLI>Trener Basic 199 kr/mnd</LegalLI>
        <LegalLI>Trener Pro 279 kr/mnd</LegalLI>
        <LegalLI>Trener Pro AI 499 kr/mnd (kommer)</LegalLI>
        <LegalLI>Trener Ultimate AI 999 kr/mnd (kommer)</LegalLI>
      </LegalUL>

      <LegalP><strong>Gratis prøveperiode:</strong> Alle nye brukere får 30 dagers gratis prøveperiode. Etter prøveperiodens utløp må aktivt abonnement være på plass for å fortsette å bruke /app-tjenestene.</LegalP>

      <LegalP><strong>Fakturering:</strong> Abonnement fornyes automatisk månedlig via Stripe. Du kan kansellere når som helst via{' '}
        <a href="/app/abonnement" style={{ color: '#FF4500' }}>/app/abonnement</a>. Etter kansellering har du tilgang ut betalingsperioden.
      </LegalP>

      <LegalP><strong>Data ved abonnement-utløp:</strong></LegalP>
      <LegalUL>
        <LegalLI>Du mister tilgang til /app-funksjonene umiddelbart</LegalLI>
        <LegalLI>Dataen din BEHOLDES i 90 dager etter utløp</LegalLI>
        <LegalLI>Du kan eksportere alle dine data når som helst via{' '}
          <a href="/app/innstillinger/data-eksport" style={{ color: '#FF4500' }}>/app/innstillinger/data-eksport</a></LegalLI>
        <LegalLI>Du kan aktivere abonnementet på nytt innen 90 dager for å gjenopprette tilgang med all data intakt</LegalLI>
        <LegalLI>Etter 90 dager slettes all data automatisk i tråd med GDPR</LegalLI>
      </LegalUL>

      <LegalP><strong>Varsling:</strong> Vi sender e-post-varsler 30, 7 og 1 dag før data slettes.</LegalP>

      <LegalH2>11. Strava-integrasjon</LegalH2>
      <LegalP>
        Ved å bruke Strava-integrasjonen i X-PULSE samtykker du til{' '}
        <a href="https://www.strava.com/legal/api" target="_blank" rel="noopener noreferrer" style={{ color: '#FF4500' }}>
          Strava sin API Agreement
        </a>{' '}
        i tillegg til X-PULSE sine vilkår.
      </LegalP>
      <LegalP>Du forstår at:</LegalP>
      <LegalUL>
        <LegalLI>Stravas regler krever at vi sletter rå Strava-data etter 7 dager</LegalLI>
        <LegalLI>Ved frakobling slettes ALL importert Strava-data innen 48 timer</LegalLI>
        <LegalLI>Du kan beholde data permanent ved manuell .fit-fil-opplasting</LegalLI>
      </LegalUL>
      <LegalP>
        Ved brudd på Strava sine vilkår fra vår side kan din tilgang til Strava-integrasjonen
        begrenses eller fjernes.
      </LegalP>

      <LegalH2>12. Endringer i vilkårene</LegalH2>
      <LegalP>
        Vi kan endre vilkårene. Vesentlige endringer varsles på e-post eller i appen minst
        30 dager før de trer i kraft. Hvis du ikke godtar endringene, kan du si opp
        kontoen.
      </LegalP>

      <LegalH2>13. Lovvalg og tvisteløsning</LegalH2>
      <LegalP>
        Vilkårene reguleres av norsk rett. Tvister søkes løst i minnelighet. Hvis det
        ikke lykkes, er <strong>[Verneting]</strong> avtalt verneting.
      </LegalP>
      <LegalP>
        Forbrukere kan også henvende seg til Forbrukertilsynet eller bruke EUs
        nettbaserte tvisteløsningsplattform.
      </LegalP>

      <LegalH2>14. Kontakt</LegalH2>
      <LegalP>
        Spørsmål om vilkårene? Kontakt <strong>X-PULSE AS</strong> (org.nr 923 830 146)
        på <strong><a href="mailto:support@x-pulse.no" style={{ color: '#FF4500' }}>support@x-pulse.no</a></strong>.
      </LegalP>

      <div className="mt-10">
        <Link
          href="/app"
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}
        >
          ← Tilbake
        </Link>
      </div>
    </LegalLayout>
  )
}
