import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsSection } from '@/components/settings/NotificationsSection'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function VarslerInnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('notify_email_coach_comment, notify_email_new_message, notify_email_plan_pushed, notify_email_weekly_summary, notify_email_product_updates')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader
          title="Varsler"
          description="Velg hvilke e-post-varsler du vil motta. Push-varsler kommer senere."
        />
        <NotificationsSection initial={{
          coach_comment:    profile?.notify_email_coach_comment ?? true,
          new_message:      profile?.notify_email_new_message ?? true,
          plan_pushed:      profile?.notify_email_plan_pushed ?? true,
          weekly_summary:   profile?.notify_email_weekly_summary ?? false,
          product_updates:  profile?.notify_email_product_updates ?? false,
        }} />
      </div>
    </div>
  )
}
