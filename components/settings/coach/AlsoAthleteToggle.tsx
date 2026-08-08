'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toggleAthleteRole } from '@/app/actions/roles'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  hasAthleteRole: boolean
}

export function AlsoAthleteToggle({ hasAthleteRole }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(toggleAthleteRole, {})

  useEffect(() => {
    if (!state.error && !isPending) router.refresh()
  }, [state, isPending, router])

  return (
    <div style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <div className="flex items-start justify-between gap-4 p-5">
        <div style={{ flex: 1 }}>
          <p
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', margin: 0 }}
          >
            Også utøver
          </p>
          <p
            className="text-sm mt-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', margin: 0, marginTop: 6, lineHeight: 1.5 }}
          >
            Aktiver for å bruke din egen dagbok, plan og periodisering i tillegg til trener-panelet.
            Du kan enkelt bytte mellom rollene i navigasjonen.
          </p>
        </div>

        <form action={formAction} style={{ flexShrink: 0 }}>
          <input type="hidden" name="enable" value={hasAthleteRole ? 'false' : 'true'} />
          <button
            type="submit"
            disabled={isPending}
            className="text-xs tracking-widest uppercase px-4 py-2"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              cursor: isPending ? 'default' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              border: 'none',
              backgroundColor: hasAthleteRole ? '#2A2A30' : ATHLETE_ORANGE,
              color: hasAthleteRole ? '#8A8A96' : '#F0F0F2',
              transition: 'background-color 150ms',
              minWidth: 96,
            }}
          >
            {isPending ? '…' : hasAthleteRole ? 'Deaktiver' : 'Aktiver'}
          </button>
        </form>
      </div>

      {hasAthleteRole && (
        <div
          className="flex items-center gap-2 px-5 py-2 mx-5 mb-5"
          style={{
            backgroundColor: 'rgba(255,69,0,0.06)',
            border: '1px solid rgba(255,69,0,0.2)',
          }}
        >
          <span
            style={{
              width: 7, height: 7, borderRadius: '50%',
              backgroundColor: ATHLETE_ORANGE,
              display: 'inline-block', flexShrink: 0,
            }}
          />
          <span
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: ATHLETE_ORANGE }}
          >
            Utøver-modus aktivert — bytt rolle i navigasjonen
          </span>
        </div>
      )}

      {state?.error && (
        <p
          className="px-5 pb-4 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48', margin: 0 }}
        >
          {state.error}
        </p>
      )}
    </div>
  )
}
