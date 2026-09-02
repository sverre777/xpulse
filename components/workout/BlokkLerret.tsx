'use client'

import type { KurveHjelpere } from './OktKurve'

// BLOKK-LERRETET: tidslinje uten pulskurve — plan, eller gjennomført uten
// klokke. REN LESEVISNING: flaten tar ikke klikk, alt redigeres i radene.
// Tegningen er grunnlaget for plan-grafen (bolk 5).
//
// Komponenten gir NØYAKTIG samme hjelpere som OktKurve (KurveHjelpere), så
// radbåndet, spøkelseslaget og punktene tegnes med samme kode uten å vite
// hvilket lerret de står på.

const H = 150

export function BlokkLerret({
  totalSek, planlagt = false, overlay,
}: {
  totalSek: number
  /** Planlagt økt — punkter tegnes hule/stiplet, ramma stiplet. */
  planlagt?: boolean
  overlay?: (h: KurveHjelpere) => React.ReactNode
}) {
  const spenn = Math.max(1, totalSek)

  const hjelpere: KurveHjelpere = {
    pct: sek => `${Math.max(0, Math.min(100, (sek / spenn) * 100))}%`,
    x: sek => (sek / spenn) * 1000,
    // Uten kurve finnes ingen y-verdi å feste et punkt til — punktene
    // legges i overkant, der de er lesbare og ikke dekker blokkene.
    yPctForSerie: () => '22%',
    fraSek: 0,
    tilSek: spenn,
    sekFraAndel: andel => Math.max(0, Math.min(1, andel)) * spenn,
  }

  const tidsmerker = [0, 0.25, 0.5, 0.75, 1].map(f => f * spenn)

  return (
    <div>
      <div
        data-oktkurve="1"
        style={{
          position: 'relative', height: H,
          background: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)',
          borderRadius: 10, overflow: 'hidden',
          // Planlagt økt markeres med en svak stiplet ramme, så det er
          // synlig hvilket lerret man står i uten en egen etikett.
          borderStyle: planlagt ? 'dashed' : 'solid',
        }}>
        {/* Grunnlinje + tidsraster, så blokkene har noe å stå på. */}
        {tidsmerker.map((t, i) => (
          <span key={i} aria-hidden style={{
            position: 'absolute', left: hjelpere.pct(t), top: 0, bottom: 22,
            width: 1, background: 'var(--kant-3)', opacity: 0.6,
          }} />
        ))}
        {overlay?.(hjelpere)}
      </div>
      <div className="flex justify-between" style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'var(--tekst-8-alt)', marginTop: 2,
      }}>
        {tidsmerker.map((t, i) => {
          const m = Math.floor(t / 60), s = Math.floor(t % 60)
          return <span key={i}>{`${m}:${String(s).padStart(2, '0')}`}</span>
        })}
      </div>
    </div>
  )
}
