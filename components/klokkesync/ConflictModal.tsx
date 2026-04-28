'use client'

import type { ConflictResolution } from '@/app/actions/strava-sync'

// Konflikt-modal — vises når en import-aktivitet kolliderer med en
// eksisterende workout (samme dato innenfor ±30 min). Bruker velger en
// av fire strategier; klienten kaller server-action med valget.

interface Props {
  title: string
  existingWorkoutId: string
  newSourceLabel: string
  onResolve: (r: ConflictResolution) => void
  onCancel: () => void
}

export function ConflictModal({ title, newSourceLabel, onResolve, onCancel }: Props) {
  return (
    <div role="dialog" aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full"
        style={{
          maxWidth: 480, background: '#0F0F16',
          border: '1px solid #1E1E22', borderTop: '2px solid #F5C542',
        }}>
        <div className="p-5">
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase',
            color: '#F5C542', marginBottom: 8,
          }}>
            Konflikt funnet
          </div>
          <h3 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
            letterSpacing: '0.06em', color: '#F0F0F2', marginBottom: 12,
          }}>
            {title}
          </h3>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
            color: 'rgba(242,240,236,0.7)', lineHeight: 1.7, marginBottom: 16,
          }}>
            En eksisterende økt overlapper med {newSourceLabel.toLowerCase()}.
            Hvordan vil du håndtere det?
          </p>

          <div className="flex flex-col gap-2">
            <ResolveButton color="#FF4500" label="Slå sammen"
              desc="Strava/.fit-data legges til den eksisterende økten — samples, splits og puls-aggregater. Tittel og notater beholdes."
              onClick={() => onResolve('merge')} />
            <ResolveButton color="#E11D48" label="Erstatt"
              desc="Slett den eksisterende, opprett ny fra import-data."
              onClick={() => onResolve('replace')} />
            <ResolveButton color="#1A6FD4" label="Behold begge"
              desc="Lager en ny økt ved siden av den gamle."
              onClick={() => onResolve('keep_both')} />
            <ResolveButton color="#8A8A96" label="Hopp over"
              desc="Ignorer denne import-aktiviteten. Ikke vist igjen."
              onClick={() => onResolve('skip')} />
          </div>

          <button type="button" onClick={onCancel}
            style={{
              marginTop: 12, padding: '8px 0', width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#555560', fontSize: 12,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}

function ResolveButton({
  color, label, desc, onClick,
}: {
  color: string
  label: string
  desc: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '12px 14px', background: '#1A1A22',
        border: `1px solid #1E1E22`, borderLeft: `3px solid ${color}`,
        cursor: 'pointer',
      }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
        fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase',
        color, marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
        color: 'rgba(242,240,236,0.7)', lineHeight: 1.5,
      }}>
        {desc}
      </div>
    </button>
  )
}
