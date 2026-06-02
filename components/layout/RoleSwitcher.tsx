'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { switchActiveRole } from '@/app/actions/roles'
import type { Role } from '@/lib/types'
import { RoleActivationModal } from './RoleActivationModal'

const ATHLETE_ORANGE = '#FF4500'
const COACH_BLUE = '#1A6FD4'

interface Props {
  activeRole: Role
  hasAthleteRole: boolean
  hasCoachRole: boolean
  // Betalingsbevis for trener-modus (Trener Basic/Pro). Styrer KUN visning:
  // har-tier → full veksling; mangler-tier → "+ Legg til trener-profil" som
  // leder til abonnement-oppgradering. Selve tilgangs-gaten ligger i middleware
  // og switchActiveRole-action — RoleSwitcher gjør ingen redirects selv.
  hasCoachTier: boolean
}

export function RoleSwitcher({ activeRole, hasAthleteRole, hasCoachRole, hasCoachTier }: Props) {
  const [open, setOpen] = useState(false)
  const [modalRole, setModalRole] = useState<Role | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const color = activeRole === 'coach' ? COACH_BLUE : ATHLETE_ORANGE
  const label = activeRole === 'coach' ? 'TRENER' : 'UTØVER'

  // Visning bestemmes av trener-TIER, ikke bare rolle-flagget:
  //   - Mangler trener-tier  → utøver-modus + "+ Legg til trener-profil"
  //     som leder til abonnement (IKKE tom/blank trener-modus).
  //   - Har tier men ikke aktivert trener-rollen → samme affordans, men
  //     aktiverer rollen gratis via modal (de har allerede betalt).
  //   - Har tier OG trener-rolle OG utøver-rolle → full veksling. Trener-tier
  //     inkluderer alltid utøver-funksjoner.
  const canSwitch = hasCoachTier && hasCoachRole && hasAthleteRole

  // Felles dropdown for alle tilfeller — holder navbaren ren på desktop.
  // Trigger = klikkbar rolle-badge med pil. Menyen viser tilgjengelige moduser,
  // og for utøvere uten full trener-tilgang ligger "+ Legg til trener-profil"
  // som en rad NEDERST i menyen (modal hvis allerede betalt, ellers lenke til
  // abonnement-oppgradering) — i stedet for en frittstående knapp ved siden av.
  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-1 transition-colors"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: '#F0F0F2',
          background: 'none',
          border: `1px solid ${color}`,
          cursor: 'pointer',
          height: '32px',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: color,
            display: 'inline-block',
          }}
        />
        <span className="text-xs tracking-widest uppercase">{label}</span>
        <span style={{ color: '#8A8A96', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 200,
            backgroundColor: '#1A1A22',
            border: '1px solid #1E1E22',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 60,
          }}
        >
          <RoleMenuItem
            role="athlete"
            label="Utøver-modus"
            color={ATHLETE_ORANGE}
            active={activeRole === 'athlete'}
            onPick={() => setOpen(false)}
          />
          {canSwitch ? (
            <RoleMenuItem
              role="coach"
              label="Trener-modus"
              color={COACH_BLUE}
              active={activeRole === 'coach'}
              onPick={() => setOpen(false)}
            />
          ) : (
            <AddTrenerProfileMenuItem
              needsUpgrade={!hasCoachTier}
              onActivate={() => { setOpen(false); setModalRole('coach') }}
            />
          )}
        </div>
      )}

      {modalRole && (
        <RoleActivationModal role={modalRole} onClose={() => setModalRole(null)} />
      )}
    </div>
  )
}

// "+ Legg til trener-profil"-rad nederst i rolle-menyen for utøvere uten full
// trener-tilgang. Mangler tier → lenke til abonnement-oppgradering. Har tier
// men ikke aktivert rollen → aktiver gratis via modal.
function AddTrenerProfileMenuItem({
  needsUpgrade, onActivate,
}: {
  needsUpgrade: boolean
  onActivate: () => void
}) {
  const inner = (
    <span
      className="w-full flex items-center gap-2 px-3 py-2 text-left"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: '#B0B0B8',
        borderTop: '1px solid #1E1E22',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COACH_BLUE, display: 'inline-block' }} />
      <span className="text-xs tracking-widest uppercase">+ Legg til trener-profil</span>
    </span>
  )
  if (needsUpgrade) {
    return (
      <Link href="/app/abonnement?upgrade=trener" role="menuitem"
        style={{ display: 'block', textDecoration: 'none' }}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" role="menuitem" onClick={onActivate}
      style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      {inner}
    </button>
  )
}

function RoleMenuItem({
  role,
  label,
  color,
  active,
  onPick,
}: {
  role: Role
  label: string
  color: string
  active: boolean
  onPick: () => void
}) {
  const [state, formAction, pending] = useActionState(switchActiveRole, {})
  const router = useRouter()

  useEffect(() => {
    if (state?.redirectTo) {
      router.push(state.redirectTo)
      router.refresh()
    }
  }, [state, router])

  return (
    <form
      action={formAction}
      onSubmit={() => onPick()}
      style={{ display: 'block' }}
    >
      <input type="hidden" name="role" value={role} />
      <button
        type="submit"
        disabled={active || pending}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: active ? '#F0F0F2' : '#B0B0B8',
          background: active ? '#1E1E22' : 'transparent',
          border: 'none',
          cursor: active || pending ? 'default' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: color,
            display: 'inline-block',
          }}
        />
        <span className="text-xs tracking-widest uppercase">{label}</span>
        {active && (
          <span style={{ marginLeft: 'auto', color: '#8A8A96', fontSize: 11 }}>AKTIV</span>
        )}
      </button>
      {state?.error && !active && (
        <div className="px-3 pb-2 text-xs" style={{ color: '#E0604A' }}>
          {state.error}
        </div>
      )}
    </form>
  )
}
