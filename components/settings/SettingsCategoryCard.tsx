import Link from 'next/link'

interface Props {
  href: string
  glyph: string
  title: string
  description: string
  accent?: string
}

// Standard kategori-kort for /app/innstillinger drill-down. Glyph er en
// kort tekst-symbol (emoji eller kort tegn) — appen har ikke ikon-bibliotek.
export function SettingsCategoryCard({ href, glyph, title, description, accent = '#FF4500' }: Props) {
  return (
    <Link href={href}
      className="flex items-center gap-4 p-5 transition-colors hover:bg-[#1A1A1F]"
      style={{
        backgroundColor: '#16161A', border: '1px solid #1E1E22',
        textDecoration: 'none',
      }}>
      <div style={{
        width: '40px', height: '40px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#0F0F12', border: '1px solid #1E1E22',
        color: accent, fontSize: '18px',
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>
        {glyph}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{
          fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
          fontSize: '20px', letterSpacing: '0.06em',
        }}>
          {title}
        </p>
        <p className="text-sm mt-0.5" style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
        }}>
          {description}
        </p>
      </div>
      <span style={{ color: '#555560', fontSize: '20px', flexShrink: 0 }}>›</span>
    </Link>
  )
}
