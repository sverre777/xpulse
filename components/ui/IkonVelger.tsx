'use client'

// Nedtrekk som KAN vise ikoner (Sverre 14. sep 2026).
//
// Et native <select> kan bare bære tekst - derfor lakk ikonnavnet ut som ord i
// lista da ACTIVITY_TYPES gikk fra emoji til ikonnavn. Denne velgeren tegner
// knappen og lista selv: ikon i sin farge, så etiketten, i samme form som
// resten av appen.
//
// Kontrakten er som et select: verdi inn, verdi ut. Tastatur: Enter/Space og
// pil ned åpner, piltaster flytter, Enter velger, Esc lukker. Klikk utenfor
// lukker. Lista er et <ul role="listbox"> med aria-selected, så skjermlesere
// leser den som en liste - ikke en knapperad.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Ikon, type IkonNavn } from '@/components/ui/ikoner'

export interface IkonValg<V extends string = string> {
  verdi: V
  etikett: string
  ikon?: IkonNavn
  /** Fargen ikonet skal ha. Uten farge arver det teksten. */
  farge?: string
  /** Gruppeoverskrift over valget (som <optgroup>). */
  gruppe?: string
}

const FONT = "'Barlow Condensed', sans-serif"

export function IkonVelger<V extends string = string>({
  verdi, valg, onVelg, ariaLabel, id, stil, uthevet = false, disabled = false,
}: {
  verdi: V
  valg: IkonValg<V>[]
  onVelg: (v: V) => void
  ariaLabel: string
  id?: string
  /** Feltstilen fra skjemaet, så velgeren ser ut som de andre feltene. */
  stil?: React.CSSProperties
  /** Uthevet = feltet mangler noe (samme signal som select-en hadde). */
  uthevet?: boolean
  disabled?: boolean
}) {
  const [aapen, setAapen] = useState(false)
  const [markert, setMarkert] = useState(0)
  const rot = useRef<HTMLDivElement | null>(null)
  const listeId = useId()
  const valgt = useMemo(() => valg.find(v => v.verdi === verdi) ?? null, [valg, verdi])

  useEffect(() => {
    if (!aapen) return
    const klikk = (e: MouseEvent) => { if (rot.current && !rot.current.contains(e.target as Node)) setAapen(false) }
    document.addEventListener('mousedown', klikk)
    return () => document.removeEventListener('mousedown', klikk)
  }, [aapen])

  const aapne = () => {
    if (disabled) return
    const i = valg.findIndex(v => v.verdi === verdi)
    setMarkert(i < 0 ? 0 : i)
    setAapen(true)
  }

  const tast = (e: React.KeyboardEvent) => {
    if (!aapen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); aapne() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); setAapen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setMarkert(m => Math.min(valg.length - 1, m + 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setMarkert(m => Math.max(0, m - 1)); return }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const v = valg[markert]
      if (v) { onVelg(v.verdi); setAapen(false) }
    }
  }

  // Gruppene i rekkefølgen de kommer (som <optgroup>).
  const grupper: { navn: string | null; valg: IkonValg<V>[] }[] = []
  for (const v of valg) {
    const siste = grupper[grupper.length - 1]
    if (siste && siste.navn === (v.gruppe ?? null)) siste.valg.push(v)
    else grupper.push({ navn: v.gruppe ?? null, valg: [v] })
  }

  return (
    <div ref={rot} style={{ position: 'relative' }} data-ikonvelger={ariaLabel}>
      <button type="button" id={id} disabled={disabled}
        onClick={() => (aapen ? setAapen(false) : aapne())}
        onKeyDown={tast}
        aria-haspopup="listbox" aria-expanded={aapen} aria-label={ariaLabel}
        style={{
          ...stil,
          display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
          cursor: disabled ? 'default' : 'pointer', width: '100%',
          color: uthevet ? 'var(--accent)' : stil?.color,
          fontWeight: uthevet ? 700 : stil?.fontWeight,
        }}>
        {valgt?.ikon && (
          <Ikon navn={valgt.ikon} variant="fyll" storrelse={14} style={{ color: valgt.farge }} />
        )}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {valgt?.etikett ?? ''}
        </span>
        <Ikon navn="neste" variant="strek" storrelse={14}
          style={{ transform: 'rotate(90deg)', opacity: 0.7, flexShrink: 0 }} />
      </button>

      {aapen && (
        <ul role="listbox" id={listeId} aria-label={ariaLabel} tabIndex={-1} onKeyDown={tast}
          style={{
            position: 'absolute', zIndex: 60, top: 'calc(100% + 4px)', left: 0, minWidth: '100%',
            maxHeight: 320, overflowY: 'auto', margin: 0, padding: 4, listStyle: 'none',
            background: 'var(--card)', border: '1px solid var(--line2)', borderRadius: 12,
            boxShadow: '0 18px 48px rgba(0,0,0,.5)', fontFamily: FONT,
          }}>
          {grupper.map((g, gi) => (
            <li key={g.navn ?? `g${gi}`} role="presentation">
              {g.navn && (
                <div style={{
                  fontFamily: FONT, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: 'var(--tekst-8-alt)', padding: '8px 10px 4px',
                }}>{g.navn}</div>
              )}
              <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {g.valg.map(v => {
                  const i = valg.indexOf(v)
                  const erValgt = v.verdi === verdi
                  return (
                    <li key={`${g.navn ?? ''}-${v.verdi}`} role="option" aria-selected={erValgt}
                      data-ikonvalg={v.verdi}
                      onMouseEnter={() => setMarkert(i)}
                      onClick={() => { onVelg(v.verdi); setAapen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                        padding: '9px 10px', borderRadius: 8, minHeight: 40,
                        background: markert === i ? 'var(--flate-12-alt)' : 'transparent',
                        color: erValgt ? 'var(--tekst-1-app)' : 'var(--tekst-3-app)',
                        fontSize: 14.5, letterSpacing: '0.02em',
                      }}>
                      {v.ikon
                        ? <Ikon navn={v.ikon} variant="fyll" storrelse={18} style={{ color: v.farge, flexShrink: 0 }} />
                        : <span style={{ width: 18, flexShrink: 0 }} />}
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.etikett}
                      </span>
                      {erValgt && <Ikon navn="fullfort" variant="strek" storrelse={14} style={{ flexShrink: 0 }} />}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
