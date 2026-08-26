'use client'

// Kø #49 bolk 2 — vimpel-velgeren: «Vind & sikt — Serie N»-popup.
// Design-ref: design/xpulse-vind-design.html (vinner ved sprik).
// 11 tilstander: V5..V1 · vindstille · H1..H5. Vimpel = skiskyting-rød
// #E23A5A på svart/grå stang (IBU-tro). Sikt-chips nøytrale m/ blå
// valgt-markering. Vind er informasjon — aldri alarmfarger.
// Forrige series verdi FORESLÅS (forhåndsvalgt) — aldri auto-lagret:
// verdien skrives først når brukeren trykker Lagre.

import { useEffect, useRef, useState } from 'react'
import {
  SIGHT_LEVELS, windText, type SightKey, type WindDirection,
} from '@/lib/shooting'

export interface WindSightValue {
  vind_retning: WindDirection | null
  vind_styrke: number | null
  sikt: SightKey | null
}

// Vimpel-SVG fra design-utkastet: dir 'V'|'H'|null, styrke 0–5.
// 0 = smal drapert duk rett ned; 1–4 = duk rotert 15/35/55/75°;
// 5 = horisontal bølgete duk m/ blafre-streker. Venstre speiles.
const FLAG_ANGLES: Record<number, number> = { 1: 15, 2: 35, 3: 55, 4: 75 }

export function VimpelIcon({ retning, styrke, size = 56 }: {
  retning: WindDirection | null
  styrke: number
  size?: number
}) {
  let flag: React.ReactNode
  if (styrke <= 0) {
    flag = <path d="M30,14 C33,22 29,34 32,48 L37,47 C39,33 36,22 37,14 Z" fill="#E23A5A" />
  } else if (styrke >= 5) {
    flag = (
      <>
        <path d="M32,10 c8,-3 13,3 21,0 c8,-3 13,3 21,0 l0,13 c-8,3 -13,-3 -21,0 c-8,3 -13,-3 -21,0 Z" fill="#E23A5A" />
        <path d="M78,9 c4,-2 7,1 10,0 M78,26 c4,2 7,-1 10,0" stroke="#E23A5A" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.55} />
      </>
    )
  } else {
    flag = (
      <g transform={`rotate(${-FLAG_ANGLES[styrke]} 32 14)`}>
        <rect x={26} y={14} width={13} height={40} rx={1.5} fill="#E23A5A" />
      </g>
    )
  }
  const inner = (
    <>
      <line x1={32} y1={12} x2={32} y2={84} stroke="var(--tekst-8-alt)" strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={32} cy={10} r={3.5} fill="var(--mut)" />
      {flag}
    </>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 92 92" aria-hidden>
      {retning === 'V' ? <g transform="translate(92 0) scale(-1 1)">{inner}</g> : inner}
    </svg>
  )
}

// Sikt-ikon: god = grønn ring; tåke-nivåene = 1–3 bølgestreker.
export function FogIcon({ fog }: { fog: number }) {
  if (fog === 0) {
    return (
      <svg width={18} height={14} viewBox="0 0 18 14" aria-hidden>
        <circle cx={9} cy={7} r={5} fill="none" stroke="#28A86E" strokeWidth={2} />
      </svg>
    )
  }
  return (
    <svg width={18} height={14} viewBox="0 0 18 14" aria-hidden>
      {Array.from({ length: fog }, (_, i) => (
        <path key={i} d={`M2,${3 + i * 4} c3,-2 6,2 9,0 c2,-1 4,1 5,0`}
          stroke="var(--mut)" strokeWidth={1.8} fill="none" strokeLinecap="round"
          opacity={0.5 + 0.17 * i} />
      ))}
    </svg>
  )
}

// Skala-rekkefølgen fra utkastet: V5..V1 · 0 · H1..H5.
const STATES: { d: WindDirection | null; l: number }[] = [
  { d: 'V', l: 5 }, { d: 'V', l: 4 }, { d: 'V', l: 3 }, { d: 'V', l: 2 }, { d: 'V', l: 1 },
  { d: null, l: 0 },
  { d: 'H', l: 1 }, { d: 'H', l: 2 }, { d: 'H', l: 3 }, { d: 'H', l: 4 }, { d: 'H', l: 5 },
]

function stateIndex(retning: WindDirection | null, styrke: number | null): number | null {
  if (styrke == null) return null
  if (styrke <= 0) return 5
  const lvl = Math.min(styrke, 5)
  return retning === 'V' ? 5 - lvl : 5 + lvl
}

