interface PlaceholderPanelProps {
  title: string
  description: string
  comingSoon?: string[]
  accentColor?: string
}

export function PlaceholderPanel({
  title,
  description,
  comingSoon = [],
  accentColor = '#FF4500',
}: PlaceholderPanelProps) {
  return (
    <div
      className="flex flex-col gap-4 p-6"
      style={{
        backgroundColor: '#16161A',
        border: '1px solid #222228',
      }}
    >
      <div
        className="w-8 h-0.5"
        style={{ backgroundColor: accentColor }}
      />
      <h3
        className="text-xl"
        style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', letterSpacing: '0.08em' }}
      >
        {title}
      </h3>
      <p
        className="text-sm tracking-wide"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
      >
        {description}
      </p>
      {comingSoon.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {comingSoon.map((item) => (
            <div
              key={item}
              className="flex items-center gap-2"
            >
              <span
                className="text-xs"
                style={{ color: accentColor }}
              >
                —
              </span>
              <span
                className="text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      )}
      <div
        className="mt-2 px-3 py-1.5 self-start text-xs tracking-widest uppercase"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          color: accentColor,
          border: `1px solid ${accentColor}`,
          opacity: 0.6,
        }}
      >
        Kommer snart
      </div>
    </div>
  )
}
