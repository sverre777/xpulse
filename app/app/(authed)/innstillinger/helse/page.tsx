import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  computeZonesFromMaxHr, resolveMaxHr, ZONE_NAMES, HeartZone,
} from '@/lib/heart-zones'
import { HeartZonesSection } from '@/components/settings/HeartZonesSection'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function HelseInnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('birth_year, max_heart_rate, lactate_threshold_hr, resting_heart_rate')
    .eq('id', user.id)
    .single()
  const { data: zones } = await supabase
    .from('user_heart_zones')
    .select('zone_name, min_bpm, max_bpm')
    .eq('user_id', user.id)
    .returns<{ zone_name: 'I1' | 'I2' | 'I3' | 'I4' | 'I5'; min_bpm: number; max_bpm: number }[]>()

  const hasCustomZones = !!zones && zones.length === ZONE_NAMES.length &&
    ZONE_NAMES.every(n => zones.some(z => z.zone_name === n))

  const autoMaxHr = resolveMaxHr(profile?.max_heart_rate ?? null, profile?.birth_year ?? null)
  const autoZones = computeZonesFromMaxHr(autoMaxHr)
  const initialZones: HeartZone[] = hasCustomZones
    ? ZONE_NAMES.map(n => zones!.find(z => z.zone_name === n)!) as HeartZone[]
    : autoZones

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader title="Helse og soner" />
        <HeartZonesSection
          birthYear={profile?.birth_year ?? null}
          initialMaxHr={profile?.max_heart_rate ?? null}
          initialThreshold={profile?.lactate_threshold_hr ?? null}
          initialResting={profile?.resting_heart_rate ?? null}
          initialZones={initialZones}
          hasCustomZones={hasCustomZones}
        />
      </div>
    </div>
  )
}
