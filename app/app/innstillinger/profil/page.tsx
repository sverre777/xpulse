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

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

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
        />
      </div>
    </div>
  )
}
