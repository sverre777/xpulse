import Link from 'next/link'
import { LegalLayout, LegalH2, LegalP } from '@/components/legal/LegalLayout'

export const metadata = {
  title: 'Kontakt — X-PULSE',
  description: 'Kontaktinformasjon for X-PULSE og Strava-relaterte spørsmål.',
}

export default function KontaktPage() {
  return (
    <LegalLayout title="Kontakt X-PULSE" updatedAt="2026-05-16">
      <LegalH2>Generell støtte</LegalH2>
      <LegalP>
        <a href="mailto:support@x-pulse.no" style={{ color: '#FF4500' }}>support@x-pulse.no</a>
      </LegalP>

      <LegalH2>Strava-tilkobling-problemer</LegalH2>
      <LegalP>Hvis du opplever problemer med Strava-tilkoblingen:</LegalP>
      <LegalP>
        — Sjekk at du har gitt X-PULSE tilgang via OAuth<br />
        — Sjekk om Strava har endret tilgangsinnstillinger<br />
        — Kontakt:{' '}
        <a href="mailto:support@x-pulse.no?subject=Strava-problem" style={{ color: '#FF4500' }}>
          support@x-pulse.no
        </a>{' '}
        med emnefelt &laquo;Strava-problem&raquo;
      </LegalP>

      <LegalH2>Personvern og data-sletting</LegalH2>
      <LegalP>
        Be om sletting av dine data:{' '}
        <a href="mailto:privacy@x-pulse.no" style={{ color: '#FF4500' }}>privacy@x-pulse.no</a>
      </LegalP>

      <LegalH2>Selskap</LegalH2>
      <LegalP>
        <strong>X-PULSE AS</strong><br />
        Org.nr 923 830 146<br />
        Norge
      </LegalP>

      <div className="mt-10">
        <Link
          href="/"
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}
        >
          ← Tilbake
        </Link>
      </div>
    </LegalLayout>
  )
}
