import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UnitsSection } from '@/components/settings/UnitsSection'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function MaleenheterInnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_pace_unit, default_distance_unit, default_temperature_unit, default_weight_unit')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader title="Måleenheter" />
        <UnitsSection
          initialPaceUnit={profile?.default_pace_unit ?? null}
          initialDistanceUnit={profile?.default_distance_unit ?? null}
          initialTemperatureUnit={profile?.default_temperature_unit ?? null}
          initialWeightUnit={profile?.default_weight_unit ?? null}
        />
      </div>
    </div>
  )
}
