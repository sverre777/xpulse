'use client'

// «+ Ny test-mal» fra konkurranse-panelet — KOMPAKT popup, ikke hele
// øktmal-byggeren (Sverre 21. aug: den flyten ga ikke mening).
//
//   · Skiskyting: navn + serieoppsett (posisjon × antall serier) + underlag
//     → lagres i skytetest-biblioteket (saveMyShootingTest) og kan velges
//     og genereres med én gang.
//   · Andre idretter: navn + bevegelsesform (MINIMAL test-mal, #52-regelen:
//     «O₂-test» trenger ikke mer struktur) → øktmal m/ test-flagg.
//
// Rendres via portal (WorkoutForm er et <form>).

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MOVEMENT_CATEGORIES, DEFAULT_MOVEMENTS_BY_SPORT, makeActivity, type Sport } from '@/lib/types'
import { saveMyShootingTest } from '@/app/actions/shooting-tests'
import { saveAsTemplate } from '@/app/actions/templates'

const FONT = "'Barlow Condensed', sans-serif"
const GULL = '#E8B93C'
const FELT: React.CSSProperties = {
  backgroundColor: '#101014', border: '1px solid var(--line2)', borderRadius: 9,
  color: '#F0F0F2', fontFamily: FONT, fontSize: 15, padding: '10px 12px',
  outline: 'none', width: '100%', minHeight: 44,
}
const LBL: React.CSSProperties = {
  display: 'block', fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#55555F', marginBottom: 6,
}

interface SerieRad { position: 'L' | 'S'; antall: string }

