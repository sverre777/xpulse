import { logout } from '@/app/actions/auth'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import type { Role } from '@/lib/types'

interface NavBarProps {
  role: Role
  userName: string | null
  hasAthleteRole?: boolean
  hasCoachRole?: boolean
}

export function NavBar({ role, userName, hasAthleteRole, hasCoachRole }: NavBarProps) {
  const accentColor = role === 'coach' ? '#1A6FD4' : '#FF4500'

  return (
    <nav
      className="flex items-center justify-between px-6 py-4"
      style={{
        backgroundColor: '#111113',
        borderBottom: `1px solid #222228`,
      }}
    >
      <div className="flex items-center gap-4">
        <span
          className="text-2xl tracking-widest"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: accentColor }}
        >
          X-PULSE
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span
          className="text-sm tracking-wide hidden sm:block"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
        >
          {userName ?? 'Bruker'}
        </span>
        <RoleSwitcher
          activeRole={role}
          hasAthleteRole={hasAthleteRole ?? (role === 'athlete')}
          hasCoachRole={hasCoachRole ?? (role === 'coach')}
        />
        <form action={logout}>
          <button
            type="submit"
            className="px-4 py-2 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: '#8A8A96',
              border: '1px solid #222228',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Logg ut
          </button>
        </form>
      </div>
    </nav>
  )
}
