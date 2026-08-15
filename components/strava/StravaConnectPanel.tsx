'use client'

import { ConnectWithStravaButton } from './StravaBrand'
import { StravaInfoBox } from './StravaInfoBox'

// Tilkoblings-panelet for Strava. Flyttet ut av KlokkesyncView (der det lå som
// StravaDisconnected) til merkesiden /app/innstillinger/klokkesync/strava —
// innholdet er uendret.
//
// Strava API Brand Guidelines: «Connect with Strava»-knappen er Stravas egen
// og skal brukes som den er, og info-boksen dekker § 7 + § 5.4-kravene om å
// fortelle hva vi lagrer, hvor lenge, og hva som skjer ved frakobling.
export function StravaConnectPanel() {
  return (
    <>
      <StravaInfoBox />
      <p style={{ fontSize: 14, color: 'rgba(242,240,236,0.7)', lineHeight: 1.7, marginBottom: 16 }}>
        Koble til Strava én gang — alle nye økter synkes automatisk innen 5 minutter.
        Vi henter aktiviteten, splittene/lapsene og puls/watt/pace-streamene.
      </p>
      <ConnectWithStravaButton />
      <p style={{ marginTop: '10px', fontSize: 12, color: 'rgba(242,240,236,0.5)', fontFamily: "'Barlow Condensed', sans-serif" }}>
        Ved tilkobling samtykker du til Stravas API Agreement og X-PULSE sine vilkår.
      </p>
    </>
  )
}
