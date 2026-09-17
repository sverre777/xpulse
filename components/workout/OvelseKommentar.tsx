'use client'

// Styrke bolk 8i: kommentar per øvelse og for hele økta - ÉN komponent for live
// (LiveSessionView) og plan/dagbok (ActivitiesSection), regel 11. Ikon fra
// ikonsettet (ingen snakkeboble finnes - «innboks» brukes), fylt + prikk når
// det finnes tekst. Trykk -> lite felt (textarea, 2 rader) rett under, ikke
// modal. Teksten eies av forelderen (exercise.notes / workouts.notes).

import { Ikon } from '@/components/ui/ikoner'

const FONT = "'Barlow Condensed', sans-serif"

export function KommentarKnapp({ harTekst, apen, onClick, aria, storrelse = 36 }: { harTekst: boolean; apen: boolean; onClick: () => void; aria: string; storrelse?: number }) {
  return (
    <button type="button" onClick={onClick} aria-label={aria} aria-expanded={apen} data-kommentar-knapp data-har-tekst={harTekst ? '1' : '0'}
      style={{ position: 'relative', background: 'none', border: 'none', padding: 0, minWidth: storrelse, minHeight: storrelse, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: harTekst || apen ? 'var(--tekst-1-app)' : 'var(--tekst-8-app)', flex: 'none' }}>
      <Ikon navn="notat" variant={harTekst ? 'fyll' : 'strek'} storrelse={18} />
      {harTekst && <span aria-hidden="true" style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 999, background: '#FF4500' }} />}
    </button>
  )
}

export function KommentarFelt({ verdi, onChange, placeholder, onLukk, dataAttr }: { verdi: string; onChange: (v: string) => void; placeholder: string; onLukk?: () => void; dataAttr?: string }) {
  return (
    <div style={{ padding: '0 14px 10px' }} data-kommentar-felt={dataAttr ?? ''}>
      <textarea value={verdi} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder} autoFocus aria-label={placeholder}
        onBlur={onLukk} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onLukk?.() } }}
        style={{ width: '100%', resize: 'vertical', background: 'var(--card2)', border: '1px solid var(--line2)', borderRadius: 12, color: 'var(--tekst-1-app)', fontFamily: FONT, fontSize: 14, padding: '8px 12px', outline: 'none', minHeight: 56 }} />
    </div>
  )
}

/** Lukket tilstand med tekst: teksten vises som en stille linje (trener med bare lesetilgang ser den uten å trykke). */
export function KommentarLinje({ tekst, onClick, dataAttr }: { tekst: string; onClick?: () => void; dataAttr?: string }) {
  if (!tekst.trim()) return null
  return (
    <button type="button" onClick={onClick} data-kommentar-linje={dataAttr ?? ''} title="Rediger kommentaren"
      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '0 14px 10px', cursor: onClick ? 'pointer' : 'default', fontFamily: FONT, fontSize: 13, color: 'var(--tekst-5-app)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
      {tekst}
    </button>
  )
}
