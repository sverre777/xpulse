'use client'

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
}

export function RoleSwitcher({ activeRole, hasAthleteRole, hasCoachRole }: Props) {
  const hasBoth = hasAthleteRole && hasCoachRole
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

  // Singel-rolle: vis "+ Legg til [annen rolle]"-knapp.
  if (!hasBoth) {
    const otherRole: Role = activeRole === 'coach' ? 'athlete' : 'coach'
    const otherLabel = otherRole === 'coach' ? 'trener' : 'utøver'
    return (
      <>
        <div className="flex items-center gap-2">
          <RoleBadge label={label} color={color} />
          <button
            type="button"
            onClick={() => setModalRole(otherRole)}
            className="text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#8A8A96',
              background: 'none',
              border: '1px solid #2A2A30',
              cursor: 'pointer',
              padding: '4px 10px',
            }}
          >
            + Legg til {otherLabel}
          </button>
        </div>
        {modalRole && (
          <RoleActivationModal role={modalRole} onClose={() => setModalRole(null)} />
        )}
      </>
    )
  }

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
            minWidth: 180,
            backgroundColor: '#16161A',
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
          <RoleMenuItem
            role="coach"
            label="Trener-modus"
            color={COACH_BLUE}
            active={activeRole === 'coach'}
            onPick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

function RoleBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="flex items-center gap-2 px-3 py-1"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        color: '#F0F0F2',
        border: `1px solid ${color}`,
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
    </span>
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
