import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  computeZonesFromMaxHr, resolveMaxHr, ZONE_NAMES, HeartZone,
} from '@/lib/heart-zones'
import { HeartZonesSection } from '@/components/settings/HeartZonesSection'

export default async function InnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: zones } = await supabase
    .from('user_heart_zones')
    .select('zone_name, min_bpm, max_bpm')
    .eq('user_id', user.id)
    .returns<{ zone_name: 'I1' | 'I2' | 'I3' | 'I4' | 'I5'; min_bpm: number; max_bpm: number }[]>()

  const hasCustomZones = !!zones && zones.length === ZONE_NAMES.length &&
    ZONE_NAMES.every(n => zones.some(z => z.zone_name === n))

  const autoMaxHr = resolveMaxHr(profile?.max_heart_rate ?? null, profile?.birth_year ?? null)
  const autoZones = computeZonesFromMaxHr(autoMaxHr)
  const initialZones: HeartZone[] = hasCustomZones
    ? ZONE_NAMES.map(n => zones!.find(z => z.zone_name === n)!) as HeartZone[]
    : autoZones

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

        <HeartZonesSection
          birthYear={profile?.birth_year ?? null}
          initialMaxHr={profile?.max_heart_rate ?? null}
          initialThreshold={profile?.lactate_threshold_hr ?? null}
          initialResting={profile?.resting_heart_rate ?? null}
          initialZones={initialZones}
          hasCustomZones={hasCustomZones}
        />

        <Link href="/app/innstillinger/bevegelsesformer"
          className="flex items-center justify-between p-6 mt-6 transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
          <div>
            <p className="text-xs tracking-widest uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              Egne bevegelsesformer
            </p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '16px' }}>
              Administrer bevegelsesformer
            </p>
          </div>
          <span style={{ color: '#555560', fontSize: '18px' }}>›</span>
        </Link>
      </div>
    </div>
  )
}
