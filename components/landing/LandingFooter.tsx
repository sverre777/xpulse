import Link from 'next/link'
import { XPulseIcon } from '@/components/branding/XPulseIcon'

// Footer brukt på alle funksjoner-undersider. Speiler xpulse.html-footeren
// i innhold, i kompakt layout så undersidene ikke blir for tunge nederst.

export function LandingFooter() {
  return (
    <footer style={{
      background: 'var(--flate-1)', borderTop: '1px solid var(--kant-5)',
      padding: '48px 24px 28px', marginTop: 'auto',
    }}>
      <div className="max-w-[1240px] mx-auto grid gap-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Link href="/xpulse.html"
            className="inline-flex items-center gap-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              fontSize: '16px', letterSpacing: '0.4em', color: 'var(--tekst-1-land)',
              textTransform: 'uppercase', textDecoration: 'none',
            }}>
            <XPulseIcon size={28} />
            <span>PULSE</span>
          </Link>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgb(var(--tekst-land-rgb) / 0.55)', maxWidth: 280 }}>
            Treningsdagbok og planlegger for utholdenhet.
          </p>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
            letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--tekst-7)',
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
          { href: '/funksjoner/dagbok-og-plan', label: 'Dagbok og Plan' },
          { href: '/funksjoner/analyse',        label: 'Analyse' },
          { href: '/funksjoner/trener',         label: 'Trener' },
          { href: '/funksjoner/klokkesync',     label: 'Klokkesync' },
          { href: '/funksjoner/ai-coach',       label: 'AI Coach' },
          { href: '/xpulse.html#priser',        label: 'Priser' },
          { href: '/xpulse.html#faq',           label: 'FAQ' },
        ]} />

        <div>
          <FooterCol label="Selskap" items={[
            { href: '/nytt',                     label: 'Hva er nytt' },
            { href: 'mailto:support@x-pulse.no', label: 'Kontakt' },
            { href: '/personvern',               label: 'Personvern' },
            { href: '/vilkar',                   label: 'Vilkår' },
            { href: '/cookies',                  label: 'Cookies' },
          ]} />
          <div className="flex gap-2.5 mt-4" aria-label="Sosiale lenker">
            <a
              href="https://www.instagram.com/xpulse.no"
              target="_blank" rel="noopener"
              aria-label="Instagram"
              style={socialStyle}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-[1240px] mx-auto pt-5 mt-8 flex flex-col sm:flex-row justify-between items-center gap-3"
        style={{
          borderTop: '1px solid var(--kant-5)',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
          letterSpacing: '0.12em', color: 'var(--tekst-7)',
        }}>
        <span>© 2026 X-PULSE</span>
        <span>support@x-pulse.no</span>
      </div>
    </footer>
  )
}

const socialStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  border: '1px solid var(--kant-5)',
  color: 'var(--tekst-5-app)',
  transition: 'color 0.15s, border-color 0.15s',
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
                letterSpacing: '0.08em', color: 'rgb(var(--tekst-land-rgb) / 0.62)',
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
