import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { getUserMovementTypes } from '@/app/actions/user-movement-types'
import { MovementTypesSection } from '@/components/settings/MovementTypesSection'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function BevegelsesformerPage() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/app')

  const initial = await getUserMovementTypes()

  return (
    <div style={{ backgroundColor: 'var(--flate-3)', minHeight: '100vh' }}>
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
