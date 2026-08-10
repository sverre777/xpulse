'use client'

// Vennlig feilvisning når en side ikke fikk lastet data. Sluttbrukere skal
// ikke møte rå API-/Supabase-feil — den tekniske detaljen ligger bak en fold
// (nyttig for support-skjermbilder).

export function LoadError({ what, detail }: { what: string; detail?: string | null }) {
  return (
    <div
      className="p-5 mb-6"
      style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22', borderLeft: '3px solid #E11D48' }}
    >
      <p
        className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}
      >
        Kunne ikke laste {what}
      </p>
      <p
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#C9C9CE',
          fontSize: 14, lineHeight: 1.6, maxWidth: 560,
        }}
      >
        Noe gikk galt ved henting av data. Prøv å laste siden på nytt — hjelper
        ikke det, send oss gjerne en beskjed på support@x-pulse.no.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 px-4 py-2 text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
          backgroundColor: 'transparent', color: '#F0F0F2',
          border: '1px solid #333340', cursor: 'pointer',
        }}
      >
        Last siden på nytt
      </button>
      {detail ? (
        <details className="mt-3">
          <summary
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F', cursor: 'pointer' }}
          >
            Tekniske detaljer
          </summary>
          <pre
            className="whitespace-pre-wrap break-words mt-2"
            style={{ fontFamily: 'ui-monospace, monospace', color: '#8A8A96', fontSize: 12 }}
          >
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
