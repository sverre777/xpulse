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
      className="flex items-center gap-4 p-5 transition-colors hover:bg-[var(--kant-2-alt)]"
      style={{
        backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12,
        textDecoration: 'none',
      }}>
      <div style={{
        width: '40px', height: '40px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--flate-8-alt)', border: '1px solid var(--line)',
        color: accent, fontSize: '18px',
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>
        {glyph}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{
          fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)',
          fontSize: '20px', letterSpacing: '0.06em',
        }}>
          {title}
        </p>
        <p className="text-sm mt-0.5" style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)',
        }}>
          {description}
        </p>
      </div>
      <span style={{ color: 'var(--tekst-8-app)', fontSize: '20px', flexShrink: 0 }}>›</span>
    </Link>
  )
}
