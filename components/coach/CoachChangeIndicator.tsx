const COACH_BLUE = '#1A6FD4'

interface Props {
  coachName: string | null
  updatedAt: string
}

// Blå kant + badge som markerer at økta er laget/endret av trener.
// Brukes på utøverens øktkort i Dagbok/Plan/Historikk når created_by_coach_id != null.
export function CoachChangeIndicator({ coachName, updatedAt }: Props) {
  const d = new Date(updatedAt)
  const label = d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
  const name = coachName ?? 'Trener'
  return (
    <span
      title={`Endret av ${name} · ${label}`}
      className="inline-flex items-center gap-1 text-xs tracking-widest uppercase px-1.5 py-0.5"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: 'rgba(26,111,212,0.12)',
        color: COACH_BLUE,
        border: `1px solid ${COACH_BLUE}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px', height: '6px', borderRadius: '50%',
          backgroundColor: COACH_BLUE, display: 'inline-block',
        }}
      />
      Laget av {name.split(' ')[0] ?? name}
    </span>
  )
}
