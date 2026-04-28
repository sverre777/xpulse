import Link from 'next/link'
import { ArrowRightIcon } from '@/components/branding/nav-icons'

// Standard byggekloss for funksjoner-undersider. Hver side er en stack av
// disse seksjonene + en hero og en CTA-blokk. Holdes som server-komponent
// (ingen state, ingen events).

export interface SportFeatureBullet {
  title: string
  body: string
}

export interface SportFeatureSectionProps {
  // ID brukt for #anchors hvis vi vil scrolle til seksjonen senere.
  id?: string
  // Lite tag-label over tittelen ("Fokus", "Skipark", osv.).
  kicker?: string
  title: string
  // Valgfri intro-paragraf før bullets.
  intro?: string
  bullets?: SportFeatureBullet[]
  // Bytter farge-aksent fra oransje til blå for "for trener"-snittet.
  accent?: 'orange' | 'blue'
  // Valgfri lite illustrasjon / mock på høyre side. For nå: passer enkel
  // tekst-blokk; bilde-svelge legges til når vi har screenshots.
  illustration?: React.ReactNode
}

export function SportFeatureSection({
  id, kicker, title, intro, bullets = [], accent = 'orange', illustration,
}: SportFeatureSectionProps) {
  const accentColor = accent === 'blue' ? '#1A6FD4' : '#FF4500'
  return (
    <section id={id} className="px-6 lg:px-14 py-20 md:py-24"
      style={{ borderTop: '1px solid #1A1A1E' }}>
      <div className="max-w-[1240px] mx-auto grid gap-12 md:grid-cols-2 items-start">
        <div>
          {kicker && (
            <div className="flex items-center gap-3 mb-4"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                fontSize: '11px', letterSpacing: '0.28em',
                textTransform: 'uppercase', color: accentColor,
              }}>
              <span style={{ width: 28, height: 1, background: accentColor }} />
              {kicker}
            </div>
          )}
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 0.95,
            letterSpacing: '0.05em', color: '#F2F0EC', marginBottom: 24,
          }}>
            {title}
          </h2>
          {intro && (
            <p style={{
              fontSize: 15, lineHeight: 1.7, color: 'rgba(242,240,236,0.62)',
              maxWidth: 520, marginBottom: bullets.length > 0 ? 28 : 0,
            }}>
              {intro}
            </p>
          )}
          {bullets.length > 0 && (
            <ul className="list-none p-0 flex flex-col gap-4">
              {bullets.map(b => (
                <li key={b.title} className="flex gap-3">
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: accentColor, marginTop: 9, flexShrink: 0,
                  }} />
                  <div>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      fontSize: 14, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: '#F2F0EC',
                      marginBottom: 4,
                    }}>
                      {b.title}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,240,236,0.6)' }}>
                      {b.body}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {illustration && (
          <div className="md:order-2 order-first md:order-last">
            {illustration}
          </div>
        )}
      </div>
    </section>
  )
}

// Stor "Start prøve"-blokk nederst på hver underside. Egen komponent så vi
// kan bytte tekst og lenkemål ett sted.
export function SportPageCTA({
  title = 'Start 30 dagers gratis prøve',
  subtitle = 'Ingen bindingstid. Kom i gang på minutter.',
  href = '/xpulse.html#priser',
  label = 'Start gratis prøve',
}: {
  title?: string
  subtitle?: string
  href?: string
  label?: string
}) {
  return (
    <section className="px-6 lg:px-14 py-24 md:py-28 text-center relative overflow-hidden"
      style={{ borderTop: '1px solid #1A1A1E' }}>
      <div aria-hidden style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)', width: 700, height: 350,
        background: 'radial-gradient(ellipse, rgba(255,69,0,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <h2 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 0.95,
        letterSpacing: '0.05em', color: '#F2F0EC', marginBottom: 14,
        position: 'relative',
      }}>
        {title}
      </h2>
      <p style={{
        fontSize: 15, color: 'rgba(242,240,236,0.55)', maxWidth: 460,
        margin: '0 auto 32px', position: 'relative',
      }}>
        {subtitle}
      </p>
      <Link href={href} className="inline-flex items-center gap-3"
        style={{
          background: '#FF4500', color: '#F2F0EC',
          padding: '16px 36px', position: 'relative',
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
          fontSize: 13, letterSpacing: '0.18em',
          textTransform: 'uppercase', textDecoration: 'none',
        }}>
        {label}
        <ArrowRightIcon size={16} />
      </Link>
    </section>
  )
}
