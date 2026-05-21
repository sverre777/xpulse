import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AuthCard } from '@/components/AuthCard'
import { PublicFooter } from '@/components/legal/PublicFooter'
import { NyttPassordForm } from './NyttPassordForm'

// Server-component: verifiserer at brukeren har en aktiv (recovery-)sesjon
// FØR vi viser passord-feltene. Uten dette ville bruker kunne skrive inn
// nytt passord på en side uten sesjon, klikke "Sett passord", og få en
// stille feil — eller verre: tro at det fungerte fordi vi redirecter til
// /app uansett.
//
// Sesjonen settes via /auth/confirm-routen som exchanger code/token-hash
// fra Supabase email-lenken. Hvis brukeren kommer hit direkte uten den
// flowen, eller hvis cookies ble strippet underveis: ingen sesjon →
// vis tydelig "Lenken er utløpt"-melding med vei tilbake til /glemt-passord.

export const dynamic = 'force-dynamic'

export default async function NyttPassordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0A0A0B' }}
    >
      {user ? (
        <AuthCard title="Sett nytt passord" subtitle={`Logget inn som ${user.email ?? 'recovery-sesjon'}`}>
          <NyttPassordForm />
        </AuthCard>
      ) : (
        <AuthCard title="Lenken er utløpt" subtitle="Recovery-sesjon mangler">
          <div className="flex flex-col gap-5">
            <p className="text-sm"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1.6 }}>
              Denne siden krever en aktiv recovery-sesjon fra reset-lenken i e-posten.
              Vanlige årsaker til at den mangler:
            </p>
            <ul className="text-sm pl-5"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1.6 }}>
              <li>Lenken ble klikket på en annen enhet enn der reset ble bedt om.</li>
              <li>Lenken er allerede brukt (engangs-token).</li>
              <li>Lenken er utløpt (vanligvis 1 time).</li>
            </ul>
            <Link href="/glemt-passord"
              className="text-center text-sm tracking-widest uppercase py-3 transition-opacity hover:opacity-80"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#FF4500', color: '#F0F0F2',
                textDecoration: 'none',
              }}>
              Be om ny reset-link
            </Link>
            <div className="text-center">
              <Link href="/app"
                className="text-sm transition-opacity hover:opacity-80"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                ← Tilbake til innlogging
              </Link>
            </div>
          </div>
        </AuthCard>
      )}
    </main>
    <PublicFooter />
    </>
  )
}
