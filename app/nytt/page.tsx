import { LandingShell } from '@/components/landing/LandingShell'
import {
  CHANGELOG,
  CHANGELOG_VERSION,
  CHANGELOG_VISIBLE,
  formatChangelogDate,
  groupChangelogByDate,
} from '@/lib/changelog'

// Offentlig side — må virke utlogget, den lenkes fra hero og fra alle fire
// footere. Typografien og bredden er den samme som /vilkar og /personvern,
// men lagt her framfor i LegalLayout: den layouten skriver «Sist oppdatert»
// over undertittelen, og her skal det stå et versjonsnummer.
// Innholdet kommer fra lib/changelog.ts — redaksjonelle regler ligger der.

export const metadata = {
  title: 'Hva er nytt — X-PULSE',
  description: 'De siste funksjonene og forbedringene i X-PULSE.',
}

const FONT_TITTEL = "'Bebas Neue', sans-serif"
const FONT_TEKST = "'Barlow Condensed', sans-serif"

export default function NyttPage() {
  const grupper = groupChangelogByDate(CHANGELOG.slice(0, CHANGELOG_VISIBLE))

  return (
    <LandingShell>
      <div className="px-4 py-12" style={{ backgroundColor: '#0A0A0B' }}>
        <div className="max-w-3xl mx-auto">
          <span
            className="inline-block mb-4 px-2.5 py-1 text-xs tracking-widest uppercase"
            style={{
              fontFamily: FONT_TEKST,
              color: '#FF4500',
              border: '1px solid #2A2A30',
              letterSpacing: '0.2em',
            }}
          >
            Versjon {CHANGELOG_VERSION}
          </span>

          <h1
            className="text-5xl md:text-6xl mb-2"
            style={{ fontFamily: FONT_TITTEL, color: '#F0F0F2', letterSpacing: '0.08em' }}
          >
            Hva er nytt
          </h1>
          <p
            className="text-xs tracking-widest uppercase mb-12"
            style={{ fontFamily: FONT_TEKST, color: '#55555F' }}
          >
            De siste oppdateringene i appen
          </p>

          <div className="flex flex-col gap-12">
            {grupper.map(gruppe => (
              <section key={gruppe.date}>
                <h2
                  className="text-xs tracking-widest uppercase pb-3 mb-6"
                  style={{
                    fontFamily: FONT_TEKST,
                    color: '#8A8A96',
                    letterSpacing: '0.24em',
                    borderBottom: '1px solid #1E1E22',
                  }}
                >
                  <time dateTime={gruppe.date}>{formatChangelogDate(gruppe.date)}</time>
                </h2>

                <ul className="flex flex-col gap-7 list-none p-0">
                  {gruppe.entries.map(entry => (
                    <li key={entry.title} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="shrink-0 mt-2"
                        style={{ width: 6, height: 6, backgroundColor: '#FF4500' }}
                      />
                      <div>
                        <h3
                          className="text-2xl mb-1"
                          style={{
                            fontFamily: FONT_TITTEL,
                            color: '#F0F0F2',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {entry.title}
                        </h3>
                        <p
                          style={{
                            fontFamily: FONT_TEKST,
                            color: '#C0C0CC',
                            fontSize: '16px',
                            lineHeight: 1.6,
                          }}
                        >
                          {entry.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </LandingShell>
  )
}
