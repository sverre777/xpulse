import Link from 'next/link'
import { LegalLayout, LegalH2, LegalP, LegalUL, LegalLI } from '@/components/legal/LegalLayout'

export const metadata = {
  title: 'Personvernerklæring - X-PULSE',
  description: 'Hvordan X-PULSE håndterer personopplysninger.',
}

export default function PersonvernPage() {
  return (
    <LegalLayout title="Personvernerklæring" updatedAt="2026-05-18">
      <LegalP>
        Denne personvernerklæringen forklarer hvordan X-PULSE samler inn, bruker og beskytter
        personopplysningene dine når du bruker tjenesten. Vi følger personopplysningsloven og
        EUs personvernforordning (GDPR).
      </LegalP>

      <LegalH2>1. Behandlingsansvarlig</LegalH2>
      <LegalP>
        Behandlingsansvarlig for personopplysningene er <strong>X-PULSE AS</strong>,
        org.nr <strong>923 830 146</strong>. Spørsmål om personvern kan rettes til oss på
        e-post: <strong><a href="mailto:support@x-pulse.no" style={{ color: '#FF4500' }}>support@x-pulse.no</a></strong>.
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
        <LegalLI><strong>Netlify (databehandler):</strong> hosting av nettapplikasjonen.</LegalLI>
        <LegalLI><strong>Stridee (databehandler):</strong> formidler klokkedata (aktivitetsfiler og helse-sammendrag) fra Garmin, COROS, Wahoo og Zepp til oss. Se eget avsnitt om klokkesynk.</LegalLI>
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
        For å bruke disse rettighetene, kontakt oss på <strong><a href="mailto:support@x-pulse.no" style={{ color: '#FF4500' }}>support@x-pulse.no</a></strong> eller
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

      <LegalH2 id="strava">9. Strava-integrasjon</LegalH2>
      <LegalP>
        X-PULSE støtter import av treningsdata fra Strava. Ved å koble til Strava-kontoen
        din samtykker du til følgende databehandling:
      </LegalP>
      <LegalP><strong>Hvilke data vi henter:</strong></LegalP>
      <LegalUL>
        <LegalLI>Treningsøkter: tittel, sport, varighet, distanse, dato</LegalLI>
        <LegalLI>Puls-data: snittpuls, makspuls, sonefordeling</LegalLI>
        <LegalLI>Aktivitet-data: lap-tider, watt, kadens, høydemeter</LegalLI>
        <LegalLI>Posisjonsdata: GPS-koordinater og rute (slettes etter 7 dager)</LegalLI>
        <LegalLI>Streams: sekund-for-sekund puls, watt, pace (slettes etter 7 dager)</LegalLI>
      </LegalUL>
      <LegalP><strong>Hvordan vi behandler data:</strong></LegalP>
      <LegalUL>
        <LegalLI>Strava-data vises KUN til den autentiserte brukeren</LegalLI>
        <LegalLI>Trenere får tilgang kun med utøvers eksplisitte per-trener-samtykke</LegalLI>
        <LegalLI>Strava-data brukes ALDRI til AI/ML-modelltrening</LegalLI>
        <LegalLI>Strava-data deles ALDRI med tredjeparter, advertisers eller data brokers</LegalLI>
        <LegalLI>Strava-data kombineres ALDRI med annen kundedata for aggregat-analyse</LegalLI>
      </LegalUL>
      <LegalP><strong>Lagring og sletting:</strong></LegalP>
      <LegalUL>
        <LegalLI>Aggregerte verdier (varighet, distanse, sone-fordeling, lap-data) lagres så lenge Strava er koblet til</LegalLI>
        <LegalLI>Rå Strava-data (samples, GPS) slettes automatisk etter 7 dager (Stravas API-krav)</LegalLI>
        <LegalLI>Ved frakobling slettes ALL importert Strava-data innen 48 timer (Stravas API Agreement § 5.4)</LegalLI>
        <LegalLI>Brukere kan eksportere .fit-filer manuelt fra Strava og laste opp til X-PULSE for permanent lagring av egne data</LegalLI>
      </LegalUL>
      <LegalP><strong>Bruker-rettigheter:</strong></LegalP>
      <LegalUL>
        <LegalLI>Du kan frakoble Strava når som helst på <Link href="/app/innstillinger/klokkesync" style={{ color: '#FF4500' }}>/app/innstillinger/klokkesync</Link></LegalLI>
        <LegalLI>Du kan be om sletting av alle dine data ved å kontakte <a href="mailto:support@x-pulse.no" style={{ color: '#FF4500' }}>support@x-pulse.no</a></LegalLI>
        <LegalLI>Du kan eksportere dine X-PULSE-data via egen eksport-funksjon</LegalLI>
      </LegalUL>
      <LegalP><strong>Sikkerhet:</strong></LegalP>
      <LegalUL>
        <LegalLI>All Strava-kommunikasjon over HTTPS</LegalLI>
        <LegalLI>OAuth 2.0-autentisering</LegalLI>
        <LegalLI>Security breaches rapporteres til Strava innen 24 timer per § 2.8 i deres API Agreement</LegalLI>
        <LegalLI>Vi følger Strava sine API Brand Guidelines og API Agreement i sin helhet</LegalLI>
      </LegalUL>
      <LegalP>
        For Strava sin egen personvernpolicy: <a href="https://www.strava.com/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#FF4500' }}>strava.com/legal/privacy</a>.
      </LegalP>

      <LegalH2 id="polar">10. Polar-integrasjon</LegalH2>
      <LegalP>
        X-PULSE støtter import av treningsdata fra Polar (Polar AccessLink). Ved å koble til
        Polar-kontoen din samtykker du til følgende databehandling. Datakilden krediteres som
        «Polar Ecosystem» der Polar-data vises.
      </LegalP>
      <LegalP><strong>Hvilke data vi henter:</strong></LegalP>
      <LegalUL>
        <LegalLI>Treningsøkter: sport, varighet, distanse, dato og klokkeslett</LegalLI>
        <LegalLI>Puls-data: snittpuls, makspuls og sekund-for-sekund puls der klokka har lagret det</LegalLI>
        <LegalLI>Fart, kadens og høyde der Polar leverer det</LegalLI>
        <LegalLI>Polars bruker-id (x_user_id), som er nødvendig for å vite hvilke data som er dine</LegalLI>
      </LegalUL>
      <LegalP><strong>Hva vi IKKE henter:</strong></LegalP>
      <LegalUL>
        <LegalLI>Vi lagrer ingen personopplysninger fra Polar-profilen din - ikke navn, fødselsdato, kjønn eller vekt</LegalLI>
        <LegalLI>Søvn og nattlig restitusjon (Nightly Recharge) hentes til helse-loggen hvis du har koblet Polar - se avsnittet om helse- og søvndata for reglene som gjelder disse</LegalLI>
      </LegalUL>
      <LegalP><strong>Hvordan vi behandler data:</strong></LegalP>
      <LegalUL>
        <LegalLI>Polar-data vises KUN til den autentiserte brukeren</LegalLI>
        <LegalLI>Trenere får tilgang kun med utøvers eksplisitte per-trener-samtykke</LegalLI>
        <LegalLI>Polar-data brukes ALDRI til AI/ML-modelltrening</LegalLI>
        <LegalLI>Polar-data deles ALDRI med tredjeparter, advertisers eller data brokers</LegalLI>
        <LegalLI>Polar-data kombineres ALDRI med annen kundedata for aggregat-analyse</LegalLI>
        <LegalLI>Sonefordeling regnes ut hos oss fra din egen pulsskala - vi bruker ikke Polars soner</LegalLI>
      </LegalUL>
      <LegalP><strong>Lagring og sletting:</strong></LegalP>
      <LegalUL>
        <LegalLI>Polar gir kun tilgang til økter fra de siste 30 dagene, og kun økter lastet opp etter at du koblet til</LegalLI>
        <LegalLI>Importerte økter og tilhørende data lagres så lenge Polar er koblet til</LegalLI>
        <LegalLI>Ved frakobling slettes ALL importert Polar-data umiddelbart: økter, aktiviteter, rå sekund-data og import-sporing</LegalLI>
        <LegalLI>Ved frakobling avregistreres X-PULSE hos Polar og tilgangen (tokenet) trekkes tilbake, slik Polars API-lisensavtale krever</LegalLI>
        <LegalLI>Brukere kan eksportere .fit-filer manuelt fra Polar Flow og laste opp til X-PULSE for permanent lagring av egne data</LegalLI>
      </LegalUL>
      <LegalP><strong>Bruker-rettigheter:</strong></LegalP>
      <LegalUL>
        <LegalLI>Du kan frakoble Polar når som helst på <Link href="/app/innstillinger/klokkesync" style={{ color: '#FF4500' }}>/app/innstillinger/klokkesync</Link></LegalLI>
        <LegalLI>Du kan be om sletting av alle dine data ved å kontakte <a href="mailto:support@x-pulse.no" style={{ color: '#FF4500' }}>support@x-pulse.no</a></LegalLI>
        <LegalLI>Du kan eksportere dine X-PULSE-data via egen eksport-funksjon</LegalLI>
      </LegalUL>
      <LegalP><strong>Sikkerhet:</strong></LegalP>
      <LegalUL>
        <LegalLI>All Polar-kommunikasjon over HTTPS</LegalLI>
        <LegalLI>OAuth 2.0-autentisering; tokens lagres kun server-side og er utilgjengelige for nettleseren</LegalLI>
        <LegalLI>Varsler fra Polar signeres med HMAC-SHA256 og verifiseres før de behandles</LegalLI>
        <LegalLI>Vi følger Polar sin API-lisensavtale, inkludert kravet om å stanse tilgang og slette tokens ved frakobling</LegalLI>
      </LegalUL>
      <LegalP>
        For Polar sin egen personvernerklæring: <a href="https://www.polar.com/en/legal/privacy-notice" target="_blank" rel="noopener noreferrer" style={{ color: '#FF4500' }}>polar.com/legal/privacy-notice</a>.
      </LegalP>

      <LegalH2 id="klokkesynk">11. Klokkesynk for Garmin, COROS, Wahoo og Zepp (Stridee)</LegalH2>
      <LegalP>
        Direktesynk for Garmin, COROS, Wahoo og Zepp går gjennom <strong>Stridee</strong>{' '}
        (stridee.fit), som er vår <strong>databehandler</strong> for klokkedata. Stridee holder
        API-tilgangene hos klokkeprodusentene og formidler dataene til oss; det er derfor synken
        for disse merkene finnes. Stridee behandler data kun etter instruks fra oss, under en
        databehandleravtale etter GDPR artikkel 28. Integrasjonen er i beta.
      </LegalP>
      <LegalP><strong>Hvilke data som går gjennom Stridee:</strong></LegalP>
      <LegalUL>
        <LegalLI>Aktivitetsfiler: original treningsfil (.fit) fra klokka, med sport, varighet, distanse, puls, fart, kadens og høyde</LegalLI>
        <LegalLI>Helse-sammendrag fra tilkoblede klokker: søvn (faser, varighet, skår), natt-HRV, hvilepuls, skritt og daglig aktivitet - der klokka leverer det (Garmin og COROS; Wahoo og Zepp leverer kun økter)</LegalLI>
        <LegalLI>Tilkoblingsstatus: hvilke klokker som er koblet, og om tilgangen må fornyes</LegalLI>
        <LegalLI>Stridee får ALDRI navnet, e-postadressen eller andre personopplysninger dine fra oss - koblingen skjer med en tilfeldig generert id som ikke kan spores tilbake til deg</LegalLI>
      </LegalUL>
      <LegalP><strong>Hva vi lagrer hos oss:</strong></LegalP>
      <LegalUL>
        <LegalLI>Mottatte hendelser fra leverandøren, som råmateriale for importen - behandlede hendelser slettes automatisk etter 30 dager</LegalLI>
        <LegalLI>Tilkoblingsstatus per klokke</LegalLI>
        <LegalLI>Importerte økter med full pulskurve, lap-data og sonefordeling (innholdet i originalfila)</LegalLI>
        <LegalLI>Søvn, HRV, hvilepuls og skritt i helse-loggen - med kilde per verdi, etter reglene i avsnittet om helse- og søvndata</LegalLI>
      </LegalUL>
      <LegalP><strong>Hvordan vi behandler data:</strong></LegalP>
      <LegalUL>
        <LegalLI>Samme regler som øvrige integrasjoner: data vises kun til deg, trenere kun med ditt eksplisitte samtykke</LegalLI>
        <LegalLI>Brukes ALDRI til AI/ML-modelltrening, deles ALDRI med tredjeparter, annonsører eller datameglere, kombineres ALDRI for aggregat-analyse</LegalLI>
        <LegalLI>Sonefordeling regnes ut hos oss fra din egen pulsskala</LegalLI>
      </LegalUL>
      <LegalP><strong>Lagring, frakobling og sletting:</strong></LegalP>
      <LegalUL>
        <LegalLI>Ved tilkobling hentes rundt 90 dager historikk fra klokkekontoen din</LegalLI>
        <LegalLI>Frakobling stopper all ny synk. Allerede importerte økter er dine originalfiler og beholdes i dagboka - ingen produsent krever sletting av dem</LegalLI>
        <LegalLI>Helse- og søvnverdier importert fra et merke slettes når merket kobles fra, i tråd med helse-avsnittet. Verdier du har ført manuelt slettes aldri</LegalLI>
        <LegalLI>Sletter du X-PULSE-kontoen, slettes alle importerte data sammen med resten av kontoen, og kontoen din hos Stridee avsluttes samtidig. Du kan i tillegg alltid trekke tilgangen tilbake direkte hos klokkeprodusenten (f.eks. i Garmin Connect) - det stopper delingen ved kilden</LegalLI>
      </LegalUL>
      <LegalP><strong>Sikkerhet:</strong></LegalP>
      <LegalUL>
        <LegalLI>Alle leveringer fra leverandøren er ende-til-ende-krypterte og signerte; signaturen verifiseres før noe som helst behandles</LegalLI>
        <LegalLI>Alle våre kall til leverandøren signeres kryptografisk (RFC 9421)</LegalLI>
        <LegalLI>Nøkler lagres kun server-side og er utilgjengelige for nettleseren</LegalLI>
      </LegalUL>
      <LegalP>
        For Stridee sin egen personvernerklæring: <a href="https://stridee.fit/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#FF4500' }}>stridee.fit/privacy</a>.
      </LegalP>

      <LegalH2 id="helse">12. Helse- og søvndata</LegalH2>
      <LegalP>
        Helseopplysninger er <strong>særlige kategorier av personopplysninger</strong> etter
        GDPR artikkel 9. De behandles strengere enn treningsøkter, og du bestemmer selv om
        de i det hele tatt registreres.
      </LegalP>
      <LegalP><strong>Hvilke data det gjelder:</strong></LegalP>
      <LegalUL>
        <LegalLI>Søvn: leggetid, våknetid, sovetid, våkentid, søvnfaser (dyp/lett/REM) og din egen opplevde kvalitet</LegalLI>
        <LegalLI>Puls og restitusjon: hvilepuls, HRV, makspuls</LegalLI>
        <LegalLI>Kropp: vekt</LegalLI>
        <LegalLI>Daglig aktivitet: skritt, aktiv og inaktiv tid, distanse i dagliglivet, trappetrinn og høydemeter</LegalLI>
        <LegalLI>Merkespesifikke skårer fra klokka (f.eks. Polars Nightly Recharge, Garmins Body Battery, stressnivå og søvnskår), lagret for seg og aldri blandet med de øvrige verdiene</LegalLI>
      </LegalUL>
      <LegalP><strong>Vi henter IKKE:</strong></LegalP>
      <LegalUL>
        <LegalLI>Kalorier - verken forbrenning, aktivitetskalorier eller BMR. Estimatene spriker for mye mellom merker til å være meningsfulle, og de utelates bevisst</LegalLI>
        <LegalLI>Biosensing som blodoksygen (SpO2), EKG og hudtemperatur</LegalLI>
        <LegalLI>Kart- og posisjonsdata for helse- og søvnmålinger</LegalLI>
        <LegalLI>Personopplysninger fra klokke-profilen din (navn, fødselsdato, kjønn)</LegalLI>
      </LegalUL>
      <LegalP><strong>Hvem ser dem:</strong></LegalP>
      <LegalUL>
        <LegalLI>Som hovedregel bare deg. Helse og søvn deles ikke automatisk med noen</LegalLI>
        <LegalLI>Trener ser dem KUN hvis du aktivt slår på helse-deling for den treneren under Innstillinger → Trener. Standard er av</LegalLI>
        <LegalLI>Tilgangen arves aldri fra andre trener-tillatelser: at treneren ser dagbok eller analyse gir ikke tilgang til helse eller søvn</LegalLI>
        <LegalLI>Treneren kan kun LESE. Helse- og søvnverdier kan bare føres av deg</LegalLI>
        <LegalLI>Reglene håndheves i databasen, ikke bare i grensesnittet</LegalLI>
      </LegalUL>
      <LegalP><strong>Manuelt ført vs. importert:</strong></LegalP>
      <LegalUL>
        <LegalLI>Hver enkelt verdi er merket med kilde: ført av deg, eller hentet fra et bestemt klokkemerke</LegalLI>
        <LegalLI>En import overskriver aldri en verdi du har ført selv</LegalLI>
        <LegalLI>Kobler du fra et klokkemerke, slettes de importerte helse- og søvnverdiene fra det merket. <strong>Verdier du har ført manuelt slettes aldri</strong></LegalLI>
      </LegalUL>
      <LegalP><strong>Bruk og deling:</strong></LegalP>
      <LegalUL>
        <LegalLI>Helse- og søvndata brukes ALDRI til AI/ML-modelltrening</LegalLI>
        <LegalLI>De deles ALDRI med tredjeparter, annonsører eller datameglere</LegalLI>
        <LegalLI>De kombineres ALDRI med andre brukeres data for aggregat-analyse</LegalLI>
        <LegalLI>Du kan eksportere alt, inkludert kilde per verdi, via data-eksporten</LegalLI>
      </LegalUL>

      <LegalH2 id="stripe">13. Stripe (betalingsbehandling)</LegalH2>
      <LegalP>
        X-PULSE bruker Stripe (Stripe Inc., USA / Stripe Ireland Limited, EU) for å håndtere abonnement og betalinger.
      </LegalP>
      <LegalP><strong>Stripe behandler:</strong></LegalP>
      <LegalUL>
        <LegalLI>Kortinformasjon (sikret med PCI-DSS, lagres aldri på våre servere)</LegalLI>
        <LegalLI>E-post-adresse</LegalLI>
        <LegalLI>Faktureringsadresse hvis du oppgir det</LegalLI>
        <LegalLI>Transaksjonsinformasjon</LegalLI>
      </LegalUL>
      <LegalP>
        Stripe sin databehandling:{' '}
        <a href="https://stripe.com/legal/privacy-center" target="_blank" rel="noopener noreferrer" style={{ color: '#FF4500' }}>
          stripe.com/legal/privacy-center
        </a>
      </LegalP>
      <LegalP><strong>Vi mottar fra Stripe:</strong> subscription-status, tier, periode-dato. Vi mottar ALDRI kortnummer eller CVC.</LegalP>
      <LegalP>
        <strong>Sletting av Stripe-data:</strong> Når du sletter kontoen i X-PULSE, deaktiverer vi Stripe-abonnementet umiddelbart.
        Stripe beholder transaksjonshistorikk for regnskap/skatte-purposes i henhold til deres retningslinjer (typisk 7 år).
        Du kan be Stripe om sletting direkte hvis du ønsker det.
      </LegalP>

      <LegalH2 id="data-eksport">14. Data-eksport (Right to Data Portability)</LegalH2>
      <LegalP>
        Du har til enhver tid rett til å eksportere alle dine personopplysninger lagret i X-PULSE.
        Eksport er tilgjengelig via{' '}
        <Link href="/app/innstillinger/data-eksport" style={{ color: '#FF4500' }}>/app/innstillinger/data-eksport</Link>{' '}
        i JSON-format.
      </LegalP>
      <LegalP><strong>Eksporten inkluderer:</strong></LegalP>
      <LegalUL>
        <LegalLI>Alle treningsøkter (egen og importert)</LegalLI>
        <LegalLI>Alle planlagte økter og treningsplaner</LegalLI>
        <LegalLI>Fysiologiske tester og laktat-målinger</LegalLI>
        <LegalLI>Profil-data (eksklusivt passord og sensitive felt)</LegalLI>
        <LegalLI>Maler og innstillinger</LegalLI>
      </LegalUL>
      <LegalP><strong>Eksporten inkluderer IKKE:</strong></LegalP>
      <LegalUL>
        <LegalLI>Andre brukeres data (selv om du er trener)</LegalLI>
        <LegalLI>Stripe fakturering-historikk (tilgjengelig i Stripe Customer Portal)</LegalLI>
        <LegalLI>Strava raw-data eldre enn 7 dager (Strava API Agreement § 7)</LegalLI>
      </LegalUL>

      <LegalH2 id="sletting">15. Sletting av data (Right to Erasure)</LegalH2>
      <LegalP>
        Du kan slette kontoen og all data permanent når som helst ved å kontakte{' '}
        <a href="mailto:support@x-pulse.no?subject=Sletting%20av%20konto" style={{ color: '#FF4500' }}>support@x-pulse.no</a>.
        Slettingen er irreversibel.
      </LegalP>
      <LegalP>
        Hvis ditt abonnement utløper og du ikke aktiverer det innen 90 dager, slettes all trenings-
        og plan-data automatisk i tråd med GDPR Article 17. Du blir varslet på e-post 30, 7 og
        1 dag før slettingen skjer, så du har full mulighet til å eksportere først eller reaktivere.
      </LegalP>

      <LegalH2>16. Endringer</LegalH2>
      <LegalP>
        Vi kan oppdatere denne erklæringen. Vesentlige endringer varsles på e-post eller
        i appen før de trer i kraft. Sist oppdatert: <strong>2026-05-16</strong>.
      </LegalP>

      <LegalH2>17. Kontakt</LegalH2>
      <LegalP>
        For spørsmål om personvern, kontakt <strong>X-PULSE AS</strong> (org.nr 923 830 146)
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
