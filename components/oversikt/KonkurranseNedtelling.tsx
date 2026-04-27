import Link from 'next/link'
import type { OversiktCompetition } from '@/app/actions/oversikt'
import { SPORTS } from '@/lib/types'

function sportLabel(v: string | null): string | null {
  if (!v) return null
  return SPORTS.find(s => s.value === v)?.label ?? v
}

function fmtLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const s = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function KonkurranseNedtelling({ comp }: { comp: OversiktCompetition }) {
  const gold = '#D4A017'
  const sport = sportLabel(comp.sport)
  const href = comp.linked_workout_id
    ? `/app/plan?edit=${comp.linked_workout_id}`
    : '/app/periodisering'

  return (
    <section className="p-5 mb-6"
      style={{
        backgroundColor: '#14110A',
        border: `1px solid ${gold}`,
        boxShadow: '0 0 20px rgba(212, 160, 23, 0.15)',
      }}>
      <div className="flex items-center gap-3 mb-3">
        <span style={{ width: '16px', height: '2px', backgroundColor: gold, display: 'inline-block' }} />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: gold }}>
          Neste konkurranse
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex-1 min-w-[220px]">
          <h3 style={{
            fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2',
            fontSize: '26px', letterSpacing: '0.04em', lineHeight: 1.1,
          }}>
            {comp.name}
          </h3>
          <p className="mt-1 text-sm"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F5E7B0' }}>
            {fmtLongDate(comp.date)}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
            {sport && <span>{sport}</span>}
            {comp.distance_format && <span>{comp.distance_format}</span>}
            {comp.location && <span>{comp.location}</span>}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", color: gold,
            fontSize: '56px', letterSpacing: '0.04em', lineHeight: 0.95,
          }}>
            {comp.days_until === 0 ? 'I DAG' : comp.days_until}
          </span>
          {comp.days_until !== 0 && (
            <span className="text-xs tracking-widest uppercase mt-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", color: gold }}>
              {comp.days_until === 1 ? 'Dag igjen' : 'Dager igjen'}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Link href={href}
          className="inline-block px-3 py-1 text-xs tracking-widest uppercase hover:opacity-90"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: gold, border: `1px solid ${gold}`, textDecoration: 'none',
          }}>
          Åpne detaljer →
        </Link>
      </div>
    </section>
  )
}
