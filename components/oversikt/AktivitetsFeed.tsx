import Link from 'next/link'
import type { OversiktFeedEntry } from '@/app/actions/oversikt'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'

function sportLabel(v: string): string {
  return SPORTS.find(s => s.value === v)?.label ?? v
}
function workoutTypeLabel(v: string): string {
  return WORKOUT_TYPES_BASE.find(t => t.value === v)?.label ?? v
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtDuration(mins: number | null): string {
  if (!mins || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}t ${m}m`
  if (h > 0) return `${h}t`
  return `${m}m`
}

export function AktivitetsFeed({ feed }: { feed: OversiktFeedEntry[] }) {
  return (
    <section className="p-5 mb-6" style={{ backgroundColor: '#111113', border: '1px solid #1E1E22' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <span className="text-[10px] tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            Siste aktiviteter
          </span>
        </div>
        <Link href="/app/historikk"
          className="text-[10px] tracking-widest uppercase hover:opacity-80"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', textDecoration: 'none' }}>
          Alle →
        </Link>
      </div>

      {feed.length === 0 ? (
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#55555F' }}>
          Ingen gjennomførte økter enda.
        </p>
      ) : (
        <ul className="flex flex-col">
          {feed.map((e, i) => (
            <li key={e.id}
              className="py-3 flex items-center justify-between gap-3"
              style={{ borderTop: i === 0 ? 'none' : '1px solid #1E1E22' }}>
              <Link href={`/app/dagbok?edit=${e.id}`}
                className="flex-1 min-w-0 hover:opacity-90"
                style={{ textDecoration: 'none' }}>
                <p className="truncate" style={{
                  fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
                  fontSize: '18px', letterSpacing: '0.04em', lineHeight: 1.1,
                }}>
                  {e.title}
                </p>
                <p className="mt-0.5 text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                  {fmtDate(e.date)} · {sportLabel(e.sport)} · {workoutTypeLabel(e.workout_type)}
                </p>
              </Link>
              <div className="flex flex-col items-end shrink-0 text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                <span>{fmtDuration(e.duration_minutes)}</span>
                {e.distance_km !== null && e.distance_km > 0 && (
                  <span style={{ color: '#8A8A96' }}>{e.distance_km.toFixed(1)} km</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
