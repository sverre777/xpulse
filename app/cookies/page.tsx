import Link from 'next/link'
import { LegalLayout, LegalH2, LegalP, LegalUL, LegalLI } from '@/components/legal/LegalLayout'

export const metadata = {
  title: 'Cookies — X-PULSE',
  description: 'Hvordan X-PULSE bruker cookies og lokal lagring.',
}

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookies" updatedAt="[DATO]">
      <LegalP>
        X-PULSE bruker cookies og tilsvarende teknologi (localStorage, sessionStorage)
        for å levere og sikre tjenesten. Denne siden forklarer hva vi bruker og hvorfor.
      </LegalP>

      <LegalH2>1. Hva er cookies</LegalH2>
      <LegalP>
        Cookies er små tekstfiler som lagres i nettleseren din. De brukes til å huske
        innstillinger, holde deg innlogget og forbedre opplevelsen.
      </LegalP>

      <LegalH2>2. Cookies vi bruker</LegalH2>

      <h3
        className="text-lg mt-4 mb-1"
        style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}
      >
        Strengt nødvendige
      </h3>
      <LegalP>
        Disse er påkrevd for at tjenesten skal fungere. De kan ikke skrus av.
      </LegalP>
      <LegalUL>
        <LegalLI><strong>sb-access-token, sb-refresh-token (Supabase):</strong> holder deg innlogget. Slettes ved utlogging.</LegalLI>
        <LegalLI><strong>xpulse-consent (localStorage):</strong> husker ditt valg fra cookie-banneret slik at vi ikke spør på nytt.</LegalLI>
      </LegalUL>

      <h3
        className="text-lg mt-4 mb-1"
        style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}
      >
        Funksjonelle (lokal lagring)
      </h3>
      <LegalP>
        Vi bruker localStorage til å lagre dine UI-preferanser direkte i nettleseren —
        f.eks. valgt visning, sortering og filterstatus. Disse forlater ikke enheten din.
      </LegalP>

      <h3
        className="text-lg mt-4 mb-1"
        style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}
      >
        Analyse og markedsføring
      </h3>
      <LegalP>
        Vi bruker <strong>ingen</strong> tredjeparts analyse- eller markedsføringscookies
        i beta. Hvis dette endrer seg, vil du bli bedt om eksplisitt samtykke før de
        aktiveres.
      </LegalP>

      <LegalH2>3. Administrere cookies</LegalH2>
      <LegalP>
        Du kan slette eller blokkere cookies i nettleseren din. Merk at dette kan gjøre
        at deler av tjenesten ikke fungerer (f.eks. innlogging).
      </LegalP>
      <LegalP>
        Du kan også når som helst tilbakestille samtykke-valget ditt ved å slette
        nøkkelen <code>xpulse-consent</code> i nettleserens lokale lagring.
      </LegalP>

      <LegalH2>4. Kontakt</LegalH2>
      <LegalP>
        Spørsmål om cookies? Kontakt <strong>[Sverre / X-PULSE]</strong> på
        <strong> [kontakt-e-post]</strong>.
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
