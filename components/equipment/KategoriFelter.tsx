'use client'

// Kategorispesifikke felter for utstyr-skjemaet (fasit: designfilens seksjon 1).
// Brukes både av «Nytt utstyr»-modalen og detaljsidens redigering — én kilde.
// Ski-feltene (visSki) gjelder kun ny-skjemaet; detaljsiden redigerer ski via
// SkiDataSection som skriver til equipment_ski_data.

import {
  SKI_TYPES,
  SKI_TYPE_LABELS,
  SKI_USAGE_TYPES,
  SKI_USAGE_LABELS,
  LOPESKO_USAGE_TYPES,
  LOPESKO_USAGE_LABELS,
  STAV_USAGE_TYPES,
  STAV_USAGE_LABELS,
  RULLESKI_TYPES,
  RULLESKI_TYPE_LABELS,
  RULLESKI_WHEEL_TYPES,
  RULLESKI_RESISTANCES,
  SKISKO_TYPES,
  SKISKO_TYPE_LABELS,
  SYKKEL_TYPES,
  CLEAT_SYSTEMS,
  type Equipment,
  type EquipmentCategory,
  type SkiType,
  type SkiUsageType,
} from '@/lib/equipment-types'

const ATHLETE_ORANGE = '#FF4500'

export interface KategoriFelterVerdier {
  size: string
  usage_type: string
  length_cm: string
  subtype: string
  wheel_type: string
  resistance: string
  resistance_front: string
  resistance_rear: string
  splitResistance: boolean
  cleat_system: string
  drivetrain: string
  wheelset: string
  // Ski — lagres i equipment_ski_data, ikke på equipment-raden.
  ski_length_cm: string
  ski_type: '' | SkiType
  ski_usage: '' | SkiUsageType
  ski_slip: string
  ski_slip_date: string
}

export function tomKategoriVerdier(): KategoriFelterVerdier {
  return {
    size: '', usage_type: '', length_cm: '', subtype: '', wheel_type: '',
    resistance: '', resistance_front: '', resistance_rear: '', splitResistance: false,
    cleat_system: '', drivetrain: '', wheelset: '',
    ski_length_cm: '', ski_type: '', ski_usage: '', ski_slip: '', ski_slip_date: '',
  }
}

export function kategoriVerdierFraEquipment(e: Equipment): KategoriFelterVerdier {
  return {
    ...tomKategoriVerdier(),
    size: e.size ?? '',
    usage_type: e.usage_type ?? '',
    length_cm: e.length_cm != null ? String(e.length_cm) : '',
    subtype: e.subtype ?? '',
    wheel_type: e.wheel_type ?? '',
    resistance: e.resistance ?? '',
    resistance_front: e.resistance_front ?? '',
    resistance_rear: e.resistance_rear ?? '',
    splitResistance: !!(e.resistance_front || e.resistance_rear),
    cleat_system: e.cleat_system ?? '',
    drivetrain: e.drivetrain ?? '',
    wheelset: e.wheelset ?? '',
  }
}

interface Props {
  category: EquipmentCategory
  verdier: KategoriFelterVerdier
  onChange: (patch: Partial<KategoriFelterVerdier>) => void
  visSki?: boolean
}