export function NyTestMalPopup({ sport, onLagret, onLukk }: {
  sport: Sport
  // Skiskyting: (ref, navn) på den nye skytetesten — så den kan velges rett
  // inn. Andre idretter: template-id.
  onLagret: (info: { skytetestRef?: string; templateId?: string; navn: string }) => void
  onLukk: () => void
}) {
  const erSkiskyting = sport === 'biathlon'
  const [navn, setNavn] = useState('')
  const [bev, setBev] = useState(() => DEFAULT_MOVEMENTS_BY_SPORT[sport]?.[0] ?? 'Løping')
  const [serier, setSerier] = useState<SerieRad[]>([{ position: 'L', antall: '2' }, { position: 'S', antall: '2' }])
  const [underlag, setUnderlag] = useState<'papp' | 'metall' | 'issf' | ''>('')
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)

  const lagre = async () => {
    if (!navn.trim()) { setFeil('Navn er påkrevd'); return }
    setLagrer(true); setFeil(null)
    if (erSkiskyting) {
      // Rader ekspanderes: {L × 2, S × 2} → L, L, S, S — 5 skudd per serie.
      const flat = serier.flatMap(r =>
        Array.from({ length: Math.max(1, parseInt(r.antall) || 1) }, () => ({ position: r.position, shots: 5 })))
      const res = await saveMyShootingTest(navn.trim(), {
        surface: underlag, scoring: 'treff', series: flat,
      })
      setLagrer(false)
      if (res.error) { setFeil(res.error); return }
      onLagret({ skytetestRef: res.id, navn: navn.trim() })
    } else {
      // MINIMAL test-mal: tittel + bevegelsesform. Strukturen kan bygges ut
      // senere i mal-biblioteket — testen trenger ikke mer for å finnes.
      const res = await saveAsTemplate({
        name: navn.trim(),
        sport,
        activities: [makeActivity({ activity_type: 'aktivitet', movement_name: bev })],
        templateData: { sport, movements: [], notes: '', tags: [], strength_type: '', location: '' },
        isTest: true,
        oktType: 'test',
      })
      setLagrer(false)
      if (res.error) { setFeil(res.error); return }
      onLagret({ templateId: res.id, navn: navn.trim() })
    }
  }

  const innhold = (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={onLukk}>
      <div className="w-full max-w-md p-5 mt-10" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card, #15151B)', border: '1px solid var(--line2)', borderLeft: `4px solid ${GULL}`, borderRadius: 14 }}>
        <p className="text-xs tracking-widest uppercase mb-3" style={{ fontFamily: FONT, color: GULL, fontWeight: 800 }}>
          🧪 Ny test-mal {erSkiskyting ? '— skytetest' : ''}
        </p>

        <label style={LBL}>Navn</label>
        <input value={navn} onChange={e => setNavn(e.target.value)} autoFocus
          placeholder={erSkiskyting ? 'F.eks. Hurtighet ligg 5×5' : 'F.eks. O₂-test'}
          style={FELT} />

        {erSkiskyting ? (
          <>
            <label style={{ ...LBL, marginTop: 14 }}>Serieoppsett — 5 skudd per serie</label>
            {serier.map((r, i) => (
              <div key={i} className="flex items-center gap-2 mt-1.5">
                <select value={r.position}
                  onChange={e => setSerier(ss => ss.map((x, xi) => xi === i ? { ...x, position: e.target.value as 'L' | 'S' } : x))}
                  style={{ ...FELT, width: 130 }}>
                  <option value="L">Liggende</option>
                  <option value="S">Stående</option>
                </select>
                <span style={{ color: '#55555F' }}>×</span>
                <input value={r.antall} inputMode="numeric"
                  onChange={e => setSerier(ss => ss.map((x, xi) => xi === i ? { ...x, antall: e.target.value } : x))}
                  style={{ ...FELT, width: 70, textAlign: 'center' }} />
                <span style={{ fontFamily: FONT, fontSize: 13, color: '#8B8B95' }}>serier</span>
                {serier.length > 1 && (
                  <button type="button" onClick={() => setSerier(ss => ss.filter((_, xi) => xi !== i))}
                    aria-label="Fjern"
                    style={{ marginLeft: 'auto', color: '#55555F', background: 'none', border: '1px solid var(--line2)', borderRadius: 8, width: 34, height: 34, cursor: 'pointer' }}>×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setSerier(ss => [...ss, { position: 'L', antall: '1' }])}
              className="w-full mt-2"
              style={{ fontFamily: FONT, fontSize: 13.5, color: '#8B8B95', background: 'none', border: '1.3px dashed var(--line2)', borderRadius: 9, padding: 9, cursor: 'pointer' }}>
              + Legg til rad
            </button>
            <label style={{ ...LBL, marginTop: 14 }}>Underlag (valgfritt)</label>
            <select value={underlag} onChange={e => setUnderlag(e.target.value as typeof underlag)} style={FELT}>
              <option value="">—</option>
              <option value="papp">Papp</option>
              <option value="metall">Metall</option>
              <option value="issf">ISSF</option>
            </select>
          </>
        ) : (
          <>
            <label style={{ ...LBL, marginTop: 14 }}>Bevegelsesform</label>
            <select value={bev} onChange={e => setBev(e.target.value)} style={FELT}>
              {[...(DEFAULT_MOVEMENTS_BY_SPORT[sport] ?? []),
                ...MOVEMENT_CATEGORIES.map(c => c.name).filter(n => !(DEFAULT_MOVEMENTS_BY_SPORT[sport] ?? []).includes(n)),
              ].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="mt-2" style={{ fontFamily: FONT, fontSize: 12.5, color: '#55555F' }}>
              Minimal test-mal — struktur (drag, øvelser) kan bygges ut senere i mal-biblioteket.
            </p>
          </>
        )}

        {feil && <p className="mt-2" style={{ fontFamily: FONT, fontSize: 13, color: '#FF4500' }}>{feil}</p>}

        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onLukk}
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT, color: '#8A8A96', background: 'none', border: '1px solid var(--line2)', borderRadius: 999, padding: '10px 18px', cursor: 'pointer' }}>
            Avbryt
          </button>
          <button type="button" onClick={() => { void lagre() }} disabled={lagrer}
            className="flex-1 text-xs tracking-widest uppercase"
            style={{ fontFamily: FONT, fontWeight: 700, color: '#101014', background: GULL, border: 'none', borderRadius: 999, padding: '10px 18px', cursor: 'pointer' }}>
            {lagrer ? 'Lagrer…' : 'Lagre i biblioteket'}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(innhold, document.body) : null
}
