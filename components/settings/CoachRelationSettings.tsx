'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  revokeTrainerRelation,
  updateCoachPermissions,
  type AthleteCoachRelation,
  type AthletePermissionsPatch,
} from '@/app/actions/coach-invite'

const COACH_BLUE = '#1A6FD4'

interface Props {
  relations: AthleteCoachRelation[]
}

export function CoachRelationSettings({ relations }: Props) {
  if (relations.length === 0) {
    return (
      <p className="p-5 text-xs"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#555560',
          backgroundColor: '#16161A', border: '1px solid #1E1E22',
        }}>
        Ingen aktive trenerkoblinger ennå. Del trener-koden over for å koble til en trener.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {relations.map(r => <RelationRow key={r.id} relation={r} />)}
    </ul>
  )
}

function RelationRow({ relation }: { relation: AthleteCoachRelation }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [perm, setPerm] = useState({
    can_edit_plan: relation.can_edit_plan,
    can_view_dagbok: relation.can_view_dagbok,
    can_view_analysis: relation.can_view_analysis,
    can_edit_periodization: relation.can_edit_periodization,
  })

  const togglePerm = (key: keyof typeof perm) => {
    const next = { ...perm, [key]: !perm[key] }
    setPerm(next)
    const patch: AthletePermissionsPatch = { [key]: next[key] }
    startTransition(async () => {
      const res = await updateCoachPermissions(relation.id, patch)
      if (res.error) {
        setError(res.error)
        // rull tilbake ved feil
        setPerm(perm)
      } else {
        setError(null)
        router.refresh()
      }
    })
  }

  const onRevoke = () => {
    if (!confirming) { setConfirming(true); return }
    startTransition(async () => {
      const res = await revokeTrainerRelation(relation.id)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <li className="p-4" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <span
          style={{
            width: '10px', height: '10px', borderRadius: '50%',
            backgroundColor: COACH_BLUE, flexShrink: 0,
          }}
        />
        <div className="flex-1 min-w-0">
          <div
            className="text-base"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.04em' }}
          >
            {relation.coachName ?? 'Ukjent trener'}
          </div>
          {relation.coachEmail && (
            <div className="text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {relation.coachEmail}
            </div>
          )}
        </div>
        {!confirming ? (
          <button
            type="button"
            onClick={onRevoke}
            className="px-3 py-1.5 text-[10px] tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              backgroundColor: 'transparent', color: '#E11D48',
              border: '1px solid #E11D48',
              cursor: 'pointer',
            }}
          >
            Fjern tilgang
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 text-[10px] tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: 'transparent', color: '#8A8A96',
                border: '1px solid #1E1E22',
                cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={onRevoke}
              disabled={isPending}
              className="px-3 py-1.5 text-[10px] tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#E11D48', color: '#F0F0F2',
                border: 'none',
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Fjerner…' : 'Bekreft fjern'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 grid grid-cols-2 gap-2"
        style={{ borderTop: '1px solid #1E1E22' }}>
        <PermissionToggle
          label="Plan (se + endre)"
          checked={perm.can_edit_plan}
          onToggle={() => togglePerm('can_edit_plan')}
          disabled={isPending}
        />
        <PermissionToggle
          label="Dagbok (se)"
          checked={perm.can_view_dagbok}
          onToggle={() => togglePerm('can_view_dagbok')}
          disabled={isPending}
        />
        <PermissionToggle
          label="Analyse (se)"
          checked={perm.can_view_analysis}
          onToggle={() => togglePerm('can_view_analysis')}
          disabled={isPending}
        />
        <PermissionToggle
          label="Årsplan (se + endre)"
          checked={perm.can_edit_periodization}
          onToggle={() => togglePerm('can_edit_periodization')}
          disabled={isPending}
        />
      </div>

      {error && (
        <p className="text-xs mt-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}
    </li>
  )
}

function PermissionToggle({
  label, checked, onToggle, disabled,
}: { label: string; checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <label
      className="flex items-center gap-2 px-2 py-1.5"
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid #1E1E22',
        backgroundColor: checked ? 'rgba(26,111,212,0.1)' : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        style={{ accentColor: COACH_BLUE }}
      />
      <span className="text-[10px] tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        {label}
      </span>
    </label>
  )
}
