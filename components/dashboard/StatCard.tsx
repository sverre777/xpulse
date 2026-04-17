interface StatCardProps {
  label: string
  value: string
  unit?: string
  accentColor?: string
}

export function StatCard({ label, value, unit, accentColor = '#FF4500' }: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-1 p-5"
      style={{
        backgroundColor: '#16161A',
        border: '1px solid #222228',
      }}
    >
      <span
        className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span
          className="text-4xl"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2' }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: accentColor }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}
