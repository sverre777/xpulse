// Gjenbrukbar komponent for å vise total/liggende/stående treff% konsistent
// på tvers av app-en. Aksepterer enten ferdigbrukerte prosenter eller
// rå-tall (hits + shots) og regner ut prosent selv. Layout-varianter:
// - 'cards': tre StatCards side ved side (oppsummering, brukes på topp av
//   skyting/oversikt-faner)
// - 'inline': kompakt tekst-linje "Total 87% (L 92% · S 82%)" — passer i
//   workout-cards, sammenlignings-tabeller og lignende.

const COLOR_PRONE = '#38BDF8'
const COLOR_STANDING = '#FF4500'
const COLOR_TOTAL = '#F0F0F2'

export interface ShootingTotals {
  prone_shots?: number
  prone_hits?: number
  standing_shots?: number
  standing_hits?: number
  // Pre-beregnede prosenter overstyrer rå-tall hvis satt.
  prone_accuracy_pct?: number | null
  standing_accuracy_pct?: number | null
  total_accuracy_pct?: number | null
}

function pct(hits: number | undefined, shots: number | undefined): number | null {
  if (!shots || shots <= 0) return null
  return Math.round(((hits ?? 0) / shots) * 1000) / 10
}

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}%`
}

function deriveStats(t: ShootingTotals): { total: number | null; prone: number | null; standing: number | null; totalShots: number; proneShots: number; standingShots: number } {
  const proneShots = t.prone_shots ?? 0
  const standingShots = t.standing_shots ?? 0
  const totalShots = proneShots + standingShots
  const prone = t.prone_accuracy_pct ?? pct(t.prone_hits, t.prone_shots)
  const standing = t.standing_accuracy_pct ?? pct(t.standing_hits, t.standing_shots)
  const total = t.total_accuracy_pct
    ?? pct((t.prone_hits ?? 0) + (t.standing_hits ?? 0), totalShots)
  return { total, prone, standing, totalShots, proneShots, standingShots }
}

interface Props {
  totals: ShootingTotals
  variant?: 'cards' | 'inline'
}

export function TreffPercentageDisplay({ totals, variant = 'inline' }: Props) {
  const s = deriveStats(totals)
  if (s.totalShots === 0 && s.total == null) return null

  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-3 gap-2">
        <Card label="Totalt" value={fmtPct(s.total)}
          sub={s.totalShots > 0 ? `${s.totalShots} skudd` : null}
          color={COLOR_TOTAL} />
        <Card label="Liggende" value={fmtPct(s.prone)}
          sub={s.proneShots > 0 ? `${s.proneShots} skudd` : null}
          color={COLOR_PRONE} />
        <Card label="Stående" value={fmtPct(s.standing)}
          sub={s.standingShots > 0 ? `${s.standingShots} skudd` : null}
          color={COLOR_STANDING} />
      </div>
    )
  }

  return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px' }}>
      <span style={{ color: COLOR_TOTAL }}>Total {fmtPct(s.total)}</span>
      <span style={{ color: '#555560', margin: '0 6px' }}>·</span>
      <span style={{ color: COLOR_PRONE }}>L {fmtPct(s.prone)}</span>
      <span style={{ color: '#555560', margin: '0 6px' }}>·</span>
      <span style={{ color: COLOR_STANDING }}>S {fmtPct(s.standing)}</span>
    </span>
  )
}

function Card({ label, value, sub, color }: { label: string; value: string; sub: string | null; color: string }) {
  return (
    <div className="p-3 flex flex-col gap-1"
      style={{
        backgroundColor: '#13131A',
        border: '1px solid #1E1E22',
        borderLeft: `3px solid ${color}`,
      }}>
      <span className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', lineHeight: 1, letterSpacing: '0.03em' }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
          {sub}
        </span>
      )}
    </div>
  )
}
