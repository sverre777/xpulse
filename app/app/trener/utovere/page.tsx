import { getCoachUtovere } from '@/app/actions/coach-utovere'
import { UtovereGrid } from '@/components/coach/UtovereGrid'

const COACH_BLUE = '#1A6FD4'

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 mb-6"
      style={{ backgroundColor: '#2A0E0E', border: '1px solid #E11D48' }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
        Kunne ikke laste utøvere
      </p>
      <pre className="whitespace-pre-wrap break-words"
        style={{ fontFamily: 'ui-monospace, monospace', color: '#F0F0F2', fontSize: '13px' }}>
        {message}
      </pre>
    </div>
  )
}

export default async function CoachUtoverePage() {
  const res = await getCoachUtovere()

  if ('error' in res) {
    return (
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6">
        <ErrorBox message={res.error} />
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
            {res.athletes.length} aktive
          </span>
        </div>
      </div>

      <UtovereGrid athletes={res.athletes} />
    </div>
  )
}
