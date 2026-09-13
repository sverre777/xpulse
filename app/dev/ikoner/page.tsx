import { notFound } from 'next/navigation'
import { Ikon, IKON_NAVN, type IkonStorrelse } from '@/components/ui/ikoner'

// Kontrollside for ikonsettet - KUN i utvikling (ikke lenket fra noen meny).
// Alle ikoner i begge varianter i 14/18/22/26 px, på mørk og lys flate.
export const dynamic = 'force-static'

const STORRELSER: IkonStorrelse[] = [14, 18, 22, 26]

export default function IkonKontroll() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, padding: 16, background: '#15161a', color: '#ddd', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 16, margin: '0 0 12px' }}>Ikonsettet - {IKON_NAVN.length} ikoner, strek og fyll, 14 / 18 / 22 / 26 px</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {IKON_NAVN.map(navn => (
          <div key={navn} data-ikon-rad={navn} style={{ border: '1px solid #333', borderRadius: 6, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b>{navn}</b>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {STORRELSER.map(s => <Ikon key={`s${s}`} navn={navn} variant="strek" storrelse={s} />)}
              <span style={{ width: 8 }} />
              {STORRELSER.map(s => <Ikon key={`f${s}`} navn={navn} variant="fyll" storrelse={s} />)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f4f4f2', color: '#1c1d21', borderRadius: 4, padding: '3px 6px' }}>
              {STORRELSER.map(s => <Ikon key={`ls${s}`} navn={navn} variant="strek" storrelse={s} />)}
              <span style={{ width: 8 }} />
              {STORRELSER.map(s => <Ikon key={`lf${s}`} navn={navn} variant="fyll" storrelse={s} />)}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
