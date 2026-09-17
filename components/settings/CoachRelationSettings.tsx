'use client'

import type { PermissionKey, Rettigheter } from '@/lib/target-user'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  revokeTrainerRelation,
  updateCoachPermissions,
  type AthleteCoachRelation,
  type AthletePermissionsPatch,
} from '@/app/actions/coach-invite'
import { setCoachDataPermission } from '@/app/actions/coach-data-permissions'

const COACH_BLUE = '#1A6FD4'

interface Props {
  relations: AthleteCoachRelation[]
  // Map relationId → can_see_health_data. Default false (DENY) hvis nøkkel mangler.
  initialHealthPermissions?: Record<string, boolean>
}

export function CoachRelationSettings({ relations, initialHealthPermissions = {} }: Props) {
  if (relations.length === 0) {
    return (
      <p className="p-5 text-xs"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)',
          backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12,
        }}>
        Ingen aktive trenerkoblinger ennå. Del trener-koden over for å koble til en trener.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {relations.map(r => (
        <RelationRow
          key={r.id}
          relation={r}
          initialCanSeeHealthData={initialHealthPermissions[r.id] === true}
        />
      ))}
    </ul>
  )
}

function RelationRow({
  relation, initialCanSeeHealthData,
}: {
  relation: AthleteCoachRelation
  initialCanSeeHealthData: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Fase 131: alle åtte flagg bor i coach_data_permissions og eies av utøveren.
  const [perm, setPerm] = useState<Rettigheter>(relation.rettigheter)
  const [canSeeHealthData, setCanSeeHealthData] = useState<boolean>(initialCanSeeHealthData)
  const [healthPending, startHealthTransition] = useTransition()

  const togglePerm = (key: PermissionKey) => {
    const next = { ...perm, [key]: !perm[key] }
    // Redigere dagbok forutsetter å se den - slår du av lesing, faller redigering.
    if (key === 'can_view_dagbok' && !next.can_view_dagbok) next.can_edit_dagbok = false
    setPerm(next)
    const patch: AthletePermissionsPatch = key === 'can_view_dagbok' && !next.can_view_dagbok
      ? { can_view_dagbok: false, can_edit_dagbok: false } : { [key]: next[key] }
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

  const toggleHealthData = () => {
    const next = !canSeeHealthData
    setCanSeeHealthData(next)
    startHealthTransition(async () => {
      const res = await setCoachDataPermission(relation.id, next)
      if (res.error) {
        setError(res.error)
        setCanSeeHealthData(canSeeHealthData) // rull tilbake
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
    <li className="p-4" style={{ backgroundColor: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12 }}>
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
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', letterSpacing: '0.04em' }}
          >
            {relation.coachName ?? 'Ukjent trener'}
          </div>
          {relation.coachEmail && (
            <div className="text-xs"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              {relation.coachEmail}
            </div>
          )}
        </div>
        {!confirming ? (
          <button
            type="button"
            onClick={onRevoke}
            className="px-3 py-1.5 text-xs tracking-widest uppercase"
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
              className="px-3 py-1.5 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: 'transparent', color: 'var(--tekst-5-app)',
                border: '1px solid var(--line)',
                cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={onRevoke}
              disabled={isPending}
              className="px-3 py-1.5 text-xs tracking-widest uppercase"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#E11D48', color: 'var(--tekst-1-app)',
                border: 'none',
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Fjerner…' : 'Bekreft fjern'}
            </button>
          </div>
        )}
      </div>

      {/* Fase 131: utøveren velger PER OMRÅDE om treneren får se, eller se og
          redigere. Redigeringsflaggene starter av; treneren kan ikke endre dem. */}
      <div className="mt-3 pt-3 grid grid-cols-2 gap-2" style={{ borderTop: '1px solid var(--line)' }} data-rettigheter>
        <PermissionToggle label="Plan (se + endre)" checked={perm.can_edit_plan} onToggle={() => togglePerm('can_edit_plan')} disabled={isPending} nokkel="can_edit_plan" />
        <PermissionToggle label="Årsplan (se + endre)" checked={perm.can_edit_periodization} onToggle={() => togglePerm('can_edit_periodization')} disabled={isPending} nokkel="can_edit_periodization" />
        <PermissionToggle label="Dagbok (se)" checked={perm.can_view_dagbok} onToggle={() => togglePerm('can_view_dagbok')} disabled={isPending} nokkel="can_view_dagbok" />
        <PermissionToggle label="Dagbok (se + redigere gjennomførte økter)" checked={perm.can_edit_dagbok} onToggle={() => togglePerm('can_edit_dagbok')} disabled={isPending || !perm.can_view_dagbok} nokkel="can_edit_dagbok" />
        <PermissionToggle label="Analyse (se)" checked={perm.can_view_analysis} onToggle={() => togglePerm('can_view_analysis')} disabled={isPending} nokkel="can_view_analysis" />
        <PermissionToggle label="Terskler og soner (endre)" checked={perm.can_edit_terskler} onToggle={() => togglePerm('can_edit_terskler')} disabled={isPending} nokkel="can_edit_terskler" />
        <PermissionToggle label="Utstyr (endre inventar)" checked={perm.can_edit_utstyr} onToggle={() => togglePerm('can_edit_utstyr')} disabled={isPending} nokkel="can_edit_utstyr" />
        <PermissionToggle label="Tester og PR (føre)" checked={perm.can_edit_tester} onToggle={() => togglePerm('can_edit_tester')} disabled={isPending} nokkel="can_edit_tester" />
      </div>
      <p className="mt-1 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        Gjennomførte økter og «marker som gjennomført» krever «Dagbok (se + redigere)». Treneren ser hva du har valgt, men kan ikke endre det.
      </p>

      {/* Helsedata-deling - separat fra grunn-permissions siden HRV/søvn/vekt/
          hvilepuls er privat-data som krever eksplisitt opt-in per trener.
          Default AV. Når av skjules helse-fane og helse-KPIer i analysen. */}
      <div className="mt-3 pt-3"
        style={{ borderTop: '1px solid var(--line)' }}>
        <PermissionToggle
          label={`Vis helsedata (HRV, søvn, vekt, hvilepuls) til ${relation.coachName ?? 'treneren'}`}
          checked={canSeeHealthData}
          onToggle={toggleHealthData}
          disabled={healthPending}
        />
        <p className="mt-1 text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
          {canSeeHealthData
            ? 'Treneren ser helse-fane og helse-KPIer i analysen din.'
            : 'Treneren ser all annen analyse, men ikke helsedata.'}
        </p>
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
  label, checked, onToggle, disabled, nokkel,
}: { label: string; checked: boolean; onToggle: () => void; disabled?: boolean; nokkel?: string }) {
  return (
    <label
      data-rettighet={nokkel}
      className="flex items-center gap-2 px-2 py-1.5"
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid var(--line)',
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
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
        {label}
      </span>
    </label>
  )
}
