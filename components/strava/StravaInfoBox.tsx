'use client'

// Info-boks som vises på /app/innstillinger/klokkesync FØR brukeren kobler
// til Strava. Strava API Agreement § 7 + § 5.4 krever at vi tydelig
// kommuniserer hvilke data som lagres, hvor lenge, og hva som skjer ved
// frakobling.

export function StravaInfoBox() {
  return (
    <div className="mb-5 p-5"
      style={{
        backgroundColor: '#0F121A',
        border: '1px solid #1E1E22',
        borderLeft: '3px solid #FC5200',
      }}>
      <p className="mb-3 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FC5200' }}>
        Slik håndteres Strava-data
      </p>

      <ul className="space-y-2 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px', lineHeight: 1.6 }}>
        <li>✓ <strong>Permanent lagring</strong>: varighet, distanse, sport, snittpuls, makspuls, sonefordeling og lap-data så lenge Strava er koblet til.</li>
        <li>✓ All analyse, trender, PR-er og sonefordelinger basert på aggregerte verdier beholdes.</li>
        <li>✓ Strava-data deles aldri med tredjeparter eller brukes til AI-trening.</li>
      </ul>

      <ul className="space-y-2 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FFB300', fontSize: '13px', lineHeight: 1.6 }}>
        <li>⚠ Rå data (sekund-for-sekund puls, GPS-rute, watts-strøm) slettes etter <strong>7 dager</strong> — Stravas krav.</li>
        <li>⚠ Ved frakobling slettes <strong>ALL</strong> Strava-data innen 48 timer (Stravas regler).</li>
      </ul>

      <div className="p-3"
        style={{
          backgroundColor: 'rgba(40,168,110,0.06)',
          border: '1px solid rgba(40,168,110,0.3)',
        }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', fontSize: '13px', lineHeight: 1.6 }}>
          💡 <strong>Tips</strong>: Vil du beholde alt permanent? Eksporter .fit-filer manuelt fra
          {' '}<a href="https://www.strava.com/athlete/training" target="_blank" rel="noopener noreferrer"
            style={{ color: '#28A86E', textDecoration: 'underline' }}>Strava → Aktiviteter</a>{' '}
          og last opp til X-PULSE — da regnes det som dine egne data.
        </p>
      </div>
    </div>
  )
}
