'use client'

import {
  WEATHER_TYPES, WIND_STRENGTHS, SURFACE_SUMMER, SURFACE_WINTER, WEATHER_LABELS,
  type WeatherData,
} from '@/lib/types'

// Form-seksjon for vær og føre per økt (manuell innføring, Nivå 1). Kontrollert
// av forelderen (value + onChange), lagres sammen med økten. Føre er multi-
// select (snøen kan være flere ting samtidig). Samme stil som ernæring-seksjonen.

const iSt: React.CSSProperties = {
  backgroundColor: '#1A1A22', border: '1px solid #1E1E22', color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
  padding: '6px 10px', outline: 'none', width: '100%', boxSizing: 'border-box', minWidth: 0,
}

// Kompakt visnings-linje fra satt vær/føre, f.eks. "🌡️ -4°C · Snø · Nysnø + Hardpakket · Lett bris".
export function weatherSummaryLine(w: WeatherData | undefined | null): string | null {
  if (!w) return null
  const parts: string[] = []
  if (w.temperature.trim() !== '') parts.push(`🌡️ ${w.temperature}°C`)
  if (w.weather_type) parts.push(WEATHER_LABELS[w.weather_type] ?? w.weather_type)
  if (w.surface_conditions.length > 0) {
    parts.push(w.surface_conditions.map(s => WEATHER_LABELS[s] ?? s).join(' + '))
  }
  if (w.wind_strength) parts.push(WEATHER_LABELS[w.wind_strength] ?? w.wind_strength)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function WeatherSection({ value, onChange, readOnly = false }: {
  value: WeatherData
  onChange: (next: WeatherData) => void
  readOnly?: boolean
}) {
  const set = (patch: Partial<WeatherData>) => onChange({ ...value, ...patch })
  const toggleSurface = (v: string) => {
    const has = value.surface_conditions.includes(v)
    set({ surface_conditions: has ? value.surface_conditions.filter(x => x !== v) : [...value.surface_conditions, v] })
  }
  const summary = weatherSummaryLine(value)
  // Hvilke føre-grupper vises — styrt av sesong-toggle; ingen valgt → begge.
  const showSummer = value.season_context === '' || value.season_context === 'sommer'
  const showWinter = value.season_context === '' || value.season_context === 'vinter'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span style={{ width: 16, height: 2, background: '#FF4500' }} />
        <h3 className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Vær og føre
        </h3>
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: summary ? '#C0C0CC' : '#555560' }}>
          {summary ?? '— ikke satt'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Temperatur (°C)">
          <input type="number" inputMode="decimal" step="0.1" value={value.temperature}
            onChange={e => set({ temperature: e.target.value })} disabled={readOnly}
            placeholder="—" style={iSt} />
        </Field>
        <Field label="Værtype">
          <select value={value.weather_type} onChange={e => set({ weather_type: e.target.value })}
            disabled={readOnly} style={iSt}>
            <option value="">—</option>
            {WEATHER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Vind">
          <select value={value.wind_strength} onChange={e => set({ wind_strength: e.target.value })}
            disabled={readOnly} style={iSt}>
            <option value="">—</option>
            {WIND_STRENGTHS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>

      {/* Føre — sesong-toggle + multi-select chips (flere kan være aktive) */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Label>Føre (flere mulig)</Label>
          <div className="flex gap-1">
            {([['', 'Begge'], ['sommer', 'Sommer'], ['vinter', 'Vinter']] as const).map(([val, lab]) => {
              const active = value.season_context === val
              return (
                <button key={val} type="button" disabled={readOnly}
                  onClick={() => set({ season_context: val })}
                  className="px-2 py-0.5 text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: active ? '#F0F0F2' : '#555560',
                    background: active ? '#2A2A30' : 'transparent',
                    border: '1px solid #222228', cursor: readOnly ? 'default' : 'pointer',
                  }}>
                  {lab}
                </button>
              )
            })}
          </div>
        </div>
        {showSummer && (
          <SurfaceGroup label="Barmark" options={SURFACE_SUMMER}
            selected={value.surface_conditions} onToggle={toggleSurface} readOnly={readOnly} />
        )}
        {showWinter && (
          <SurfaceGroup label="Snø" options={SURFACE_WINTER}
            selected={value.surface_conditions} onToggle={toggleSurface} readOnly={readOnly} />
        )}
      </div>

      <Field label="Notat om forhold (valgfritt)">
        <textarea value={value.notes} onChange={e => set({ notes: e.target.value })} disabled={readOnly}
          rows={2} style={{ ...iSt, resize: 'vertical' }}
          placeholder="F.eks. våt asfalt, kald motvind siste runde…" />
      </Field>
    </div>
  )
}

function SurfaceGroup({ label, options, selected, onToggle, readOnly }: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (v: string) => void
  readOnly: boolean
}) {
  return (
    <div className="mb-2">
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {options.map(o => {
          const active = selected.includes(o.value)
          return (
            <button key={o.value} type="button" disabled={readOnly} onClick={() => onToggle(o.value)}
              className="px-3 py-1.5 text-sm uppercase transition-colors"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: active ? '#FF4500' : 'transparent',
                color: active ? '#F0F0F2' : '#555560',
                border: `1px solid ${active ? '#FF4500' : '#222228'}`,
                cursor: readOnly ? 'default' : 'pointer',
              }}>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ minWidth: 0 }}><Label>{label}</Label>{children}</div>
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1 text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
      {children}
    </label>
  )
}
