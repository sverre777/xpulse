import { getCoachUtovere } from '@/app/actions/coach-utovere'
import { LoadError } from '@/components/ui/LoadError'
import { UtovereGrid } from '@/components/coach/UtovereGrid'

const COACH_BLUE = '#1A6FD4'


export default async function CoachUtoverePage() {
  const res = await getCoachUtovere()

  if ('error' in res) {
    return (
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
        <LoadError what="utøverne" detail={res.error} />
      </div>
    )
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
      <div className="mb-6">
        <p className="text-xs tracking-widest uppercase mb-1"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Trener
        </p>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: '#F0F0F2',
          fontSize: '40px',
          letterSpacing: '0.05em',
          lineHeight: 1,
        }}>
          Utøvere
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <span style={{ width: '24px', height: '2px', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {res.athleteLimit != null
              ? `${res.athletes.length} av ${res.athleteLimit} aktive`
              : `${res.athletes.length} aktive`}
          </span>
        </div>
      </div>

      <UtovereGrid athletes={res.athletes} />
    </div>
  )
}
