import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  computeZonesFromMaxHr, resolveMaxHr, ZONE_NAMES, HeartZone,
} from '@/lib/heart-zones'
import { HeartZonesSection } from '@/components/settings/HeartZonesSection'
import { UnitsSection } from '@/components/settings/UnitsSection'
import { ProfileSection } from '@/components/settings/ProfileSection'
import { SecuritySection } from '@/components/settings/SecuritySection'
import { NotificationsSection } from '@/components/settings/NotificationsSection'
import { DataExportButton } from '@/components/settings/DataExportButton'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'
import type { Sport } from '@/lib/types'

export default async function InnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
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
        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Innstillinger
          </h1>
        </div>

        <ProfileSection
          initialFirstName={profile?.first_name ?? null}
          initialLastName={profile?.last_name ?? null}
          initialFullName={profile?.full_name ?? null}
          initialBirthYear={profile?.birth_year ?? null}
          initialPrimarySport={(profile?.primary_sport ?? null) as Sport | null}
          initialGender={profile?.gender ?? null}
          initialCountry={profile?.country ?? null}
          initialProfileImageUrl={profile?.profile_image_url ?? profile?.avatar_url ?? null}
        />

        <SecuritySection
          currentEmail={user.email ?? '—'}
          pendingEmail={profile?.email_change_pending ?? null}
        />

        <UnitsSection
          initialPaceUnit={profile?.default_pace_unit ?? null}
          initialDistanceUnit={profile?.default_distance_unit ?? null}
          initialTemperatureUnit={profile?.default_temperature_unit ?? null}
          initialWeightUnit={profile?.default_weight_unit ?? null}
        />

        <HeartZonesSection
          birthYear={profile?.birth_year ?? null}
          initialMaxHr={profile?.max_heart_rate ?? null}
          initialThreshold={profile?.lactate_threshold_hr ?? null}
          initialResting={profile?.resting_heart_rate ?? null}
          initialZones={initialZones}
          hasCustomZones={hasCustomZones}
        />

        <NotificationsSection initial={{
          coach_comment:    profile?.notify_email_coach_comment ?? true,
          new_message:      profile?.notify_email_new_message ?? true,
          plan_pushed:      profile?.notify_email_plan_pushed ?? true,
          weekly_summary:   profile?.notify_email_weekly_summary ?? false,
          product_updates:  profile?.notify_email_product_updates ?? false,
        }} />

        <div className="p-6 mt-6" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
          <p className="text-xs tracking-widest uppercase mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Personvern og data
          </p>
          <div className="space-y-4">
            <DataExportButton />
            <div>
              <p className="text-xs mb-2"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                Slett kontoen og alle dine data. Du har 7 dagers angrefrist.
              </p>
              <DeleteAccountModal deletionRequestedAt={profile?.deletion_requested_at ?? null} />
            </div>
          </div>
        </div>

        <Link href="/app/innstillinger/bevegelsesformer"
          className="flex items-center justify-between p-6 mt-6 transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
          <div>
            <p className="text-xs tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Egne bevegelsesformer
            </p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '16px' }}>
              Administrer bevegelsesformer
            </p>
          </div>
          <span style={{ color: '#555560', fontSize: '18px' }}>›</span>
        </Link>

        <Link href="/app/innstillinger/trener"
          className="flex items-center justify-between p-6 mt-6 transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
          <div>
            <p className="text-xs tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Trener
            </p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '16px' }}>
              Generer trener-kode og administrer koblinger
            </p>
          </div>
          <span style={{ color: '#555560', fontSize: '18px' }}>›</span>
        </Link>
      </div>
    </div>
  )
}
