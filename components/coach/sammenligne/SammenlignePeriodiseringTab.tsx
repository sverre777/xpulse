'use client'

import type { MultipleAthletesAnalysis } from '@/app/actions/comparison'

const PALETTE = ['#1A6FD4', '#FF4500', '#D4A017', '#22C55E', '#A855F7', '#0EA5E9', '#F472B6', '#EAB308']
function colorFor(i: number): string { return PALETTE[i % PALETTE.length]! }

const INTENSITY_COLOR: Record<string, string> = {
  rolig: '#22C55E',
  medium: '#EAB308',
  hard: '#EF4444',
}

const STATUS_LABEL: Record<string, string> = {
  past: 'Forrige',
  current: 'Aktiv',
  future: 'Kommende',
}

const KEY_LABEL: Record<string, string> = {
  competition_a: 'A-konk',
  competition_b: 'B-konk',
  competition_c: 'C-konk',
  test: 'Test',
  camp: 'Samling',
  other: 'Annet',
}

function fmtHours(seconds: number): string { return `${(seconds / 3600).toFixed(1)} t` }

export function SammenlignePeriodiseringTab({ data }: { data: MultipleAthletesAnalysis }) {
  const valid = data.athletes.filter(r => r.periodization?.hasData)

  if (valid.length === 0) {
    return (
      <div className="py-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p className="text-sm tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          Ingen utøvere har aktiv sesong eller årsplan-data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SeasonTable rows={data.athletes} />

      {valid.map((r, i) => {
        const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
        const p = r.periodization!
        const season = p.season
        return (
          <div key={r.athlete.id} style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
            <div className="px-4 py-3 flex items-center gap-2"
              style={{ borderBottom: '1px solid #1E1E22' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: colorFor(i), display: 'inline-block' }} />
              <p className="text-sm tracking-widest uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                {name}
                {season && (
                  <span style={{ color: '#555560', marginLeft: '8px', textTransform: 'none' }}>
                    — {season.name} ({season.start_date} → {season.end_date})
                  </span>
                )}
              </p>
            </div>

            {season?.goal_main && (
              <div className="px-4 py-2" style={{ borderBottom: '1px solid #1E1E22' }}>
                <p className="text-xs tracking-widest uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  Hovedmål
                </p>
                <p className="text-sm" style={{ color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {season.goal_main}
                </p>
              </div>
            )}

            {p.periods.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1E1E22' }}>
                      <Th>Periode</Th>
                      <Th>Status</Th>
                      <Th>Datoer</Th>
                      <Th>Intensitet</Th>
                      <Th>Økter</Th>
                      <Th>Tid</Th>
                      <Th>TSS</Th>
                      <Th>Konk.</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.periods.map(period => (
                      <tr key={period.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                        <Td>{period.name}{period.focus && <span style={{ color: '#555560' }}> · {period.focus}</span>}</Td>
                        <Td>
                          <span style={{ color: period.status === 'current' ? '#1A6FD4' : '#8A8A96' }}>
                            {STATUS_LABEL[period.status] ?? period.status}
                          </span>
                        </Td>
                        <Td>{period.start_date} → {period.end_date}</Td>
                        <Td>
                          <span style={{ color: INTENSITY_COLOR[period.intensity] ?? '#8A8A96' }}>
                            {period.intensity}
                          </span>
                        </Td>
                        <Td>{period.sessions}</Td>
                        <Td>{fmtHours(period.total_seconds)}</Td>
                        <Td>{Math.round(period.total_tss)}</Td>
                        <Td>{period.competitions}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {p.keyDates.length > 0 && (
              <div className="px-4 py-3" style={{ borderTop: '1px solid #1E1E22' }}>
                <p className="text-xs tracking-widest uppercase mb-2"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  Nøkkeldatoer ({p.keyDates.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {p.keyDates.slice(0, 12).map(k => (
                    <span key={k.id} className="px-2 py-1 text-xs"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
                        color: '#F0F0F2',
                      }}>
                      {k.event_date} · {KEY_LABEL[k.event_type] ?? k.event_type} · {k.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SeasonTable({ rows }: { rows: MultipleAthletesAnalysis['athletes'] }) {
  return (
    <div className="overflow-x-auto" style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}>
      <table className="w-full text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E22' }}>
            <Th>Utøver</Th>
            <Th>Sesong</Th>
            <Th>Perioder</Th>
            <Th>Økter (i periode)</Th>
            <Th>Tid (i periode)</Th>
            <Th>Nøkkeldatoer</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const name = r.athlete.fullName ?? r.athlete.id.slice(0, 6)
            const p = r.periodization
            if (!p?.hasData) {
              return (
                <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                  <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                  <td colSpan={5} className="py-2 px-3" style={{ color: '#555560', fontStyle: 'italic' }}>
                    {r.errors[0] ?? 'Ingen aktiv sesong'}
                  </td>
                </tr>
              )
            }
            return (
              <tr key={r.athlete.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                <Td><span style={{ color: colorFor(i) }}>● </span><span style={{ color: '#F0F0F2' }}>{name}</span></Td>
                <Td>{p.season?.name ?? '—'}</Td>
                <Td>{p.periods.length}</Td>
                <Td>{p.totals.sessions}</Td>
                <Td>{fmtHours(p.totals.total_seconds)}</Td>
                <Td>{p.totals.key_dates}</Td>
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
