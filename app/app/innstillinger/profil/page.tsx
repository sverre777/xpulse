import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { ProfileSection } from '@/components/settings/ProfileSection'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import type { Sport } from '@/lib/types'

export default async function ProfilInnstillingerPage() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/app')

  const [{ data: profile }, { data: sisteVekt }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    // Vekt: siste måling fra helse-loggen — SAMME kilde som helseflaten.
    supabase.from('daily_health')
      .select('body_weight_kg')
      .eq('user_id', user.id)
      .not('body_weight_kg', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader title="Profil" />
        <ProfileSection
          initialFirstName={profile?.first_name ?? null}
          initialLastName={profile?.last_name ?? null}
          initialFullName={profile?.full_name ?? null}
          initialBirthYear={profile?.birth_year ?? null}
          initialPrimarySport={(profile?.primary_sport ?? null) as Sport | null}
          initialGender={profile?.gender ?? null}
          initialCountry={profile?.country ?? null}
          initialProfileImageUrl={profile?.profile_image_url ?? profile?.avatar_url ?? null}
          initialUsername={profile?.username ?? null}
          initialBirthDate={profile?.birth_date ?? null}
          initialHeightCm={profile?.height_cm ?? null}
          initialSecondarySport={((profile?.secondary_sports as string[] | null)?.[0] ?? null) as Sport | null}
          email={profile?.email ?? user.email ?? null}
          sisteVektKg={sisteVekt?.body_weight_kg != null ? Number(sisteVekt.body_weight_kg) : null}
        />
      </div>
    </div>
  )
}
