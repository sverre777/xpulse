import Link from 'next/link'

export function PublicFooter() {
  return (
    <footer
      className="w-full px-4 py-4 mt-8"
      style={{
        borderTop: '1px solid var(--kant-3)',
        backgroundColor: 'var(--flate-3)',
      }}
    >
      <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)' }}
      >
        <Link href="/nytt" className="transition-opacity hover:opacity-80" style={{ color: 'var(--tekst-5-app)' }}>
          Hva er nytt
        </Link>
        <span style={{ color: 'var(--kant-6)' }}>·</span>
        <Link href="/personvern" className="transition-opacity hover:opacity-80" style={{ color: 'var(--tekst-5-app)' }}>
          Personvern
        </Link>
        <span style={{ color: 'var(--kant-6)' }}>·</span>
        <Link href="/vilkar" className="transition-opacity hover:opacity-80" style={{ color: 'var(--tekst-5-app)' }}>
          Vilkår
        </Link>
        <span style={{ color: 'var(--kant-6)' }}>·</span>
        <Link href="/cookies" className="transition-opacity hover:opacity-80" style={{ color: 'var(--tekst-5-app)' }}>
          Cookies
        </Link>
        <span style={{ color: 'var(--kant-6)' }}>·</span>
        <Link href="/kontakt" className="transition-opacity hover:opacity-80" style={{ color: 'var(--tekst-5-app)' }}>
          Kontakt
        </Link>
      </div>
    </footer>
  )
}
