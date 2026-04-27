import Link from 'next/link'

export function PublicFooter() {
  return (
    <footer
      className="w-full px-4 py-4 mt-8"
      style={{
        borderTop: '1px solid #1E1E22',
        backgroundColor: '#0A0A0B',
      }}
    >
      <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
      >
        <Link href="/personvern" className="transition-opacity hover:opacity-80" style={{ color: '#8A8A96' }}>
          Personvern
        </Link>
        <span style={{ color: '#2A2A30' }}>·</span>
        <Link href="/vilkar" className="transition-opacity hover:opacity-80" style={{ color: '#8A8A96' }}>
          Vilkår
        </Link>
        <span style={{ color: '#2A2A30' }}>·</span>
        <Link href="/cookies" className="transition-opacity hover:opacity-80" style={{ color: '#8A8A96' }}>
          Cookies
        </Link>
      </div>
    </footer>
  )
}
