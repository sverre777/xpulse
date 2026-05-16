import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { DataExportButton } from './DataExportButton'

// GDPR Article 20 — Right to Data Portability. Alltid tilgjengelig, også
// etter abonnement-utløp (innstillinger er unntatt middleware-mur).

export default async function DataEksportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <SettingsPageHeader title="Eksporter dine data" />

        <p className="mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px', lineHeight: 1.6 }}>
          Last ned all din trenings-, plan- og helsedata. Du eier dine data og kan eksportere når som helst — også etter at abonnementet eventuelt utløper.
        </p>

        <section className="p-5 mb-4"
          style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
          <h2 className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em', margin: 0 }}>
            Inkluderes
          </h2>
          <ul className="space-y-1 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', lineHeight: 1.6 }}>
            <li>✓ Alle treningsøkter med metadata og notater</li>
            <li>✓ Alle laps med soner, watt, puls, kadens, høydemeter</li>
            <li>✓ Per-sekund-data (puls, watt, GPS) — unntatt Strava-samples eldre enn 7 dager</li>
            <li>✓ Planlagte økter, perioder og nøkkeldatoer</li>
            <li>✓ Maler (økt + plan)</li>
            <li>✓ Profil-data (sport, max_heart_rate — IKKE passord)</li>
            <li>✓ Tilkoblings-tracking (imported_activities)</li>
          </ul>
        </section>

        <section className="p-5 mb-6"
          style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
          <h2 className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#8A8A96', fontSize: '18px', letterSpacing: '0.04em', margin: 0 }}>
            Ekskluderes
          </h2>
          <ul className="space-y-1 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1.6 }}>
            <li>— Andre brukeres data (selv som trener — utøvere må eksportere selv)</li>
            <li>— Stripe fakturering-historikk (tilgjengelig i Stripe Customer Portal via /app/abonnement)</li>
            <li>— Strava raw-data eldre enn 7 dager (Strava API Agreement § 7)</li>
          </ul>
          <p className="mt-3 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FC5200', lineHeight: 1.5 }}>
            For å beholde Strava-aktiviteter permanent: last ned .fit-filer manuelt fra{' '}
            <a href="https://www.strava.com/athlete/training" target="_blank" rel="noopener noreferrer"
              style={{ color: '#FC5200', textDecoration: 'underline' }}>
              Strava → Aktiviteter
            </a>{' '}
            og last opp som .fit i X-PULSE.
          </p>
        </section>

        <DataExportButton />
      </div>
    </div>
  )
}
