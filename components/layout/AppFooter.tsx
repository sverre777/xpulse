import Link from 'next/link'

// Bunn-footer for /app/-rutene. Minimalistisk, ikke sticky — scroller
// naturlig sammen med innhold. Skjules implisitt på modaler siden de
// rendres med position:fixed over alt innhold.

export function AppFooter() {
  return (
    <footer
      className="px-4 py-5 mt-8"
      style={{
        borderTop: '1px solid #1A1A1E',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 12,
        color: '#555560',
      }}
    >
      <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <a href="mailto:support@x-pulse.no" style={linkStyle}>support@x-pulse.no</a>
          <span style={{ color: '#2A2A30' }} aria-hidden="true">·</span>
          <Link href="/vilkar"     style={linkStyle}>Vilkår</Link>
          <span style={{ color: '#2A2A30' }} aria-hidden="true">·</span>
          <Link href="/personvern" style={linkStyle}>Personvern</Link>
          <span style={{ color: '#2A2A30' }} aria-hidden="true">·</span>
          <Link href="/cookies"    style={linkStyle}>Cookies</Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>🇳🇴 Bygget i Norge</span>
          <span style={{ color: '#2A2A30' }} aria-hidden="true">·</span>
          <span>© 2026 X-PULSE</span>
        </div>
      </div>
    </footer>
  )
}

const linkStyle: React.CSSProperties = {
  color: '#8A8A96',
  textDecoration: 'none',
  transition: 'color 0.15s',
}
