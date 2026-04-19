import Link from 'next/link'

export default function PrisPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0A0A0B' }}
    >
      <div className="max-w-2xl text-center">
        <h1
          className="text-5xl md:text-6xl mb-4"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.08em' }}
        >
          Pris
        </h1>
        <p
          className="text-base tracking-wide mb-8"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
        >
          Kommer snart.
        </p>
        <Link
          href="/"
          className="text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', textDecoration: 'none' }}
        >
          ← Tilbake
        </Link>
      </div>
    </main>
  )
}
