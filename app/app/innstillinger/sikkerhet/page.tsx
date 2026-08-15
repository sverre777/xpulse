import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { SecuritySection } from '@/components/settings/SecuritySection'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function SikkerhetInnstillingerPage() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('email_change_pending')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader title="Sikkerhet" />
        <SecuritySection
          currentEmail={user.email ?? '—'}
          pendingEmail={profile?.email_change_pending ?? null}
        />
      </div>
    </div>
  )
}
