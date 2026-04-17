import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AthleteNav } from '@/components/layout/AthleteNav'

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role === 'coach') redirect('/coach')

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
      <AthleteNav userName={profile?.full_name} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
