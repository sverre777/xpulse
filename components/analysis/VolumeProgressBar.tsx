'use client'

export interface VolumeProgressBarProps {
  plannedHours: number
  actualSeconds: number
  label?: string
}

export function VolumeProgressBar({
  plannedHours, actualSeconds, label,
}: VolumeProgressBarProps) {
  if (plannedHours <= 0) return null

  const actualHours = actualSeconds / 3600
  const pct = Math.min(100, Math.max(0, (actualHours / plannedHours) * 100))
  const onTrack = pct >= 80
  const barColor = onTrack ? '#28A86E' : pct >= 50 ? '#D4A017' : '#FF4500'

  return (
    <div className="p-4 mb-5"
      style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {label ?? 'Planlagt volum — gjeldende periode'}
        </span>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: '#F0F0F2',
          fontSize: '20px',
          letterSpacing: '0.04em',
        }}>
          {actualHours.toFixed(1)} <span style={{ color: '#8A8A96', fontSize: '13px' }}>av</span> {plannedHours.toFixed(0)} timer
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#1E1E22',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: barColor,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {pct.toFixed(0)}% av plan
        </span>
      </div>
    </div>
  )
}
