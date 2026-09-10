import { XPulseIcon, XP_GRADIENT } from '@/components/branding/XPulseIcon'

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
        borderRadius: 18,
        padding: '2.5rem',
        boxShadow: '0 24px 60px color-mix(in srgb, #000 28%, transparent)',
      }}
    >
      <div className="mb-8">
        <div className="mb-6 flex items-center justify-center gap-2">
          <XPulseIcon size={50} ariaLabel="X-PULSE" variant="gradient" />
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              // Ordmerket følger logoens gradient i stedet for flat oransje.
              backgroundImage: `linear-gradient(100deg, ${XP_GRADIENT[1]}, ${XP_GRADIENT[2]})`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              fontSize: '34px',
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
