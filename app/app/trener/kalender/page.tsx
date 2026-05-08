import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCoachCalendarEvents } from '@/app/actions/coach-dashboard'
import { getTrainerNotesForRange } from '@/app/actions/trainer-calendar'
import { TrenerKalenderClient } from '@/components/coach/TrenerKalenderClient'

// /app/trener/kalender — viser kommende konkurranser, Delta-markerte økter og
// egne notater for de neste 60 dagene. Full måned/uke/år-veksler kommer i en
// senere iterasjon; denne første versjonen er en kronologisk liste som
// erstatter placeholder-siden.

export default async function CoachCalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const today = new Date()
  const fromDate = today.toISOString().slice(0, 10)
  const toDateObj = new Date(today)
  toDateObj.setDate(toDateObj.getDate() + 60)
  const toDate = toDateObj.toISOString().slice(0, 10)

  const [events, notes] = await Promise.all([
    getCoachCalendarEvents(fromDate, toDate),
    getTrainerNotesForRange(fromDate, toDate),
  ])

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#1A6FD4', display: 'inline-block' }} />
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em',
          }}>
            Trener-kalender
          </h1>
        </div>
        <p className="mb-6 text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Kommende konkurranser fra utøvere, økter du har markert deltakelse på, og dine egne notater. Full måned/uke/år-visning kommer i neste iterasjon.
        </p>

        <TrenerKalenderClient initialEvents={events} initialNotes={notes} />
      </div>
    </div>
  )
}
