import { logout } from '@/app/actions/auth'

interface NavBarProps {
  role: 'athlete' | 'coach'
  userName: string | null
}

export function NavBar({ role, userName }: NavBarProps) {
  const accentColor = role === 'coach' ? '#1A6FD4' : '#FF4500'
  const roleLabel = role === 'coach' ? 'Trener' : 'Utøver'

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
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#FF4500' }}
        >
          X-PULSE
        </span>
        <span
          className="px-2 py-0.5 text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: accentColor,
            border: `1px solid ${accentColor}`,
            opacity: 0.9,
          }}
        >
          {roleLabel}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span
          className="text-sm tracking-wide hidden sm:block"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
        >
          {userName ?? 'Bruker'}
        </span>
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
