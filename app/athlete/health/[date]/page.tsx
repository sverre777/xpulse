import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getDailyHealth } from '@/app/actions/health'
import { HealthForm } from '@/components/health/HealthForm'

export default async function HealthPage({ params }: { params: Promise<{ date: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { date } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect('/athlete/calendar')

  const existing = await getDailyHealth(date)

  const d = new Date(date + 'T12:00:00')
  const dateLabel = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#28A86E', display: 'inline-block' }} />
          <div>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em', lineHeight: 1 }}>
              Helse
            </h1>
            <p className="text-sm capitalize mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
              {dateLabel}
            </p>
          </div>
        </div>

        <HealthForm date={date} existing={existing} />

        <div className="text-center mt-4">
          <Link href={`/athlete/calendar/${date}`}
            className="text-sm tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', textDecoration: 'none' }}>
            ← Tilbake til dagen
          </Link>
        </div>
      </div>
    </div>
  )
}
