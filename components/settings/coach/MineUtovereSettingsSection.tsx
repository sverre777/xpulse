'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateAthletePermissions,
  endAthleteRelation,
  type CoachAthleteRelation,
  type AthletePermissionsPatch,
} from '@/app/actions/coach-settings'

const COACH_BLUE = '#1A6FD4'

interface Props {
  initial: CoachAthleteRelation[]
}

const STATUS_LABEL: Record<CoachAthleteRelation['status'], string> = {
  pending: 'Avventer',
  active: 'Aktiv',
  inactive: 'Avsluttet',
}

const STATUS_COLOR: Record<CoachAthleteRelation['status'], string> = {
  pending: '#F59E0B',
  active: '#28A86E',
  inactive: '#8A8A96',
}

export function MineUtovereSettingsSection({ initial }: Props) {
  const [relations, setRelations] = useState(initial)

  if (relations.length === 0) {
    return (
      <section
        className="p-5"
        style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}
      >
        <p className="text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Ingen utøvere er koblet til deg ennå.
        </p>
      </section>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {relations.map(rel => (
        <RelationCard
          key={rel.id}
          relation={rel}
          onPatch={(patch) =>
            setRelations(prev => prev.map(r => r.id === rel.id ? { ...r, ...mapPatch(patch) } : r))
          }
          onEnd={() =>
            setRelations(prev => prev.map(r => r.id === rel.id ? { ...r, status: 'inactive' } : r))
          }
        />
      ))}
    </ul>
  )
}

function mapPatch(patch: AthletePermissionsPatch): Partial<CoachAthleteRelation> {
  const out: Partial<CoachAthleteRelation> = {}
  if (patch.can_edit_plan !== undefined) out.canEditPlan = patch.can_edit_plan
  if (patch.can_view_dagbok !== undefined) out.canViewDagbok = patch.can_view_dagbok
  if (patch.can_view_analysis !== undefined) out.canViewAnalysis = patch.can_view_analysis
  if (patch.can_edit_periodization !== undefined) out.canEditPeriodization = patch.can_edit_periodization
  return out
}

function RelationCard({
  relation, onPatch, onEnd,
}: {
  relation: CoachAthleteRelation
  onPatch: (p: AthletePermissionsPatch) => void
  onEnd: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const togglePerm = (col: keyof AthletePermissionsPatch, current: boolean) => {
    const patch: AthletePermissionsPatch = { [col]: !current }
    onPatch(patch)
    startTransition(async () => {
      const res = await updateAthletePermissions(relation.id, patch)
      if (res.error) {
        setError(res.error)
        onPatch({ [col]: current })
      } else {
        setError(null)
        router.refresh()
      }
    })
  }

  const handleEnd = () => {
    if (!confirm(`Avslutte koblingen til ${relation.athleteName ?? 'utøver'}?`)) return
    startTransition(async () => {
      const res = await endAthleteRelation(relation.id)
      if (res.error) { setError(res.error); return }
      onEnd()
      router.refresh()
    })
  }

  const inactive = relation.status === 'inactive'

  return (
    <li
      className="p-4"
      style={{
        backgroundColor: '#1A1A22', border: '1px solid #1E1E22',
        opacity: inactive ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0">
          <p className="truncate"
            style={{
              fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
              fontSize: '20px', letterSpacing: '0.05em',
            }}>
            {relation.athleteName ?? 'Ukjent utøver'}
          </p>
          {relation.athleteEmail && (
            <p className="text-xs truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              {relation.athleteEmail}
            </p>
          )}
        </div>
        <span
          className="text-xs tracking-widest uppercase px-2 py-0.5"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: STATUS_COLOR[relation.status],
            border: `1px solid ${STATUS_COLOR[relation.status]}`,
          }}
        >
          {STATUS_LABEL[relation.status]}
        </span>
      </div>

      {!inactive && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          <PermToggle
            label="Plan (se + endre)"
            checked={relation.canEditPlan}
            disabled={isPending}
            onToggle={() => togglePerm('can_edit_plan', relation.canEditPlan)}
          />
          <PermToggle
            label="Dagbok (se)"
            checked={relation.canViewDagbok}
            disabled={isPending}
            onToggle={() => togglePerm('can_view_dagbok', relation.canViewDagbok)}
          />
          <PermToggle
            label="Analyse (se)"
            checked={relation.canViewAnalysis}
            disabled={isPending}
            onToggle={() => togglePerm('can_view_analysis', relation.canViewAnalysis)}
          />
          <PermToggle
            label="Årsplan (se + endre)"
            checked={relation.canEditPeriodization}
            disabled={isPending}
            onToggle={() => togglePerm('can_edit_periodization', relation.canEditPeriodization)}
          />
        </div>
      )}

      {error && (
        <p className="text-xs mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/app/trener/${relation.athleteId}/profil`}
          className="px-3 py-1.5 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(26,111,212,0.1)]"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: COACH_BLUE, border: `1px solid ${COACH_BLUE}`,
            textDecoration: 'none',
          }}
        >
          Profil
        </Link>
        {!inactive && (
          <button
            type="button"
            onClick={handleEnd}
            disabled={isPending}
            className="px-3 py-1.5 text-xs tracking-widest uppercase transition-colors hover:bg-[rgba(225,29,72,0.1)]"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#E11D48', border: '1px solid #E11D48',
              background: 'none', cursor: 'pointer',
            }}
          >
            Avslutt kobling
          </button>
        )}
      </div>
    </li>
  )
}

function PermToggle({
  label, checked, onToggle, disabled,
}: { label: string; checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <label
      className="flex items-center gap-2 px-3 py-2"
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
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
        {label}
      </span>
    </label>
  )
}
