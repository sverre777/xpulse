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
        backgroundColor: '#1A1A22',
        border: '1px solid #222228',
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
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.08em' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="text-sm text-center mt-1 tracking-wide"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
