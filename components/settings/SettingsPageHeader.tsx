import Link from 'next/link'

interface Props {
  title: string
  description?: string
}

// Felles header for innstillinger-undersider: tilbake-pil + tittel +
// valgfri ingress. Holder visuell paritet på tvers av drill-down-flow.
export function SettingsPageHeader({ title, description }: Props) {
  return (
    <>
      <Link href="/app/innstillinger"
        className="text-xs tracking-widest uppercase inline-block mb-4 hover:opacity-80 transition-opacity"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
          textDecoration: 'none',
        }}>
        ← Innstillinger
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
          fontSize: '36px', letterSpacing: '0.08em',
        }}>
          {title}
        </h1>
      </div>

      {description && (
        <p className="mb-6 text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {description}
        </p>
      )}
    </>
  )
}
