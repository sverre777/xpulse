import Link from 'next/link'
import { LegalLayout, LegalH2, LegalP, LegalUL, LegalLI } from '@/components/legal/LegalLayout'

export const metadata = {
  title: 'Personvernerklæring — X-PULSE',
  description: 'Hvordan X-PULSE håndterer personopplysninger.',
}

export default function PersonvernPage() {
  return (
    <LegalLayout title="Personvernerklæring" updatedAt="[DATO]">
      <LegalP>
        Denne personvernerklæringen forklarer hvordan X-PULSE samler inn, bruker og beskytter
        personopplysningene dine når du bruker tjenesten. Vi følger personopplysningsloven og
        EUs personvernforordning (GDPR).
      </LegalP>

      <LegalH2>1. Behandlingsansvarlig</LegalH2>
      <LegalP>
        Behandlingsansvarlig for personopplysningene er <strong>[Sverre / X-PULSE]</strong>,
        med adresse <strong>[Adresse]</strong>. Spørsmål om personvern kan rettes til oss på
        e-post: <strong>[kontakt-e-post]</strong>.
      </LegalP>

      <LegalH2>2. Hvilke opplysninger vi samler inn</LegalH2>
      <LegalP>Vi samler inn følgende kategorier av opplysninger:</LegalP>
      <LegalUL>
        <LegalLI><strong>Kontoopplysninger:</strong> navn, e-postadresse, valgt rolle (utøver/trener), primærsport.</LegalLI>
        <LegalLI><strong>Treningsdata:</strong> økter, varighet, distanse, intensitet, puls, fart, notater og fokuspunkter du selv legger inn.</LegalLI>
        <LegalLI><strong>Helse- og restitusjon:</strong> søvn, hvilepuls, vekt, sykdomsdager og andre verdier du selv registrerer.</LegalLI>
        <LegalLI><strong>Tilkoblinger:</strong> dersom du knytter trener-utøver-relasjoner, lagres koblingen mellom kontoene.</LegalLI>
        <LegalLI><strong>Tekniske data:</strong> IP-adresse, nettleser og enhetsdata for å sikre tjenesten og rette feil.</LegalLI>
      </LegalUL>

      <LegalH2>3. Hvorfor vi behandler opplysningene</LegalH2>
      <LegalP>Behandlingen skjer på følgende rettsgrunnlag:</LegalP>
      <LegalUL>
        <LegalLI><strong>Avtale (GDPR art. 6(1)(b)):</strong> for å levere tjenesten du har registrert deg for.</LegalLI>
        <LegalLI><strong>Samtykke (GDPR art. 6(1)(a) og art. 9(2)(a)):</strong> for behandling av helserelaterte opplysninger som puls, vekt, sykdom og søvn. Du gir samtykke ved å registrere disse selv. Du kan trekke samtykket når som helst i innstillingene.</LegalLI>
        <LegalLI><strong>Berettiget interesse (GDPR art. 6(1)(f)):</strong> for å sikre, drifte og forbedre tjenesten.</LegalLI>
      </LegalUL>

      <LegalH2>4. Hvem deler vi opplysninger med</LegalH2>
      <LegalP>
        Vi deler ikke personopplysninger med tredjeparter for markedsføring. Følgende
        kategorier av mottakere kan behandle data på våre vegne:
      </LegalP>
      <LegalUL>
        <LegalLI><strong>Supabase (databehandler):</strong> hosting av database og autentisering. Data lagres på servere i EU.</LegalLI>
        <LegalLI><strong>Vercel (databehandler):</strong> hosting av nettapplikasjonen.</LegalLI>
        <LegalLI><strong>Trener-tilkobling:</strong> hvis du som utøver kobler deg til en trener, vil treneren se treningsdata, planer og notater du deler. Du kan når som helst koble fra i innstillingene.</LegalLI>
      </LegalUL>
      <LegalP>
        Alle databehandlere har inngått databehandleravtaler som sikrer GDPR-samsvar.
      </LegalP>

      <LegalH2>5. Lagringstid</LegalH2>
      <LegalP>
        Vi oppbevarer kontoen din og treningsdata så lenge du har en aktiv konto.
        Når du sletter kontoen din, slettes alle personopplysningene dine permanent
        innen 30 dager. Anonymiserte aggregater (uten kobling til deg) kan beholdes for
        statistikk og produktforbedring.
      </LegalP>

      <LegalH2>6. Dine rettigheter</LegalH2>
      <LegalP>Du har rett til å:</LegalP>
      <LegalUL>
        <LegalLI><strong>Innsyn:</strong> få en kopi av personopplysningene vi har om deg.</LegalLI>
        <LegalLI><strong>Retting:</strong> få rettet uriktige opplysninger.</LegalLI>
        <LegalLI><strong>Sletting:</strong> få slettet opplysningene dine. Funksjonen er tilgjengelig i innstillinger.</LegalLI>
        <LegalLI><strong>Dataportabilitet:</strong> få utlevert dataene dine i et maskinlesbart format.</LegalLI>
        <LegalLI><strong>Begrensning og innsigelse:</strong> mot behandling som er basert på berettiget interesse.</LegalLI>
        <LegalLI><strong>Trekke samtykke:</strong> for behandling som krever samtykke (helsedata).</LegalLI>
        <LegalLI><strong>Klage til tilsynsmyndighet:</strong> du kan klage til Datatilsynet (datatilsynet.no).</LegalLI>
      </LegalUL>
      <LegalP>
        For å bruke disse rettighetene, kontakt oss på <strong>[kontakt-e-post]</strong> eller
        bruk verktøyene i innstillingene.
      </LegalP>

      <LegalH2>7. Sikkerhet</LegalH2>
      <LegalP>
        Vi bruker teknisk og organisatoriske sikkerhetstiltak for å beskytte dataene dine,
        inkludert kryptering i transit (TLS), kryptering på lagring, og strenge
        tilgangskontroller (Row-Level Security i databasen). Passord lagres aldri i klartekst.
      </LegalP>

      <LegalH2>8. Mindreårige</LegalH2>
      <LegalP>
        Tjenesten er rettet mot personer over 16 år. Personer mellom 13 og 16 år må ha
        samtykke fra foresatte. Vi samler ikke bevisst inn data fra barn under 13 år.
      </LegalP>

      <LegalH2>9. Endringer</LegalH2>
      <LegalP>
        Vi kan oppdatere denne erklæringen. Vesentlige endringer varsles på e-post eller
        i appen før de trer i kraft. Sist oppdatert: <strong>[DATO]</strong>.
      </LegalP>

      <LegalH2>10. Kontakt</LegalH2>
      <LegalP>
        For spørsmål om personvern, kontakt <strong>[Sverre / X-PULSE]</strong> på
        <strong> [kontakt-e-post]</strong> eller <strong>[Adresse]</strong>.
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
