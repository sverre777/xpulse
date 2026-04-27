import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DataExportButton } from '@/components/settings/DataExportButton'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function PersonvernInnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase
    .from('profiles')
    .select('deletion_requested_at')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader
          title="Personvern og data"
          description="Eksporter alle dine data eller slett kontoen permanent. Ved sletting har du 7 dagers angrefrist."
        />
        <div className="p-6" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
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
      </div>
    </div>
  )
}
