// UNDERSIDENE v2 bolk B5 - FAQ med FAQPage JSON-LD. <details> gjør at spørsmålene
// åpner og lukker uten JS; det første står åpent.

export interface FaqPost { sporsmal: string; svar: string }

export function LandingFaq({ poster, tittel = 'SPØRSMÅL OG SVAR' }: { poster: FaqPost[]; tittel?: string }) {
  if (poster.length === 0) return null
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: poster.map(p => ({
      '@type': 'Question',
      name: p.sporsmal,
      acceptedAnswer: { '@type': 'Answer', text: p.svar },
    })),
  }
  return (
    <section className="lp-faq" id="faq">
      <div className="lp-kap">Spørsmål</div>
      <h2>{tittel}</h2>
      {poster.map((p, i) => (
        <details key={p.sporsmal} className="lp-sp" open={i === 0}>
          <summary>{p.sporsmal}<i aria-hidden>+</i></summary>
          <p>{p.svar}</p>
        </details>
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  )
}