export function WindSightModal({ serieNo, position, value, suggestion, onSave, onClose }: {
  serieNo: number
  position: 'L' | 'S'
  value: WindSightValue
  // Forrige series verdi (forhåndsvelges som FORSLAG når serien selv er tom).
  suggestion: WindSightValue | null
  onSave: (v: WindSightValue) => void
  onClose: () => void
}) {
  const hasOwn = value.vind_styrke != null || value.sikt != null
  const initial = hasOwn ? value : (suggestion ?? value)
  const [selIdx, setSelIdx] = useState<number | null>(stateIndex(initial.vind_retning, initial.vind_styrke))
  const [sikt, setSikt] = useState<SightKey | null>(initial.sikt)
  const isSuggestion = !hasOwn && suggestion != null
  const scaleRef = useRef<HTMLDivElement>(null)

  // Valgt tilstand scrolles synlig ved åpning (mobil: skalaen er én
  // scrollbar rad m/ snap).
  useEffect(() => {
    const el = scaleRef.current
    if (!el) return
    const idx = selIdx ?? 5
    const btn = el.children[idx] as HTMLElement | undefined
    if (btn) el.scrollLeft = btn.offsetLeft - (el.clientWidth - btn.clientWidth) / 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sel = selIdx != null ? STATES[selIdx] : null
  const valText = sel ? windText(sel.d, sel.l) : null

  const save = () => {
    onSave({
      vind_retning: sel && sel.l > 0 ? sel.d : null,
      vind_styrke: sel ? sel.l : null,
      sikt,
    })
  }
  const clear = () => onSave({ vind_retning: null, vind_styrke: null, sikt: null })

  const capStyle: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.16em',
    textTransform: 'uppercase', color: 'var(--tekst-8-alt)',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 70, backgroundColor: 'var(--scrim-75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
      }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640, maxHeight: '92dvh', overflowY: 'auto',
          background: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 16,
          boxShadow: '0 24px 70px rgba(0,0,0,.55)',
        }}>
        {/* Header */}
        <div className="flex items-center gap-2.5" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <span aria-hidden style={{ color: '#E23A5A', fontSize: 16 }}>⚑</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.1em', color: 'var(--tekst-1-app)' }}>
            VIND &amp; SIKT
          </span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--tekst-8-alt)' }}>
            Serie {serieNo} · {position === 'L' ? 'Liggende' : 'Stående'}
          </span>
          <button type="button" onClick={onClose} aria-label="Lukk"
            className="ml-auto"
            style={{
              width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer',
              color: 'var(--mut)', background: 'none', border: '1px solid var(--line2)', borderRadius: 8,
            }}>
            ✕
          </button>
        </div>

        <div style={{ padding: '18px 20px 20px' }}>
          <p style={{ ...capStyle, margin: '2px 0 8px' }}>Vimpel — trykk den som ligner</p>
          {/* 11-tilstands skala: én rad, horisontalt scrollbar m/ snap. */}
          <div ref={scaleRef} className="flex"
            style={{
              gap: 6, overflowX: 'auto', padding: '6px 2px',
              scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch',
            }}>
            {STATES.map((st, i) => {
              const active = selIdx === i
              return (
                <button key={i} type="button"
                  onClick={() => setSelIdx(active ? null : i)}
                  aria-label={windText(st.d, st.l) ?? 'Vindstille'}
                  style={{
                    flex: '0 0 auto', width: 64, minHeight: 36, scrollSnapAlign: 'center',
                    border: `1px solid ${active ? '#E23A5A' : 'var(--line)'}`,
                    background: active ? 'rgba(226,58,90,.10)' : 'var(--card)',
                    borderRadius: 10, padding: '8px 4px 6px', cursor: 'pointer', textAlign: 'center',
                  }}>
                  <VimpelIcon retning={st.d} styrke={st.l} size={46} />
                  <span style={{
                    display: 'block', marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: active ? '#E23A5A' : 'var(--tekst-8-alt)', fontWeight: active ? 700 : 400,
                  }}>
                    {st.l === 0 ? '0' : `${st.d}${st.l}`}
                  </span>
                </button>
              )
            })}
          </div>
          <p style={{
            marginTop: 10, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 15.5, color: 'var(--mut)', minHeight: 22,
          }}>
            {valText ? (
              <>Vimpel <b style={{ color: '#E23A5A' }}>{valText.replace(/^Vimpel /, '')}</b></>
            ) : 'Ingen vind valgt'}
          </p>

          <p style={{ ...capStyle, margin: '18px 0 8px' }}>Sikt</p>
          {/* Sikt-chips — wrapper til flere rader på smal skjerm. */}
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {SIGHT_LEVELS.map(s => {
              const active = sikt === s.key
              return (
                <button key={s.key} type="button"
                  onClick={() => setSikt(active ? null : s.key)}
                  className="flex items-center"
                  style={{
                    gap: 8, minHeight: 38, padding: '9px 14px', cursor: 'pointer',
                    border: `1px solid ${active ? '#1A6FD4' : 'var(--line2)'}`,
                    background: active ? 'rgba(26,111,212,.12)' : 'var(--card)',
                    borderRadius: 9, fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14.5, color: active ? 'var(--tekst-1-app)' : 'var(--mut)',
                    fontWeight: active ? 700 : 400,
                  }}>
                  <FogIcon fog={s.fog} />
                  {s.label}
                </button>
              )
            })}
          </div>

          {isSuggestion && (
            <p className="flex items-center" style={{
              gap: 10, marginTop: 16, fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 13.5, color: 'var(--mut)',
            }}>
              <span aria-hidden style={{
                width: 18, height: 18, border: '1.5px solid var(--line2)', borderRadius: 5,
                display: 'grid', placeItems: 'center', color: '#28A86E', fontWeight: 800, fontSize: 12,
              }}>✓</span>
              Forslag fra forrige serie — lagres først når du trykker Lagre.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap justify-end" style={{ gap: 10, padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={clear}
            style={{
              borderRadius: 9, padding: '9px 18px', minHeight: 38, cursor: 'pointer',
              border: '1px solid var(--line2)', background: 'none', color: 'var(--mut)',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14,
            }}>
            Fjern vind
          </button>
          <button type="button" onClick={onClose}
            style={{
              borderRadius: 9, padding: '9px 18px', minHeight: 38, cursor: 'pointer',
              border: '1px solid var(--line2)', background: 'none', color: 'var(--mut)',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14,
            }}>
            Avbryt
          </button>
          <button type="button" onClick={save}
            style={{
              borderRadius: 9, padding: '9px 22px', minHeight: 38, cursor: 'pointer',
              border: 'none', background: '#E23A5A', color: 'var(--tekst-1-ren)',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14.5,
            }}>
            Lagre
          </button>
        </div>
      </div>
    </div>
  )
}
