'use client'

import type { AltitudeHeatAnalysis, AltitudePeriodStat } from '@/app/actions/analysis'

// Høyde & varme — egen analyse-flate med fokus på FORM rundt høyde-/varmeopphold.
// Nøytral overflate: vis data, ingen tolkning (tolkning kommer i AI Coach senere).
// Data hentes av AnalysisPage og sendes inn (null = laster).

function fmtPace(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}/km`
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function AltitudeHeatTab({ data }: { data: AltitudeHeatAnalysis | null }) {
  if (data === null) {
    return <p className="text-xs text-center py-8" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Laster høyde/varme-analyse…</p>
  }
  if (!data.hasData) {
    return (
      <div className="p-6 text-center" style={{ border: '1px dashed #1E1E22' }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', lineHeight: 1.6 }}>
          Ingen høyde- eller varmetrening registrert i perioden ennå.
          Marker økter som 🏔️ Høydetrening / 🌡️ Varmetrening, eller en årsplan-periode
          som høydeperiode, for å følge formen rundt oppholdene her.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Høyde-perioder med form under vs etter */}
      <Section title="Form rundt høydeopphold" hint="Snittpuls/pace UNDER perioden vs de 3 ukene ETTER (høyderespons). Lavere puls / raskere pace etter kan tyde på respons.">
        {data.altitudePeriods.length > 0 ? (
          <div className="space-y-3">
            {data.altitudePeriods.map(p => <PeriodCard key={p.id} p={p} />)}
          </div>
        ) : (
          <Empty>Ingen høyde-perioder i årsplanen for denne perioden. Enkelt-økter markert som høydetrening: {data.altitudeWorkoutCount}.</Empty>
        )}
      </Section>

      {/* Varmeøkter */}
      <Section title="Varmetrening" hint="Kroppstemperatur + snittpuls per varmeøkt — følg akklimatisering over tid.">
        {data.heatWorkouts.length > 0 ? (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Barlow Condensed', sans-serif", minWidth: 420 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E1E22' }}>
                  <Th left>Dato</Th><Th left>Økt</Th><Th>Kroppstemp</Th><Th>Snittpuls</Th>
                </tr>
              </thead>
              <tbody>
                {data.heatWorkouts.map(w => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #14141A' }}>
                    <Td left>{fmtDate(w.date)}</Td>
                    <Td left>{w.title}</Td>
                    <Td>{w.body_temperature != null ? `${w.body_temperature}°C` : '—'}</Td>
                    <Td>{w.avg_heart_rate != null ? `${w.avg_heart_rate} bpm` : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Ingen varmeøkter registrert i perioden.</Empty>
        )}
      </Section>
    </div>
  )
}

function PeriodCard({ p }: { p: AltitudePeriodStat }) {
  const hrDelta = p.during_avg_hr != null && p.after_avg_hr != null ? p.after_avg_hr - p.during_avg_hr : null
  return (
    <div style={{ background: '#0E0E12', border: '1px solid #1E1E22', borderLeft: '3px solid #5B8DEF', padding: '12px 14px' }}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: 17, letterSpacing: '0.04em' }}>🏔️ {p.name}</span>
        {p.altitude_meters != null && (
          <span className="px-2 py-0.5 text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#5B8DEF', border: '1px solid #2A3A55' }}>{p.altitude_meters} moh</span>
        )}
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: 12 }}>
          {fmtDate(p.start_date)} → {fmtDate(p.end_date)} · {p.days} dager
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <Block label={`Under (${p.during_count} økt${p.during_count === 1 ? '' : 'er'})`} hr={p.during_avg_hr} pace={p.during_avg_pace} />
        <Block label={`Etter, 3 uker (${p.after_count} økt${p.after_count === 1 ? '' : 'er'})`} hr={p.after_avg_hr} pace={p.after_avg_pace} />
      </div>
      {hrDelta != null && (
        <p className="mt-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: 12 }}>
          Snittpuls etter vs under: {hrDelta > 0 ? '+' : ''}{hrDelta} bpm
        </p>
      )}
    </div>
  )
}

function Block({ label, hr, pace }: { label: string; hr: number | null; pace: number | null }) {
  return (
    <div style={{ background: '#13131A', border: '1px solid #1E1E22', padding: '8px 10px' }}>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: 14, margin: 0 }}>
        {hr != null ? `${hr} bpm` : '—'} · {fmtPace(pace)}
      </p>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#13131A', border: '1px solid #1E1E22', padding: '16px 18px' }}>
      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: 18, letterSpacing: '0.04em', margin: 0 }}>{title}</h3>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: 12, margin: '2px 0 12px', lineHeight: 1.5 }}>{hint}</p>
      {children}
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: 13 }}>{children}</p>
}
function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <th style={{ textAlign: left ? 'left' : 'center', padding: '8px 10px', color: 'rgba(242,240,236,0.7)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{children}</th>
}
function Td({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <td style={{ textAlign: left ? 'left' : 'center', padding: '8px 10px', color: left ? '#F0F0F2' : '#C0C0CC', fontSize: 13 }}>{children}</td>
}
