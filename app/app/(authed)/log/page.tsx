import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTemplates } from '@/app/actions/health'
import { WorkoutForm } from '@/components/workout/WorkoutForm'
import { Sport, WorkoutTemplate } from '@/lib/types'

export default async function NewWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; planned?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const [{ data: profile }, templates] = await Promise.all([
    supabase.from('profiles').select('primary_sport').eq('id', user.id).single(),
    getTemplates(),
  ])

  const params = await searchParams
  const isPlanMode = params.planned === 'true'
  const title = isPlanMode ? 'Planlegg økt' : 'Logg økt'

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-2">
        <div className="flex items-center gap-3 mb-6">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            {title}
          </h1>
        </div>
      </div>
      <WorkoutForm
        initialSport={(profile?.primary_sport as Sport) ?? 'running'}
        initialDate={params.date}
        templates={templates as WorkoutTemplate[]}
        formMode={isPlanMode ? 'plan' : 'dagbok'}
      />
    </div>
  )
}
