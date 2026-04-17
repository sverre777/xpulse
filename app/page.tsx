import Link from 'next/link'

export default function Home() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#0A0A0B' }}
    >
      <div className="mb-12 text-center">
        <h1
          className="text-8xl md:text-9xl tracking-widest"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500' }}
        >
          X-PULSE
        </h1>
        <p
          className="text-xl mt-2 tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
        >
          Treningsapp for seriøse utøvere
        </p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center mb-16">
        {['Løping', 'Langrenn', 'Skiskyting', 'Triatlon'].map((sport) => (
          <span
            key={sport}
            className="px-4 py-1 text-sm tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#8A8A96',
              border: '1px solid #222228',
            }}
          >
            {sport}
          </span>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link
          href="/register"
          className="flex-1 py-4 text-center text-lg font-semibold tracking-widest uppercase transition-all hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: '#FF4500',
            color: '#F0F0F2',
          }}
        >
          Kom i gang
        </Link>
        <Link
          href="/login"
          className="flex-1 py-4 text-center text-lg font-semibold tracking-widest uppercase transition-all hover:border-opacity-80"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#F0F0F2',
            border: '1px solid #333340',
          }}
        >
          Logg inn
        </Link>
      </div>

      <p
        className="mt-16 text-sm tracking-wider"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
      >
        Fase 1 — Fundament
      </p>
    </main>
  )
}
