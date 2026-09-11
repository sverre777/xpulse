import { LandingShell } from '@/components/landing/LandingShell'
import { KontaktSkjema } from '@/components/landing/KontaktSkjema'

// Offentlig side - virker utlogget, lenkes fra hero og alle footere.
// Skjemaet sender til support@x-pulse.no via Netlify Forms; adressen står
// også i klartekst, så folk kan skrive fra sin egen e-post om de vil.

export const metadata = {
  title: 'Kontakt oss - X-PULSE',
  description: 'Spørsmål, feil eller ønsker? Skriv til oss, så svarer vi så snart vi kan.',
}

const FONT_TITTEL = "'Bebas Neue', sans-serif"
const FONT_TEKST = "'Barlow Condensed', sans-serif"

export default function KontaktPage() {
  return (
    <LandingShell>
      <div className="px-4 py-12" style={{ backgroundColor: 'var(--flate-3)' }}>
        <div className="max-w-2xl mx-auto">
          <span className="inline-block mb-4 px-2.5 py-1 text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT_TEKST, color: '#FF4500', border: '1px solid var(--kant-6)', letterSpacing: '0.2em' }}>
            Support
          </span>
          <h1 className="text-5xl md:text-6xl mb-2" style={{ fontFamily: FONT_TITTEL, color: 'var(--tekst-1-app)', letterSpacing: '0.08em' }}>
            Kontakt oss
          </h1>
          <p className="text-lg mb-10" style={{ fontFamily: FONT_TEKST, color: 'var(--tekst-3-app)', lineHeight: 1.55, maxWidth: 560 }}>
            Spørsmål om appen, en synk som ikke kom inn, noe som ser feil ut, eller en
            funksjon du savner - skriv til oss. Vi leser alt, og svarer så snart vi kan.
          </p>

          <KontaktSkjema />

          <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--kant-3)' }}>
            <p className="text-xs tracking-widest uppercase mb-2" style={{ fontFamily: FONT_TEKST, color: 'var(--tekst-8-alt)', letterSpacing: '0.24em' }}>
              E-post
            </p>
            <a href="mailto:support@x-pulse.no" className="text-2xl"
              style={{ fontFamily: FONT_TITTEL, color: '#FF4500', letterSpacing: '0.05em', textDecoration: 'none' }}>
              support@x-pulse.no
            </a>
            <p className="mt-3 text-sm" style={{ fontFamily: FONT_TEKST, color: 'var(--tekst-5-app)' }}>
              X-PULSE AS · org.nr 923 830 146 · Norge
            </p>
          </div>
        </div>
      </div>
    </LandingShell>
  )
}
