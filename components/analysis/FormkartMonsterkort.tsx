'use client'

// FORMKARTET bolk 4 - MØNSTERKORT. Henter selv gjennom getFormkart (samme
// lager som kartet), ingen ny modell.
//   Belastning: monotoni (Foster, 7 d) · lengste strekk uten hviledag ·
//               hviledager per 28 d. Belastningsstruktur, ikke helse.
//   Helse:      HRV 7 d mot 60-dagers grunnivå · sykdomsdager i perioden.
// Under ti dager med verdier: «for lite data», ALDRI et tall. Veiledningstall
// er aldri alarmer - ingen farget advarsel på monotoni. Sykdomskortet er
// OBSERVASJON («uka før startet: X t»), aldri en årsakspåstand.

import { useEffect, useState } from 'react'
import { getFormkart } from '@/app/actions/formkart'
import {
  monotoniFoster, lengsteStrekkUtenHvile, hviledagerPer28, hrv7mot60, sykdomsperioder, MIN_DAGER_FOR_TALL,
  type Formkart as FormkartData,
} from '@/lib/formkart'
import { minusDager } from '@/lib/helse-vindu'
import { HELSE_TREND_FARGER } from '@/lib/helse-farger'
import { STATUS_ROD } from '@/lib/status-farger'
import type { DateRange } from './date-range'
import { KortGruppe } from './KortGruppe'
import { MetricCard } from './MetricCard'

const FOR_LITE = 'for lite data'
const k = (v: number, d = 1) => v.toFixed(d).replace('.', ',')

function useFormkart(fra: string, til: string, targetUserId?: string): FormkartData | null {
  const nokkel = `${fra}|${til}|${targetUserId ?? ''}`
  const [svar, setSvar] = useState<{ nokkel: string; data: FormkartData | null } | null>(null)
  useEffect(() => {
    let live = true
    const n = `${fra}|${til}|${targetUserId ?? ''}`
    getFormkart(fra, til, targetUserId).then(r => { if (live) setSvar({ nokkel: n, data: 'error' in r ? null : r }) }).catch(() => { if (live) setSvar({ nokkel: n, data: null }) })
    return () => { live = false }
  }, [fra, til, targetUserId])
  return svar?.nokkel === nokkel ? svar.data : null
}

/** Belastning-fanen: over korrelasjonskortene i bolk 4. */
export function BelastningMonsterkort({ range, targetUserId, bare }: { range: DateRange; targetUserId?: string; bare?: string }) {
  const data = useFormkart(range.from, range.to, targetUserId)
  const dager = data?.dager ?? []
  // «Dager med verdier» = dager belastningssporet har svart for (tss finnes).
  const medVerdi = dager.filter(d => d.tss != null)
  const forLite = medVerdi.length < MIN_DAGER_FOR_TALL
  const mono = forLite ? null : monotoniFoster(medVerdi.slice(-7).map(d => d.tss ?? 0))
  const strekk = forLite ? null : lengsteStrekkUtenHvile(dager.map(d => ({ hviledag: d.status.hviledag })))
  const hvile28 = forLite ? null : hviledagerPer28(dager.map(d => ({ hviledag: d.status.hviledag })))
  const kort = [
    <MetricCard key="m" chartKey="belastning_monotoni" label="Monotoni (7 d)" value={data == null ? '…' : mono == null ? FOR_LITE : k(mono, 2)}
      valueSize={mono == null ? 22 : 40} accent="var(--tekst-5-app)"
      sublabel={mono == null ? (data && !forLite ? 'sju like dager - ingen spredning å dele på' : `trenger ${MIN_DAGER_FOR_TALL} dager med belastning`) : 'snitt / standardavvik av daglig TSS · høyt = like dager på rad · veiledning, ikke alarm'} />,
    <MetricCard key="s" chartKey="belastning_strekk_uten_hvile" label="Lengste strekk uten hviledag" value={data == null ? '…' : strekk == null ? FOR_LITE : `${strekk} d`}
      valueSize={strekk == null ? 22 : 40} accent="var(--tekst-5-app)" sublabel={strekk == null ? `trenger ${MIN_DAGER_FOR_TALL} dager` : 'hviledag = dag uten ført og uten planlagt økt · sykdom er ikke hvile'} />,
    <MetricCard key="h" chartKey="belastning_hviledager_28" label="Hviledager per 28 d" value={data == null ? '…' : hvile28 == null ? FOR_LITE : String(hvile28)}
      valueSize={hvile28 == null ? 22 : 40} accent="var(--tekst-5-app)" sublabel={hvile28 == null ? (forLite ? `trenger ${MIN_DAGER_FOR_TALL} dager` : 'perioden er kortere enn 28 dager') : 'rett telling i de siste 28 dagene av perioden'} />,
  ]
  const valgt = bare ? kort.filter(c => (c.props as { chartKey: string }).chartKey === bare) : kort
  return (
    <KortGruppe chartKey="belastning_monster" tittel="Mønster · under 10 dager = for lite data">
      <div data-belastning-monster className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>{valgt}</div>
    </KortGruppe>
  )
}

