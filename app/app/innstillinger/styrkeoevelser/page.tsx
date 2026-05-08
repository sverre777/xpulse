import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserExercises } from '@/app/actions/user-exercises'
import { StrengthExerciseLibrarySection } from '@/components/settings/StrengthExerciseLibrarySection'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'

export default async function StyrkeoevelserPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const initial = await getUserExercises(undefined, undefined, 'strength')

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader
          title="Styrkeøvelser"
          description="Bygg ditt eget bibliotek av styrkeøvelser. Brukes til autocomplete i økt-skjemaet og som grunnlag for analyser per øvelse over tid."
        />
        <StrengthExerciseLibrarySection initial={initial} />
      </div>
    </div>
  )
}
