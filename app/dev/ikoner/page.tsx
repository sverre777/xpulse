import { notFound } from 'next/navigation'
import { Ikon, IKON_NAVN, MINI, ALIAS, type IkonStorrelse } from '@/components/ui/ikoner'

// Kontrollside for ikonsettet - KUN i utvikling (ikke lenket fra noen meny).
// Alle ikoner i begge varianter i 14/18/22/26 px, på mørk og lys flate, og for
// de som har mini-variant: standard mot mini på 14 px.
export const dynamic = 'force-static'

const STORRELSER: IkonStorrelse[] = [14, 18, 22, 26]

export default function IkonKontroll() {
  if (process.env.NODE_ENV === 'production') notFound()
  const antallMini = IKON_NAVN.filter(n => MINI[n]).length
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, padding: 16, background: '#15161a', color: '#ddd', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 16, margin: '0 0 4px' }}>Ikonsettet - {IKON_NAVN.length} navn, strek og fyll, 14 / 18 / 22 / 26 px</h1>
      <p style={{ margin: '0 0 12px', color: '#999' }}>{antallMini} har mini-variant (brukes automatisk ved 14 px). Alias: {Object.entries(ALIAS).map(([a, m]) => `${a} = ${m}`).join(', ')}.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {IKON_NAVN.map(navn => (
          <div key={navn} data-ikon-rad={navn} style={{ border: '1px solid #333', borderRadius: 6, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b>{navn}{ALIAS[navn] ? <span style={{ color: '#999', fontWeight: 400 }}> = {ALIAS[navn]}</span> : null}</b>
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
            {MINI[navn] && (
              <div data-mini-rad style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#999' }}>
                14 px standard
                <Ikon navn={navn} variant="strek" storrelse={14} optisk="standard" />
                <Ikon navn={navn} variant="fyll" storrelse={14} optisk="standard" />
                <span style={{ marginLeft: 6 }}>mini</span>
                <Ikon navn={navn} variant="strek" storrelse={14} />
                <Ikon navn={navn} variant="fyll" storrelse={14} />
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
