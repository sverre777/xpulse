import Link from 'next/link'

// Kompakt påminnelse vises i KlokkesyncView NÅR Strava er tilkoblet — som
// motvekt til den større StravaInfoBox-en som vises før tilkobling.
// Subtilt design, ikke høyt prioritert, men gir brukeren én linje med
// regel-påminnelse + lett tilgang til full juridisk tekst.

export function StravaCompactInfo() {
  return (
    <div className="mt-3 mb-4 p-3 flex items-start gap-2"
      style={{
        backgroundColor: 'rgba(252,82,0,0.04)',
        border: '1px solid rgba(252,82,0,0.18)',
        borderRadius: 0,
      }}>
      <span style={{ fontSize: '14px', lineHeight: 1.4, marginTop: '1px' }} aria-hidden>📋</span>
      <div className="flex-1 min-w-0" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px', lineHeight: 1.5 }}>
        <strong style={{ color: '#FC5200', letterSpacing: '0.04em' }}>Strava-data: 7-dagers regel.</strong>{' '}
        Rå data slettes automatisk etter 7 dager. Aggregert data (sone-fordeling, lap-tider) beholdes permanent.{' '}
        <Link href="/personvern#strava"
          style={{ color: '#FC5200', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
          Les mer →
        </Link>
      </div>
    </div>
  )
}
