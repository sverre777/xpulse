'use client'

import { useActionState, useEffect } from 'react'
import { addRole } from '@/app/actions/roles'
import type { Role } from '@/lib/types'

const ATHLETE_ORANGE = '#FF4500'
const COACH_BLUE = '#1A6FD4'

interface Props {
  role: Role
  onClose: () => void
}

export function RoleActivationModal({ role, onClose }: Props) {
  const [state, formAction, pending] = useActionState(addRole, {})

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const isCoach = role === 'coach'
  const color = isCoach ? COACH_BLUE : ATHLETE_ORANGE
  const title = isCoach ? 'Aktiver trener-rolle' : 'Aktiver utøver-rolle'
  const description = isCoach
    ? 'Som trener får du tilgang til utøverliste, treningsplanlegger, analyse av utøvernes data, og verktøy for å gi tilbakemeldinger. Du kan fortsatt bruke utøver-modus for egen trening.'
    : 'Som utøver får du tilgang til egen dagbok, plan, periodisering og analyse. Du kan fortsatt bruke trener-modus for utøverne dine.'
  const bullets = isCoach
    ? ['Utøverliste og invitasjoner', 'Treningsplanlegger og periodisering', 'Analyse av utøvernes belastning og helse', 'Meldinger og treningsfeedback']
    : ['Egen dagbok med daglig loggføring', 'Plan og periodisering', 'Belastning, helse og analyse', 'Fokuspunkter og ukesrefleksjoner']

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-activation-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#111113',
          border: '1px solid #1E1E22',
          maxWidth: 480,
          width: '100%',
          padding: 24,
          borderLeft: `4px solid ${color}`,
        }}
      >
        <h2
          id="role-activation-title"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: '#F0F0F2',
            fontSize: 28,
            letterSpacing: '0.05em',
            margin: 0,
            marginBottom: 12,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#B0B0B8',
            fontSize: 15,
            lineHeight: 1.5,
            margin: 0,
            marginBottom: 16,
          }}
        >
          {description}
        </p>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            marginBottom: 24,
            fontFamily: "'Barlow Condensed', sans-serif",
            color: '#8A8A96',
            fontSize: 14,
          }}
        >
          {bullets.map(b => (
            <li key={b} style={{ padding: '4px 0', display: 'flex', gap: 8 }}>
              <span style={{ color }}>›</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {state?.error && (
          <div
            className="mb-3"
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(224,96,74,0.08)',
              border: '1px solid rgba(224,96,74,0.35)',
              color: '#E0604A',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 14,
            }}
          >
            {state.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#8A8A96',
              background: 'none',
              border: '1px solid #2A2A30',
              padding: '8px 16px',
              cursor: 'pointer',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontSize: 13,
            }}
          >
            Avbryt
          </button>
          <form action={formAction}>
            <input type="hidden" name="role" value={role} />
            <button
              type="submit"
              disabled={pending}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#F0F0F2',
                backgroundColor: color,
                border: 'none',
                padding: '8px 18px',
                cursor: pending ? 'default' : 'pointer',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontSize: 13,
                fontWeight: 600,
                opacity: pending ? 0.6 : 1,
              }}
            >
              {pending ? 'Aktiverer…' : 'Aktiver rolle'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
