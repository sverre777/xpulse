import Link from 'next/link'

// Hero-blokk for funksjoner-undersider. Tar inn sport-ikonet som ReactNode
// så hver side kan injisere sitt eget ikon uten at heroen vet om alle.
//
// Når backgroundImage er satt vises bildet bak innholdet med en
// venstre-vekt gradient-overlay så tekst er lesbar. Ikonet skjules da på
// mobil for å gi bildet plass.

export interface SportPageHeroProps {
  kicker: string
  title: React.ReactNode
  description: string
  icon: React.ReactNode
  backgroundImage?: string
}

export function SportPageHero({
  kicker, title, description, icon, backgroundImage,
}: SportPageHeroProps) {
  return (
    <section className="relative overflow-hidden px-6 lg:px-14 pt-20 md:pt-28 pb-20 md:pb-24">
      {backgroundImage && (
        <>
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }} />
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(to right, rgba(10,10,11,0.95) 0%, rgba(10,10,11,0.75) 45%, rgba(10,10,11,0.35) 100%)',
          }} />
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(to top, rgba(10,10,11,0.95) 0%, transparent 40%)',
          }} />
        </>
      )}
      <div aria-hidden style={{
        position: 'absolute', top: 0, right: 0, zIndex: 2,
        width: 480, height: 480,
        background: 'radial-gradient(circle, rgba(255,69,0,0.08), transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div className="max-w-[1240px] mx-auto grid gap-12 md:grid-cols-[1.4fr_1fr] items-center relative" style={{ zIndex: 3 }}>
        <div>
          <div className="flex items-center gap-3 mb-6"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              fontSize: '11px', letterSpacing: '0.32em',
              textTransform: 'uppercase', color: '#FF4500',
            }}>
            <span style={{ width: 28, height: 1, background: '#FF4500' }} />
            {kicker}
          </div>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(56px, 8vw, 96px)', lineHeight: 0.92,
            letterSpacing: '0.04em', color: '#F2F0EC', marginBottom: 24,
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: 16, lineHeight: 1.75, color: 'rgba(242,240,236,0.62)',
            maxWidth: 540, marginBottom: 32,
          }}>
            {description}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/xpulse.html#priser" style={{
              background: '#FF4500', color: '#F2F0EC',
              padding: '14px 28px', textDecoration: 'none',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
              Start 30 dagers gratis prøve
            </Link>
            <Link href="/xpulse.html#faq" style={{
              color: '#F2F0EC', padding: '14px 28px',
              border: '1px solid #262629', textDecoration: 'none',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
              FAQ
            </Link>
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center">
          <div style={{
            width: 220, height: 220, position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #262629', background: '#111113',
            color: '#FF4500',
          }}>
            {icon}
          </div>
        </div>
      </div>
    </section>
  )
}
