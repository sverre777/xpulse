// Placeholder for /app/trener/kalender — full kalender bygges i Trener-multifix
// Fase B (egne notater, Delta-funksjonalitet, konkurranser i månedsvisning).
// Inntil videre vises en kort melding så "Se kalender →"-linker fra "Neste på
// kalenderen"-modulen ikke 404'er.

import Link from 'next/link'

const COACH_BLUE = '#1A6FD4'

export default function CoachCalendarPlaceholderPage() {
  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <span style={{ width: '32px', height: '3px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em',
          }}>
            Trener-kalender
          </h1>
        </div>
        <div className="p-6"
          style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
          <p className="text-sm mb-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC' }}>
            Full trener-kalender (måned/uke/år) er under bygging.
          </p>
          <p className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Den kommer til å vise konkurranser fra utøvere, økter du har markert deltakelse på, og dine egne notater.
            Inntil videre kan du se kommende konkurranser og fellestreninger på <Link href="/app/trener" style={{ color: COACH_BLUE }}>oversikt-siden</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
