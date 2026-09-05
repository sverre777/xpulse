'use client'

// HJEM v2 bolk 8 — helse-kortets «Vis mer ↗»: 30 dager HRV / hvilepuls /
// søvn / vekt som grafer + tabell (lesing). Kilde daily_health via
// getHelseOversikt — dataene Hjem alt har hentet (bolk 0).

import type { HelseDag } from '@/app/actions/helse-oversikt'
import { KortPopup, PopupSeksjon } from './KortPopup'

const FONT = "'Barlow Condensed', sans-serif"
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const UKEDAG = ['sø', 'ma', 'ti', 'on', 'to', 'fr', 'lø']
function fmtDato(iso: string): string { const d = new Date(iso + 'T00:00:00'); return `${UKEDAG[d.getDay()]} ${d.getDate()}. ${MND[d.getMonth()]}` }
function fmtTimer(min: number): string { return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}` }

function Serie({ navn, farge, verdier, fmt, hoyde = 64 }: { navn: string; farge: string; verdier: Array<number | null>; fmt: (v: number) => string; hoyde?: number }) {
  const t = verdier.filter((v): v is number => v != null)
  if (t.length === 0) return null
  const lo = Math.min(...t), hi = Math.max(...t), sp = Math.max(1, hi - lo), snitt = t.reduce((a, b) => a + b, 0) / t.length
  const B = 320, PAD = 4
  const x = (i: number) => PAD + (i / Math.max(1, verdier.length - 1)) * (B - PAD * 2)
  const y = (v: number) => PAD + (1 - (v - lo) / sp) * (hoyde - PAD * 2)
  let d = ''; let inne = false
  verdier.forEach((v, i) => { if (v == null) { inne = false; return } d += `${inne ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; inne = true })
  const siste = [...verdier].reverse().find(v => v != null) ?? null
  return (
    <div data-helse-serie={navn}>
      <div className="flex items-baseline justify-between" style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)' }}>
        <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 10.5, color: farge }}>{navn}</span>
        <span>siste <b style={{ color: 'var(--tekst-1-app)' }}>{siste != null ? fmt(siste) : '—'}</b> · snitt {fmt(snitt)} · {fmt(lo)}–{fmt(hi)}</span>
      </div>
      <svg viewBox={`0 0 ${B} ${hoyde}`} width="100%" height={hoyde} preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden>
        <line x1={PAD} x2={B - PAD} y1={y(snitt)} y2={y(snitt)} stroke={farge} strokeDasharray="4 3" strokeWidth={1} opacity={0.5} />
        <path d={d.trim()} fill="none" stroke={farge} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

export function HelsePopup30({ dager, onClose }: { dager: HelseDag[]; onClose: () => void }) {
  const sortert = [...dager].sort((a, b) => a.date.localeCompare(b.date))
  const nyeste = [...sortert].reverse()
  return (
    <KortPopup kicker="Helse · 30 dager" tittel="HRV, hvilepuls, søvn og vekt" undertittel={`${sortert.length} dager med data`} videreHref="/app/helse" videreTekst="Åpne helsesiden" onClose={onClose} bred>
      <div data-helse-popup>
        <div className="xp-popup-to">
          <div className="flex flex-col gap-3">
            <Serie navn="HRV" farge="#1A6FD4" verdier={sortert.map(d => d.hrv_ms)} fmt={v => `${Math.round(v)} ms`} />
            <Serie navn="Hvilepuls" farge="#E23A5A" verdier={sortert.map(d => d.resting_hr)} fmt={v => `${Math.round(v)}`} />
          </div>
          <div className="flex flex-col gap-3">
            <Serie navn="Søvn" farge="#28A86E" verdier={sortert.map(d => d.total_sleep_minutes)} fmt={v => fmtTimer(v)} />
            <Serie navn="Vekt" farge="#E8B93C" verdier={sortert.map(d => d.body_weight_kg)} fmt={v => `${v.toFixed(1).replace('.', ',')} kg`} />
          </div>
        </div>
        <PopupSeksjon tittel="Dag for dag">
          <div style={{ overflowX: 'auto' }}>
            <table data-helse-tabell style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: 'var(--tekst-8-alt)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {['Dato', 'HRV', 'Hvilepuls', 'Søvn', 'Score', 'Vekt', 'Følelse'].map(h => <th key={h} style={{ textAlign: h === 'Dato' ? 'left' : 'right', padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {nyeste.map(d => (
                  <tr key={d.date} style={{ color: 'var(--tekst-1-app)' }}>
                    <td style={{ padding: '3px 6px', borderBottom: '1px solid var(--line)', color: 'var(--tekst-5-app)' }}>{fmtDato(d.date)}</td>
                    {[d.hrv_ms != null ? `${Math.round(d.hrv_ms)}` : '—', d.resting_hr != null ? `${d.resting_hr}` : '—', d.total_sleep_minutes != null ? fmtTimer(d.total_sleep_minutes) : '—', d.sleep_score != null ? `${d.sleep_score}` : '—', d.body_weight_kg != null ? d.body_weight_kg.toFixed(1).replace('.', ',') : '—', d.day_form != null ? `${d.day_form}/5` : '—'].map((v, i) => (
                      <td key={i} style={{ padding: '3px 6px', borderBottom: '1px solid var(--line)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PopupSeksjon>
      </div>
    </KortPopup>
  )
}
