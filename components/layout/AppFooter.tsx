import Link from 'next/link'

// Bunn-footer for /app/-rutene. Minimalistisk, ikke sticky — scroller
// naturlig sammen med innhold. Skjules implisitt på modaler siden de
// rendres med position:fixed over alt innhold.
// Speiler forside-footerens innhold (logo, tagline, Selskap, sosialt),
// men lagt horisontalt så den ikke stjeler høyde inne i appen.

function XLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <clipPath id="app-foot-tl"><polygon points="0,0 200,200 0,200" /></clipPath>
        <clipPath id="app-foot-br"><polygon points="0,0 200,0 200,200" /></clipPath>
      </defs>
      <g clipPath="url(#app-foot-tl)">
        <path d="M 30 30 L 60 30 L 100 90 L 140 30 L 170 30 L 120 100 L 170 170 L 140 170 L 100 110 L 60 170 L 30 170 L 80 100 Z" fill="#FF4500" />
      </g>
      <g clipPath="url(#app-foot-br)">
        <path d="M 30 30 L 60 30 L 100 90 L 140 30 L 170 30 L 120 100 L 170 170 L 140 170 L 100 110 L 60 170 L 30 170 L 80 100 Z" fill="#1A6FD4" />
      </g>
    </svg>
  )
}

export function AppFooter() {
  return (
    <footer
      className="px-4 pt-6 pb-5 mt-8"
      style={{
        borderTop: '1px solid #1A1A1E',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 12,
        color: '#555560',
      }}
    >
      <div className="max-w-[1800px] mx-auto flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1">
            <span
              className="inline-flex items-center gap-2"
              style={{
                fontWeight: 600, fontSize: 13, letterSpacing: '0.35em',
                color: '#F2F0EC', textTransform: 'uppercase',
              }}
            >
              <XLogo size={20} />
              <span>PULSE</span>
            </span>
            <Dot />
            <span style={{ color: '#8A8A96' }}>Treningsdagbok og planlegger for utholdenhet.</span>
            <Dot />
            <span style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>Bygget i Norge 🇳🇴</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span
              style={{
                fontWeight: 700, fontSize: 10, letterSpacing: '0.24em',
                textTransform: 'uppercase', color: '#FF4500',
              }}
            >
              Selskap
            </span>
            <Link href="/nytt" style={linkStyle}>Hva er nytt</Link>
            <Dot />
            <a href="mailto:support@x-pulse.no" style={linkStyle}>Kontakt</a>
            <Dot />
            <Link href="/personvern" style={linkStyle}>Personvern</Link>
            <Dot />
            <Link href="/vilkar" style={linkStyle}>Vilkår</Link>
            <Dot />
            <Link href="/cookies" style={linkStyle}>Cookies</Link>
            <Dot />
            <a
              href="https://www.instagram.com/xpulse.no"
              target="_blank" rel="noopener"
              aria-label="Instagram"
              style={socialStyle}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" />
              </svg>
            </a>
            <a href="#" aria-label="X / Twitter (kommer)" style={socialStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4 L20 20" /><path d="M20 4 L4 20" />
              </svg>
            </a>
          </div>
        </div>

        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3"
          style={{ borderTop: '1px solid #141417', letterSpacing: '0.12em' }}
        >
          <span>© 2026 X-PULSE</span>
          <a href="mailto:support@x-pulse.no" style={linkStyle}>support@x-pulse.no</a>
        </div>
      </div>
    </footer>
  )
}

function Dot() {
  return <span style={{ color: '#2A2A30' }} aria-hidden="true">·</span>
}

const linkStyle: React.CSSProperties = {
  color: '#8A8A96',
  textDecoration: 'none',
  transition: 'color 0.15s',
}

const socialStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: '1px solid #262629',
  color: '#8A8A96',
  transition: 'color 0.15s, border-color 0.15s',
}
