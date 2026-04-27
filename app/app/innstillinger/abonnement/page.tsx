import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function AbonnementInnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader
          title="Abonnement"
          description="Administrer planen din og fakturering. Stripe-integrasjon kommer snart."
        />
        <div className="p-6" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
          <p className="text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500' }}>
            Aktiv plan
          </p>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '28px', letterSpacing: '0.06em' }}>
            Beta-tilgang
          </p>
          <p className="mt-3 text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Du har gratis tilgang til alle funksjoner mens X-PULSE er i beta. Når
            betalt abonnement lanseres får du varsel og overgangsperiode før
            kontoen din endres.
          </p>
        </div>
      </div>
    </div>
  )
}
