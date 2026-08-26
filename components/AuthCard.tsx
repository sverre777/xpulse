import { XPulseIcon } from '@/components/branding/XPulseIcon'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div
      className="w-full max-w-md mx-auto"
      style={{
        backgroundColor: 'var(--flate-14)',
        border: '1px solid var(--kant-4)',
        padding: '2.5rem',
      }}
    >
      <div className="mb-8">
        <div className="mb-6 flex items-center justify-center gap-2">
          <XPulseIcon size={50} ariaLabel="X-PULSE" />
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              color: '#FF4500',
              fontSize: '33px',
              letterSpacing: '0.4em',
            }}
          >
            PULSE
          </span>
        </div>
        <h2
          className="text-3xl text-center"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', letterSpacing: '0.08em' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="text-sm text-center mt-1 tracking-wide"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
