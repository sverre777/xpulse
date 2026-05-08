import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCoachCalendarEvents } from '@/app/actions/coach-dashboard'
import { getTrainerNotesForRange } from '@/app/actions/trainer-calendar'
import { TrenerKalender } from '@/components/coach/trener-kalender/TrenerKalender'

// /app/trener/kalender — fullverdig Måned/Uke/År-kalender med konkurranser
// fra utøvere, Delta-markerte økter og egne notater. Speiler navigation- og
// grid-mønstrene fra utøver-kalenderen, men med trener-blå farge og kun events.

export default async function CoachCalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  // Hent et rommelig intervall (ett år bakover, to år frem) så bruker kan
  // navigere fritt i Måned/Uke/År-views uten å måtte refetche.
  const today = new Date()
  const fromDate = new Date(today)
  fromDate.setFullYear(today.getFullYear() - 1)
  fromDate.setHours(0, 0, 0, 0)
  const toDate = new Date(today)
  toDate.setFullYear(today.getFullYear() + 2)
  toDate.setHours(0, 0, 0, 0)
  const fromISO = fromDate.toISOString().slice(0, 10)
  const toISO = toDate.toISOString().slice(0, 10)

  const [events, notes] = await Promise.all([
    getCoachCalendarEvents(fromISO, toISO),
    getTrainerNotesForRange(fromISO, toISO),
  ])

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
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
            Konkurranser fra utøvere, økter du har markert deltakelse på, og egne notater.
            Klikk på en dato for å se detaljer eller legge til notat. Klikk på tom celle i Uke-visning for å opprette notat med tid pre-fylt.
        </p>

        <TrenerKalender initialEvents={events} initialNotes={notes} />
      </div>
    </div>
  )
}
