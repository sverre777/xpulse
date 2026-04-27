import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserMovementTypes } from '@/app/actions/user-movement-types'
import { MovementTypesSection } from '@/components/settings/MovementTypesSection'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function BevegelsesformerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const initial = await getUserMovementTypes()

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader
          title="Bevegelsesformer"
          description="Opprett dine egne bevegelsesformer i tillegg til standardlisten. Typen (utholdenhet, styrke, tur, annet) styrer hvilke felt som vises i aktivitetsraden."
        />
        <MovementTypesSection initial={initial} />
      </div>
    </div>
  )
}
