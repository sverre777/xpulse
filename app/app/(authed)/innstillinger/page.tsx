import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function InnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Innstillinger
          </h1>
        </div>

        <div className="p-6" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
          <p className="text-xs tracking-widest uppercase mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Profil
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Navn</p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '16px' }}>
                {profile?.full_name ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>E-post</p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '16px' }}>
                {user.email ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Rolle</p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '16px' }}>
                {profile?.role === 'coach' ? 'Trener' : 'Utøver'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 p-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '16px', letterSpacing: '0.05em' }}>
            Flere innstillinger kommer snart
          </p>
        </div>
      </div>
    </div>
  )
}
