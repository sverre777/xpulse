// Diskret feedback/bug-rapport-kort for hjem-sidene (utøver + trener). Bruker
// mailto for nå — kan senere bli en in-app-modal mot en feedback-tabell.
// accent matcher modus-fargen: utøver oransje (#FF4500), trener blå (#1A6FD4).

const MAILTO = `mailto:support@x-pulse.no?subject=${encodeURIComponent('X-PULSE feedback/bug')}`

export function FeedbackCard({ accent }: { accent: string }) {
  return (
    <section
      className="mt-6"
      style={{
        position: 'relative',
        backgroundColor: '#13131A',
        border: '1px solid #1E1E22',
        borderTop: `2px solid ${accent}`,
        padding: '22px 26px',
      }}
    >
      <span
        aria-hidden
        className="text-xs tracking-widest uppercase"
        style={{
          position: 'absolute', top: '14px', right: '16px',
          fontFamily: "'Barlow Condensed', sans-serif",
          color: accent, border: `1px solid ${accent}`,
          padding: '1px 7px', fontSize: '10px', letterSpacing: '0.18em',
        }}
      >
        Beta
      </span>

      <h3
        style={{
          fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
          fontSize: '22px', letterSpacing: '0.05em', margin: 0,
        }}
      >
        Hjelp oss forbedre X-PULSE
      </h3>

      <p
        className="mt-2"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
          fontSize: '14px', lineHeight: 1.65, maxWidth: '560px',
        }}
      >
        Opplever du en bug, eller har innspill til noe du ønsker eller savner?
        Send oss en e-post – gjerne med skjermbilde.
      </p>

      <ul
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 list-none p-0"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
          fontSize: '13px', letterSpacing: '0.04em',
        }}
      >
        <li>· Hva skjedde</li>
        <li>· Hva forventet du</li>
        <li>· Skjermbilde hvis mulig</li>
      </ul>

      <a
        href={MAILTO}
        className="inline-block mt-4 text-sm tracking-widest uppercase transition-opacity hover:opacity-90"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          backgroundColor: accent, color: '#F0F0F2',
          padding: '9px 18px', textDecoration: 'none',
        }}
      >
        support@x-pulse.no
      </a>
    </section>
  )
}
