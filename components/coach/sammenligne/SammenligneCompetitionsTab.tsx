'use client'

import type { MultipleAthletesAnalysis } from '@/app/actions/comparison'

const PALETTE = ['#1A6FD4', '#FF4500', '#D4A017', '#22C55E', '#A855F7', '#0EA5E9', '#F472B6', '#EAB308']
function colorFor(i: number): string { return PALETTE[i % PALETTE.length]! }

function fmtDuration(seconds: number): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}t ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtKm(meters: number): string {
  if (!meters) return '—'
  return `${(meters / 1000).toFixed(1)} km`
}

export function SammenligneCompetitionsTab({ data }: { data: MultipleAthletesAnalysis }) {
  const valid = data.athletes.filter(r => r.competitions?.hasData)

  if (valid.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p className="text-sm tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen utøvere har konkurranser i valgt periode.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SummaryTable rows={data.athletes} />

      {data.athletes.map((r, i) => {
        const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
        const c = r.competitions
        if (!c?.hasData) return null
        return (
          <div key={r.athlete.id} style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
            <div className="px-4 py-3 flex items-center gap-2"
              style={{ borderBottom: '1px solid #1E1E22' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: colorFor(i), display: 'inline-block' }} />
              <p className="text-sm tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                {name} — {c.rows.length} konkurranser
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E1E22' }}>
                    <Th>Dato</Th>
                    <Th>Tittel</Th>
                    <Th>Sport</Th>
                    <Th>Distanse</Th>
                    <Th>Tid</Th>
                    <Th>Plassering</Th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.slice(0, 10).map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                      <Td>{row.date}</Td>
                      <Td>{row.title || row.name || '—'}</Td>
                      <Td>{row.sport}</Td>
                      <Td>{fmtKm(row.total_meters)}</Td>
                      <Td>{fmtDuration(row.duration_seconds)}</Td>
                      <Td>
                        {row.position_overall && row.participant_count
                          ? `${row.position_overall}/${row.participant_count}`
                          : row.position_overall ?? '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SummaryTable({ rows }: { rows: MultipleAthletesAnalysis['athletes'] }) {
  return (
    <div className="overflow-x-auto" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            <Th>Utøver</Th>
            <Th>Antall</Th>
            <Th>Kommende</Th>
            <Th>Sporter</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
            const c = r.competitions
            if (!c) {
              return (
                <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                  <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                  <td colSpan={3} className="py-2 px-3" style={{ color: '#555560', fontStyle: 'italic' }}>
                    {r.errors[0] ?? 'Ingen data'}
                  </td>
                </tr>
              )
            }
            return (
              <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                <Td>{c.rows.length}</Td>
                <Td>{c.upcomingPlanned.length}</Td>
                <Td>{c.sportsPresent.join(', ') || '—'}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left py-2 px-3 text-xs tracking-widest uppercase"
    style={{ color: '#555560', fontWeight: 'normal' }}>{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-2 px-3" style={{ color: '#F0F0F2' }}>{children}</td>
}
