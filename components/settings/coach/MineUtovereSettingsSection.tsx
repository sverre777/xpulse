'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { xpConfirm } from '@/components/ui/ConfirmDialog'
import type { PermissionKey } from '@/lib/target-user'
import {
  endAthleteRelation,
  type CoachAthleteRelation,
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

const RETTIGHET_ETIKETTER: [PermissionKey, string][] = [
  ['can_edit_plan', 'Plan'], ['can_edit_periodization', 'Årsplan'], ['can_view_dagbok', 'Dagbok (se)'], ['can_edit_dagbok', 'Dagbok (redigere)'],
  ['can_view_analysis', 'Analyse'], ['can_edit_terskler', 'Terskler'], ['can_edit_utstyr', 'Utstyr'], ['can_edit_tester', 'Tester'],
]

const STATUS_COLOR: Record<CoachAthleteRelation['status'], string> = {
  pending: '#F59E0B',
  active: '#28A86E',
  inactive: 'var(--tekst-5-app)',
}

export function MineUtovereSettingsSection({ initial }: Props) {
  const [relations, setRelations] = useState(initial)

  if (relations.length === 0) {
    return (
      <section
        className="p-5"
        style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}
      >
        <p className="text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
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
          onEnd={() =>
            setRelations(prev => prev.map(r => r.id === rel.id ? { ...r, status: 'inactive' } : r))
          }
        />
      ))}
    </ul>
  )
}


function RelationCard({
  relation, onEnd,
}: {
  relation: CoachAthleteRelation
  onEnd: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()


  const handleEnd = async () => {
    if (!await xpConfirm(`Avslutte koblingen til ${relation.athleteName ?? 'utøver'}?`)) return
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
        backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12,
        opacity: inactive ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0">
          <p className="truncate"
            style={{
              fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)',
              fontSize: '20px', letterSpacing: '0.05em',
            }}>
            {relation.athleteName ?? 'Ukjent utøver'}
          </p>
          {relation.athleteEmail && (
            <p className="text-xs truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              {relation.athleteEmail}
            </p>
          )}
        </div>
        <span
          className="text-xs tracking-widest uppercase px-2 py-0.5"
          style={{ borderRadius: 999,
            fontFamily: "'Barlow Condensed', sans-serif",
            color: STATUS_COLOR[relation.status],
            border: `1px solid ${STATUS_COLOR[relation.status]}`,
          }}
        >
          {STATUS_LABEL[relation.status]}
        </span>
      </div>

      {/* Fase 131: rettighetene velges av UTØVEREN (Innstillinger › Trener). Treneren ser dem, kan ikke endre. */}
      {!inactive && (
        <div className="flex flex-wrap gap-1.5 mb-3" data-rettigheter-lesing>
          {RETTIGHET_ETIKETTER.map(([k, navn]) => (
            <span key={k} data-rettighet={k} data-gitt={relation.rettigheter[k] ? '1' : '0'} className="xp-pill" style={{ minHeight: 28, padding: '0 10px', fontSize: 11, opacity: relation.rettigheter[k] ? 1 : .45, borderColor: relation.rettigheter[k] ? '#28A86E' : 'var(--line2)', color: relation.rettigheter[k] ? '#28A86E' : 'var(--tekst-8-app)', background: 'none' }}>
              {relation.rettigheter[k] ? '✓' : '–'} {navn}
            </span>
          ))}
          <span className="text-xs w-full mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>Utøveren velger rettighetene selv under Innstillinger › Trener.</span>
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

