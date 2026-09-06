import Link from 'next/link'

// UNDERSIDENE v2 bolk B5 - CTA-båndet i gradienten, nederst på hver underside.
export function LandingBand({
  tittel = 'PRØV DET PÅ EN ØKT.',
  tekst = 'Gratis prøveperiode i 30 dager. Ingen binding - si opp når som helst.',
}: { tittel?: string; tekst?: string }) {
  return (
    <section className="lp-band">
      <h2>{tittel}</h2>
      <p>{tekst}</p>
      <div className="lp-kn">
        <Link href="/xpulse.html#priser" className="lp-pill">Start gratis prøve</Link>
        <Link href="/xpulse.html" className="lp-pill ghost">Gå til forsiden</Link>
      </div>
    </section>
  )
}
