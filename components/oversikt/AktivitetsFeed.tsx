import Link from 'next/link'
import type { OversiktFeedEntry } from '@/app/actions/oversikt'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'

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
    <section className="p-5 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span style={{ width: '16px', height: '2px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <span className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
            Siste aktiviteter
          </span>
        </div>
        <Link href="/app/historikk"
          className="text-xs tracking-widest uppercase hover:opacity-80"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', textDecoration: 'none' }}>
          Alle →
        </Link>
      </div>

      {feed.length === 0 ? (
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)' }}>
          Ingen gjennomførte økter enda.
        </p>
      ) : (
        <ul className="flex flex-col">
          {feed.map((e, i) => (
            <li key={e.id}
              className="py-3 flex items-center justify-between gap-3"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--kant-3)' }}>
              {/* Sonefarge-prikk: dominerende sone i oekta. Uten sonedata
                  staar den daempet — aldri en falsk farge. */}
              <span aria-hidden style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: e.primary_intensity_zone
                  ? (ZONE_COLORS_V2[e.primary_intensity_zone as keyof typeof ZONE_COLORS_V2] ?? 'var(--line2)')
                  : 'var(--line2)',
              }} />
              <Link href={`/app/dagbok?edit=${e.id}`}
                className="flex-1 min-w-0 hover:opacity-90"
                style={{ textDecoration: 'none' }}>
                <p className="truncate" style={{
                  fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)',
                  fontSize: '18px', letterSpacing: '0.04em', lineHeight: 1.1,
                }}>
                  {e.title}
                </p>
                <p className="mt-0.5 text-xs"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                  {fmtDate(e.date)} · {sportLabel(e.sport)} · {workoutTypeLabel(e.workout_type)}
                </p>
              </Link>
              {/* To linjer til hoyre: tid/distanse oeverst, puls/skudd under.
                  Styrkeoekter har verken distanse eller interessant puls —
                  de maales i oevelser (notat pkt 5). «—» der ingenting er
                  foert, aldri 0. */}
              <div className="flex flex-col items-end shrink-0 text-xs"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)' }}>
                <span>
                  {fmtDuration(e.duration_minutes)}
                  {e.exercise_count === 0 && e.distance_km !== null && e.distance_km > 0 && (
                    <span style={{ color: 'var(--tekst-5-app)' }}> · {e.distance_km.toFixed(1)} km</span>
                  )}
                </span>
                <span style={{ color: 'var(--tekst-5-app)' }}>
                  {e.exercise_count > 0
                    ? `${e.exercise_count} øvelser`
                    : e.shots
                      ? `${e.shots.shots} skudd${e.shots.accuracy_pct != null ? ` · ${e.shots.accuracy_pct} %` : ''}`
                      : e.avg_heart_rate != null
                        ? `${e.avg_heart_rate} bpm`
                        : '—'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
