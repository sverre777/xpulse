'use client'

// Utstyr-velger som POP-UP (fasit: design seksjon 5) — gruppert per kategori
// m/ avhuking, km-tall og søk; FLERE utstyr velges i samme omgang. Samme
// pop-up brukes både fra «Utstyr brukt»-seksjonen (hele økta) og fra
// aktivitetsraden (⇄ bytte). Rendres via portal: WorkoutForm er selv et
// <form>, og popupen har input-felter — portal-grepet gjelder.

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  normalizeCategory,
  type Equipment,
  type EquipmentCategory,
  type EquipmentWithUsage,
} from '@/lib/equipment-types'

const ATHLETE_ORANGE = '#FF4500'

interface Props {
  available: Equipment[]
  selectedIds: string[]
  title?: string
  hint?: string
  onDone: (ids: string[]) => void
  onClose: () => void
}

export function UtstyrVelgerPopup({ available, selectedIds, title = 'Velg utstyr', hint, onDone, onClose }: Props) {
  const [valgte, setValgte] = useState<string[]>(selectedIds)
  const [sok, setSok] = useState('')

  const aktive = useMemo(() => available.filter(e => e.status === 'active'), [available])

  const grupper = useMemo(() => {
    const q = sok.trim().toLowerCase()
    const treff = q
      ? aktive.filter(e => `${e.name} ${e.brand ?? ''} ${e.model ?? ''}`.toLowerCase().includes(q))
      : aktive
    const map = new Map<EquipmentCategory, Equipment[]>()
    for (const cat of EQUIPMENT_CATEGORIES) map.set(cat, [])
    for (const e of treff) map.get(normalizeCategory(e.category))?.push(e)
    return map
  }, [aktive, sok])

  const toggle = (id: string) => {
    setValgte(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])
  }

  const body = (
    <div onClick={onClose}
      style={{
        // z 200: økt-modalen ligger på 100 — 70 la velgeren BAK overlayet,
        // så klikkene traff modalens bakgrunn og lukket hele økta i stedet.
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'var(--scrim-70)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '6vh', paddingBottom: '6vh', overflow: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--flate-3)', border: '1px solid var(--line2)',
          borderRadius: 14, width: '94%', maxWidth: '520px',
        }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--kant-3)' }}>
          <div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: '22px', letterSpacing: '0.08em' }}>
              {title}
            </h2>
            {hint && (
              <p className="text-xs" style={{ color: 'var(--tekst-5-app)' }}>{hint}</p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', cursor: 'pointer', fontSize: '22px' }}>
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          {aktive.length === 0 ? (
            <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
              Du har ingen aktivt utstyr. Legg til på <Link href="/app/utstyr"
                style={{ color: ATHLETE_ORANGE, textDecoration: 'underline' }}>/app/utstyr</Link>.
            </p>
          ) : (
            <>
              <input value={sok} onChange={e => setSok(e.target.value)}
                placeholder="Søk i utstyret…"
                className="w-full px-4 py-2 mb-3"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: 'var(--tekst-1-app)', backgroundColor: 'var(--flate-8-alt)',
                  border: '1px solid var(--kant-3)', borderRadius: 9, fontSize: '14px',
                }} />
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {EQUIPMENT_CATEGORIES.map(cat => {
                  const items = grupper.get(cat) ?? []
                  if (items.length === 0) return null
                  return (
                    <div key={cat} className="mb-3">
                      <p className="text-xs tracking-widest uppercase mb-1"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
                        {EQUIPMENT_CATEGORY_LABELS[cat]}
                      </p>
                      {items.map(e => {
                        const valgt = valgte.includes(e.id)
                        const usage = (e as EquipmentWithUsage).usage
                        const subtitle = [e.brand, e.model].filter(Boolean).join(' ')
                        return (
                          <button key={e.id} type="button" onClick={() => toggle(e.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 mb-1 text-left"
                            style={{
                              background: valgt ? 'rgba(255,69,0,0.07)' : 'none',
                              border: `1px solid ${valgt ? ATHLETE_ORANGE : 'var(--kant-3)'}`,
                              borderRadius: 9, cursor: 'pointer',
                            }}>
                            <span aria-hidden style={{
                              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                              border: `1px solid ${valgt ? ATHLETE_ORANGE : 'var(--line2)'}`,
                              backgroundColor: valgt ? ATHLETE_ORANGE : 'transparent',
                              color: 'var(--tekst-1-app)', fontSize: 11, lineHeight: '15px', textAlign: 'center',
                            }}>{valgt ? '✓' : ''}</span>
                            <span className="flex-1 min-w-0">
                              <span className="block truncate"
                                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-1-app)', fontSize: '14px' }}>
                                {e.name}
                              </span>
                              {subtitle && (
                                <span className="block truncate text-xs" style={{ color: 'var(--tekst-8-app)' }}>{subtitle}</span>
                              )}
                            </span>
                            {usage && (
                              <span className="text-xs shrink-0 tracking-widest uppercase"
                                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
                                {usage.total_km.toFixed(0)} km
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--kant-3)' }}>
          <button type="button" onClick={onClose} className="xp-pill xp-pill-ghost">
            Avbryt
          </button>
          <button type="button" onClick={() => { onDone(valgte); onClose() }}
            className="xp-pill xp-pill-primary">
            Ferdig{valgte.length > 0 ? ` (${valgte.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(body, document.body)
}
