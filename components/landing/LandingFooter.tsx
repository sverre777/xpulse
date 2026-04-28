import Link from 'next/link'

// Footer brukt på alle funksjoner-undersider. Speiler xpulse.html-footeren
// i innhold men er trimmet ned (ingen sosiale ikoner, kompakt layout) så
// undersidene ikke blir for tunge nederst.

function XLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <clipPath id="lp-foot-tl"><polygon points="0,0 200,200 0,200" /></clipPath>
        <clipPath id="lp-foot-br"><polygon points="0,0 200,0 200,200" /></clipPath>
      </defs>
      <g clipPath="url(#lp-foot-tl)">
        <path d="M 30 30 L 60 30 L 100 90 L 140 30 L 170 30 L 120 100 L 170 170 L 140 170 L 100 110 L 60 170 L 30 170 L 80 100 Z" fill="#FF4500" />
      </g>
      <g clipPath="url(#lp-foot-br)">
        <path d="M 30 30 L 60 30 L 100 90 L 140 30 L 170 30 L 120 100 L 170 170 L 140 170 L 100 110 L 60 170 L 30 170 L 80 100 Z" fill="#1A6FD4" />
      </g>
    </svg>
  )
}

export function LandingFooter() {
  return (
    <footer style={{
      background: '#060607', borderTop: '1px solid #262629',
      padding: '48px 24px 28px', marginTop: 'auto',
    }}>
      <div className="max-w-[1240px] mx-auto grid gap-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Link href="/xpulse.html"
            className="inline-flex items-center gap-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              fontSize: '16px', letterSpacing: '0.4em', color: '#F2F0EC',
              textTransform: 'uppercase', textDecoration: 'none',
            }}>
            <XLogo size={28} />
            <span>PULSE</span>
          </Link>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(242,240,236,0.55)', maxWidth: 280 }}>
            Treningsdagbok og planlegger for utholdenhet.
          </p>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
            letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E78',
          }}>
            Bygget i Norge 🇳🇴
          </p>
        </div>

        <FooterCol label="Funksjoner" items={[
          { href: '/funksjoner/langrenn',   label: 'Langrenn' },
          { href: '/funksjoner/skiskyting', label: 'Skiskyting' },
          { href: '/funksjoner/langlop',    label: 'Langløp' },
          { href: '/funksjoner/loping',     label: 'Løping' },
          { href: '/funksjoner/sykling',    label: 'Sykling' },
          { href: '/funksjoner/triatlon',   label: 'Triatlon' },
        ]} />

        <FooterCol label="Plattform" items={[
          { href: '/funksjoner/analyse',    label: 'Analyse' },
          { href: '/funksjoner/trener',     label: 'Trener' },
          { href: '/funksjoner/klokkesync', label: 'Klokkesync' },
          { href: '/xpulse.html#priser',    label: 'Priser' },
          { href: '/xpulse.html#faq',       label: 'FAQ' },
        ]} />

        <FooterCol label="Selskap" items={[
          { href: 'mailto:support@x-pulse.no', label: 'Kontakt' },
          { href: '/personvern',               label: 'Personvern' },
          { href: '/vilkar',                   label: 'Vilkår' },
          { href: '/cookies',                  label: 'Cookies' },
        ]} />
      </div>

      <div className="max-w-[1240px] mx-auto pt-5 mt-8 flex flex-col sm:flex-row justify-between items-center gap-3"
        style={{
          borderTop: '1px solid #262629',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
          letterSpacing: '0.12em', color: '#6E6E78',
        }}>
        <span>© 2026 X-PULSE</span>
        <span>support@x-pulse.no</span>
      </div>
    </footer>
  )
}

function FooterCol({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  return (
    <div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
        fontSize: '11px', letterSpacing: '0.24em', textTransform: 'uppercase',
        color: '#FF4500', marginBottom: 14,
      }}>
        {label}
      </div>
      <ul className="list-none p-0 flex flex-col gap-2">
        {items.map(i => (
          <li key={i.href}>
            <Link href={i.href}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                letterSpacing: '0.08em', color: 'rgba(242,240,236,0.62)',
                textDecoration: 'none',
              }}>
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
