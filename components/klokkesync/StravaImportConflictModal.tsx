'use client'

import { useState } from 'react'
import type { StravaConflictResolution } from '@/app/actions/strava-sync'

// Modal som vises når Strava-import treffer en planlagt-økt på samme dato.
// Brukeren velger mellom tre vanlige håndteringer; valget kan huskes som
// default for fremtidige imports i samme økt-flow.
//
// Komponenten er prop-drevet og uten side-effekter — kallere håndterer
// import-action selv basert på valgt resolution.

export type StravaConflictChoice = Extract<StravaConflictResolution, 'mark_planned_completed' | 'merge' | 'keep_both'>

export interface PlannedSummary {
  id: string
  title: string
  date: string
  duration_minutes: number | null
  distance_km: number | null
  sport: string
}

export interface StravaSummary {
  strava_id: number
  name: string
  sport_type: string
  duration_minutes: number
  distance_km: number
  start_date: string
}

interface Props {
  planned: PlannedSummary
  imported: StravaSummary
  onChoose: (choice: StravaConflictChoice, rememberForSession: boolean) => void
  onCancel: () => void
}

export function StravaImportConflictModal({ planned, imported, onChoose, onCancel }: Props) {
  // Default-valg per spec: A (mark_planned_completed) — planen ble fulgt,
  // klokken har bedre data, og brukeren ser begge separat i Dagbok.
  const [choice, setChoice] = useState<StravaConflictChoice>('mark_planned_completed')
  const [remember, setRemember] = useState(false)

  return (
    <div onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#0A0A0B', border: '1px solid #1E1E22',
          maxWidth: '560px', width: '100%', padding: '20px',
        }}>
        <h2 className="mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em' }}>
          Du har en planlagt økt denne dagen
        </h2>
        <p className="mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px' }}>
          Strava-importen kolliderer med en planlagt økt. Velg hvordan du vil håndtere det.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <PreviewCard label="Planlagt" accent="#1A6FD4" title={planned.title}
            sub={`${formatMin(planned.duration_minutes)} · ${formatKm(planned.distance_km)} · ${planned.sport}`} />
          <PreviewCard label="Importert (Strava)" accent="#FC4C02" title={imported.name}
            sub={`${formatMin(imported.duration_minutes)} · ${formatKm(imported.distance_km)} · ${imported.sport_type}`} />
        </div>

        <div className="space-y-2 mb-4">
          <ChoiceRow value="mark_planned_completed" current={choice} onSelect={setChoice}
            title="Marker planlagt som gjennomført + behold importert separat"
            description="Planlagt-økten merkes som ferdig (✓), importert havner som egen rad i Dagbok. Klokkedata bevares uten å overskrive planen." />
          <ChoiceRow value="merge" current={choice} onSelect={setChoice}
            title="Slå sammen: importert erstatter planlagt"
            description="Planlagt-raden oppdateres med Strava-data (samples, soner, snittpuls). Tittel og notater bevares." />
          <ChoiceRow value="keep_both" current={choice} onSelect={setChoice}
            title="Behold begge separat"
            description="Planlagt-økten forblir åpen (ikke fullført). Importert legges som ny rad. Brukes hvis økten ikke matcher planen." />
        </div>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px' }}>
            Bruk dette valget for resten av denne sync-runden (spør ikke per importert økt)
          </span>
        </label>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-xs tracking-widest uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96',
              background: 'none', border: '1px solid #1E1E22', cursor: 'pointer',
            }}>
            Avbryt
          </button>
          <button type="button" onClick={() => onChoose(choice, remember)}
            className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", color: '#FFFFFF',
              backgroundColor: '#FF4500', border: '1px solid #FF4500', cursor: 'pointer',
            }}>
            Importer
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewCard({ label, accent, title, sub }: { label: string; accent: string; title: string; sub: string }) {
  return (
    <div style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22', padding: '12px' }}>
      <p className="text-xs tracking-widest uppercase mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: accent }}>
        {label}
      </p>
      <p className="mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '15px', letterSpacing: '0.04em' }}>
        {title}
      </p>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px' }}>
        {sub}
      </p>
    </div>
  )
}

function ChoiceRow({
  value, current, onSelect, title, description,
}: {
  value: StravaConflictChoice
  current: StravaConflictChoice
  onSelect: (v: StravaConflictChoice) => void
  title: string
  description: string
}) {
  const active = current === value
  return (
    <button type="button" onClick={() => onSelect(value)}
      className="w-full text-left p-3 transition-colors"
      style={{
        backgroundColor: active ? 'rgba(255,69,0,0.08)' : '#13131A',
        border: `1px solid ${active ? '#FF4500' : '#1E1E22'}`,
        cursor: 'pointer',
      }}>
      <div className="flex items-start gap-2">
        <span style={{ color: active ? '#FF4500' : '#555560', fontSize: '14px', lineHeight: 1 }}>
          {active ? '●' : '○'}
        </span>
        <div className="flex-1">
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em' }}>
            {title}
          </p>
          <p className="mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '12px' }}>
            {description}
          </p>
        </div>
      </div>
    </button>
  )
}

function formatMin(min: number | null): string {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}t ${m}m` : `${m}m`
}
function formatKm(km: number | null): string {
  if (!km) return '—'
  return `${km.toFixed(1)} km`
}