export function KategoriFelter({ category, verdier: v, onChange: set, visSki = false }: Props) {
  return (
    <>
      {category === 'ski' && visSki && (
        <DetailSection title="Ski-detaljer">
          <Field label="Lengde (cm)">
            <input type="text" inputMode="decimal" value={v.ski_length_cm}
              onChange={e => set({ ski_length_cm: e.target.value })}
              placeholder="192" className="w-full px-4 py-3" style={inputStyle} />
          </Field>
          <Field label="Type">
            <div className="flex flex-wrap gap-2">
              {SKI_TYPES.map(t => (
                <FormChip key={t} active={v.ski_type === t} onClick={() => set({ ski_type: v.ski_type === t ? '' : t })}>
                  {SKI_TYPE_LABELS[t]}
                </FormChip>
              ))}
            </div>
          </Field>
          <Field label="Bruk">
            <div className="flex flex-wrap gap-2">
              {SKI_USAGE_TYPES.map(u => (
                <FormChip key={u} active={v.ski_usage === u} onClick={() => set({ ski_usage: v.ski_usage === u ? '' : u })}>
                  {SKI_USAGE_LABELS[u]}
                </FormChip>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nåværende slip">
              <input value={v.ski_slip} onChange={e => set({ ski_slip: e.target.value })}
                placeholder="F.eks. S1-7 kald" className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <Field label="Årstall/dato">
              <input value={v.ski_slip_date} onChange={e => set({ ski_slip_date: e.target.value })}
                placeholder="2026" className="w-full px-4 py-3" style={inputStyle} />
            </Field>
          </div>
          <p className="text-xs" style={{ color: 'var(--tekst-5-app)' }}>
            Ny slip legges senere <b style={{ color: 'var(--tekst-1-app)' }}>oppå</b> — historikken beholdes.
          </p>
          <p className="text-xs px-3 py-2" style={{ color: 'var(--tekst-1-app)', border: '1px solid rgba(40,168,110,0.4)', backgroundColor: 'rgba(40,168,110,0.07)', borderRadius: 8 }}>
            ✓ Skia legges automatisk i skiparken når du lagrer — med type, bruk og slip som filtre der.
          </p>
        </DetailSection>
      )}

      {category === 'rulleski' && (
        <DetailSection title="Rulleski-detaljer" aux="Egen kategori — rulleski har ikke slip">
          <Field label="Type">
            <div className="flex flex-wrap gap-2">
              {RULLESKI_TYPES.map(t => (
                <FormChip key={t} active={v.subtype === t} onClick={() => set({ subtype: v.subtype === t ? '' : t })}>
                  {RULLESKI_TYPE_LABELS[t]}
                </FormChip>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hjultype">
              <select value={v.wheel_type} onChange={e => set({ wheel_type: e.target.value })}
                className="w-full px-4 py-3" style={inputStyle}>
                <option value="">—</option>
                {RULLESKI_WHEEL_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </Field>
            {!v.splitResistance && (
              <Field label="Rullemotstand">
                <select value={v.resistance} onChange={e => set({ resistance: e.target.value })}
                  className="w-full px-4 py-3" style={inputStyle}>
                  <option value="">—</option>
                  {RULLESKI_RESISTANCES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--tekst-5-app)' }}>
            <input type="checkbox" checked={v.splitResistance}
              onChange={e => set({ splitResistance: e.target.checked })} />
            Ulik motstand foran/bak
          </label>
          {v.splitResistance && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Motstand foran">
                <select value={v.resistance_front} onChange={e => set({ resistance_front: e.target.value })}
                  className="w-full px-4 py-3" style={inputStyle}>
                  <option value="">—</option>
                  {RULLESKI_RESISTANCES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Motstand bak">
                <select value={v.resistance_rear} onChange={e => set({ resistance_rear: e.target.value })}
                  className="w-full px-4 py-3" style={inputStyle}>
                  <option value="">—</option>
                  {RULLESKI_RESISTANCES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
          )}
        </DetailSection>
      )}

      {category === 'skisko' && (
        <DetailSection title="Skisko-detaljer">
          <Field label="Størrelse">
            <input value={v.size} onChange={e => set({ size: e.target.value })}
              placeholder="43,5" className="w-full px-4 py-3" style={inputStyle} />
          </Field>
          <Field label="Type">
            <div className="flex flex-wrap gap-2">
              {SKISKO_TYPES.map(t => (
                <FormChip key={t} active={v.subtype === t} onClick={() => set({ subtype: v.subtype === t ? '' : t })}>
                  {SKISKO_TYPE_LABELS[t]}
                </FormChip>
              ))}
            </div>
          </Field>
        </DetailSection>
      )}

      {category === 'lopesko' && (
        <DetailSection title="Løpesko-detaljer">
          <Field label="Størrelse">
            <input value={v.size} onChange={e => set({ size: e.target.value })}
              placeholder="43" className="w-full px-4 py-3" style={inputStyle} />
          </Field>
          <Field label="Bruk">
            <div className="flex flex-wrap gap-2">
              {LOPESKO_USAGE_TYPES.map(u => (
                <FormChip key={u} active={v.usage_type === u} onClick={() => set({ usage_type: v.usage_type === u ? '' : u })}>
                  {LOPESKO_USAGE_LABELS[u]}
                </FormChip>
              ))}
            </div>
          </Field>
        </DetailSection>
      )}

      {category === 'skistaver' && (
        <DetailSection title="Stav-detaljer">
          <Field label="Lengde (cm)">
            <input type="text" inputMode="decimal" value={v.length_cm}
              onChange={e => set({ length_cm: e.target.value })}
              placeholder="160" className="w-full px-4 py-3" style={inputStyle} />
          </Field>
          <Field label="Bruk">
            <div className="flex flex-wrap gap-2">
              {STAV_USAGE_TYPES.map(u => (
                <FormChip key={u} active={v.usage_type === u} onClick={() => set({ usage_type: v.usage_type === u ? '' : u })}>
                  {STAV_USAGE_LABELS[u]}
                </FormChip>
              ))}
            </div>
          </Field>
        </DetailSection>
      )}

      {category === 'sykkel' && (
        <DetailSection title="Sykkel-detaljer">
          <Field label="Type">
            <select value={v.subtype} onChange={e => set({ subtype: e.target.value })}
              className="w-full px-4 py-3" style={inputStyle}>
              <option value="">—</option>
              {SYKKEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Drivverk / gir">
              <input value={v.drivetrain} onChange={e => set({ drivetrain: e.target.value })}
                placeholder="F.eks. Ultegra Di2" className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <Field label="Hjulsett">
              <input value={v.wheelset} onChange={e => set({ wheelset: e.target.value })}
                className="w-full px-4 py-3" style={inputStyle} />
            </Field>
          </div>
        </DetailSection>
      )}

      {category === 'sykkelsko' && (
        <DetailSection title="Sykkelsko-detaljer">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Størrelse">
              <input value={v.size} onChange={e => set({ size: e.target.value })}
                placeholder="43" className="w-full px-4 py-3" style={inputStyle} />
            </Field>
            <Field label="Festesystem">
              <select value={v.cleat_system} onChange={e => set({ cleat_system: e.target.value })}
                className="w-full px-4 py-3" style={inputStyle}>
                <option value="">—</option>
                {CLEAT_SYSTEMS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </DetailSection>
      )}

      {(category === 'klokke' || category === 'annet') && (
        <p className="text-xs" style={{ color: 'var(--tekst-8-app)' }}>
          Klokke og annet utstyr bruker kun basen over.
        </p>
      )}
    </>
  )
}

// Chip i skjemaet — samme visuelle språk som filter-chipsene, men for valg av verdi.
export function FormChip({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick}
      className="px-4 py-2 text-xs font-semibold tracking-widest uppercase transition-colors"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        borderRadius: 999,
        border: `1px solid ${active ? ATHLETE_ORANGE : 'var(--line2)'}`,
        color: active ? 'var(--tekst-1-app)' : 'var(--tekst-5-app)',
        backgroundColor: active ? 'rgba(255,69,0,0.10)' : 'transparent',
        cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

// Kategorispesifikk seksjon under basen — «<Kategori>-detaljer» med skillelinje.
function DetailSection({ title, aux, children }: {
  title: string
  aux?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--kant-3)', paddingTop: 14 }}>
        <span className="text-xs font-semibold tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          {title}
        </span>
        {aux && (
          <span className="text-xs" style={{ color: 'var(--tekst-8-app)' }}>· {aux}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: 'var(--tekst-1-app)',
  backgroundColor: 'var(--flate-8-alt)',
  border: '1px solid var(--kant-3)',
  fontSize: '15px',
}
