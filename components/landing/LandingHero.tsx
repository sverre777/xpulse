import Link from 'next/link'

// UNDERSIDENE v2 bolk B2 - heroen. Fullbredde bilde med mørkt slør + gradient-slør,
// brødsmuler med BreadcrumbList JSON-LD, kicker, H1 = SØKEORDET (hentet fra seoTitle
// i lib/landing-meta.ts - én kilde), ingress, to CTA-er og en rad bevis-chips.
// Bildet er hero-bildet: fetchpriority="high", tre bredder i srcset.

export interface Smule { navn: string; href?: string }

interface Props {
  /** Filnavn uten bredde og endelse i public/underside/, f.eks. langrenn-hoved-rulleski-kollen. */
  bilde: string
  alt: string
  smuler: Smule[]
  kicker: string
  /** Søkeordet, f.eks. «Treningsdagbok for langrenn». Siste ord får oransje. */
  overskrift: string
  ingress: string
  bevis: string[]
  ctaHref?: string
  ctaTekst?: string
  ctaSekHref?: string
  ctaSekTekst?: string
}

const BASE = 'https://x-pulse.no'

export function LandingHero({
  bilde, alt, smuler, kicker, overskrift, ingress, bevis,
  ctaHref = '/xpulse.html#priser', ctaTekst = 'Start gratis prøve',
  ctaSekHref = '#okt', ctaSekTekst = 'Se hvordan det virker',
}: Props) {
  const ord = overskrift.trim().split(' ')
  const siste = ord.pop() ?? ''
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: smuler.map((s, i) => ({
      '@type': 'ListItem', position: i + 1, name: s.navn,
      ...(s.href ? { item: `${BASE}${s.href}` } : {}),
    })),
  }
  return (
    <div className="lp-uhero">
      <img className="lp-bg" src={`/underside/${bilde}-1920.webp`} alt={alt}
        srcSet={`/underside/${bilde}-760.webp 760w, /underside/${bilde}-1280.webp 1280w, /underside/${bilde}-1920.webp 1920w`}
        sizes="100vw" fetchPriority="high" decoding="async" />
      <div className="lp-sk" />
      <div className="lp-inn">
        <nav className="lp-smul" aria-label="Brødsmuler">
          {smuler.map((s, i) => (
            <span key={s.navn}>
              {i > 0 && <span aria-hidden>›</span>}
              {s.href ? <Link href={s.href}>{s.navn}</Link> : <span style={{ color: 'rgba(255,255,255,.9)', margin: 0 }}>{s.navn}</span>}
            </span>
          ))}
        </nav>
        <div className="lp-kap">{kicker}</div>
        <h1>{ord.join(' ')} <em>{siste}</em></h1>
        <p>{ingress}</p>
        <div className="lp-cta">
          <Link href={ctaHref} className="lp-pill">{ctaTekst}</Link>
          <a href={ctaSekHref} className="lp-pill ghost">{ctaSekTekst}</a>
        </div>
        <div className="lp-bevis">{bevis.map(b => <span key={b}>{b}</span>)}</div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