/** Helse-fanen: HRV 7 mot 60 og sykdomsdager. Henter 60 dager bakover fra periodens slutt. */
export function HelseMonsterkort({ range, targetUserId, bare }: { range: DateRange; targetUserId?: string; bare?: string }) {
  const fra = minusDager(range.to, 59) < range.from ? minusDager(range.to, 59) : range.from
  const data = useFormkart(fra, range.to, targetUserId)
  const dager = data?.dager ?? []
  const helse = data?.helseInkludert ?? true
  const h = helse ? hrv7mot60(dager.map(d => d.helse?.hrv ?? null)) : null
  const iPerioden = dager.filter(d => d.dato >= range.from)
  const perioder = sykdomsperioder(dager.map(d => ({ dato: d.dato, sykdom: d.status.sykdom, treningSek: d.treningSek }))).filter(p => p.slutt >= range.from)
  const sykdomsdager = iPerioden.filter(d => d.status.sykdom).length
  const medTimer = perioder.filter(p => p.timerUkaFor != null)
  const snittUkaFor = medTimer.length ? medTimer.reduce((a, p) => a + (p.timerUkaFor ?? 0), 0) / medTimer.length : null
  const ukesnitt = iPerioden.length >= 7 ? iPerioden.reduce((a, d) => a + d.treningSek, 0) / 3600 / (iPerioden.length / 7) : null
  const kort = [
    <MetricCard key="h" chartKey="helse_hrv_7_mot_60" label="HRV 7 d mot 60 d" accent={HELSE_TREND_FARGER.hrv}
      value={data == null ? '…' : !helse ? 'skjult' : h == null ? FOR_LITE : `${h.avvikPct > 0 ? '+' : ''}${k(h.avvikPct, 0)} %`} valueSize={h == null ? 22 : 40}
      sublabel={!helse ? 'utøveren har ikke delt helsedata' : h == null ? `trenger ${MIN_DAGER_FOR_TALL} målinger på 60 dager og tre siste uke` : `${k(h.snitt7)} ms siste 7 d mot ${k(h.snitt60)} ms (±${k(h.sd60)}) på 60 d · samme avlesning som restitusjonsbanen`} />,
    <MetricCard key="s" chartKey="helse_sykdomsdager" label="Sykdomsdager i perioden" accent={STATUS_ROD}
      value={data == null ? '…' : String(sykdomsdager)} valueSize={40}
      sublabel={data == null ? null : perioder.length === 0 ? 'ingen sykdom ført i perioden' : `${perioder.length} periode${perioder.length === 1 ? '' : 'r'}${snittUkaFor != null ? ` · uka før startet: i snitt ${k(snittUkaFor)} t` : ''}${ukesnitt != null ? ` (periodesnitt ${k(ukesnitt)} t per uke)` : ''} · observasjon, ikke årsak`} />,
  ]
  const valgt = bare ? kort.filter(c => (c.props as { chartKey: string }).chartKey === bare) : kort
  return (
    <KortGruppe chartKey="helse_monster" tittel="Mønster · HRV mot eget grunnivå og sykdom">
      <div data-helse-monster className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>{valgt}</div>
    </KortGruppe>
  )
}
