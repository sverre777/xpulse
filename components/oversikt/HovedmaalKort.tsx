'use client'

// HJEM v2 bolk 7 — HOVEDMÅL. Fasit design/xpulse-hjem-kort-v2-design.html
// (kort 6): goal_main, dager til sesongslutt; «Timer hittil» (x / plan · %)
// m/ framdrift + «i rute / bak · plan y % · t/uke snitt»; «Skudd hittil» mot
// annual_shot_goal m/ framdrift + treff %; under: inntil 2 RESULTATMÅL (mål 2
// og 3) som liste m/ nummer-chip. Kilde for resultatmålene: linjene i
// seasons.goal_details (training_goals brukes ikke i koden). Ikke satt →
// blokken skjules. Ingen mål → «Ingen mål satt» + «Åpne årsplan →» (oransje).

import Link from 'next/link'
import type { OversiktMainGoal, OversiktResultatMaal, OversiktSkuddHittil } from '@/app/actions/oversikt'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'

const FONT = "'Barlow Condensed', sans-serif"
const ORANSJE = '#FF4500'
const GRONN = '#28A86E'
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
function fmtDato(iso: string): string { const d = new Date(iso + 'T00:00:00'); return `${d.getDate()}. ${MND[d.getMonth()]}` }
function pct(a: number, b: number): number { return b > 0 ? Math.round((a / b) * 100) : 0 }
function fmtT(t: number): string { return `${Math.round(t)} t` }
// Deterministisk tusenskille (ingen Intl — server/nettleser kan skille seg).
function tusen(n: number): string { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') }

function Framdrift({ navn, verdi, maal, verdiTekst, maalTekst, under, farge, data }: {
  navn: string; verdi: number; maal: number; verdiTekst: string; maalTekst: string; under: string | null; farge: string; data: string
}) {
  const p = Math.min(100, pct(verdi, maal))
  return (
    <div data-framdrift={data} style={{ marginTop: 10 }}>
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontFamily: FONT, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)' }}>{navn}</span>
        <span style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-1-app)', fontVariantNumeric: 'tabular-nums' }}>
          <b>{verdiTekst}</b> <span style={{ color: 'var(--tekst-8-alt)' }}>/ {maalTekst} · {pct(verdi, maal)} %</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--flate-12-alt)', marginTop: 4, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: farge, borderRadius: 999 }} />
      </div>
      {under && <p style={{ fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)', margin: '3px 0 0' }}>{under}</p>}
    </div>
  )
}

export function HovedmaalKort({ goal, shotGoal, resultGoals, todayISO }: {
  goal: OversiktMainGoal | null
  shotGoal: OversiktSkuddHittil | null
  resultGoals: OversiktResultatMaal[]
  todayISO: string
}) {
  // Skudd hittil kun for skiskyttere (prompt «skyting kun for skiskyttere»).
  const harSki = useHarSkiskyting()
  const ramme: React.CSSProperties = { backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, minWidth: 0 }
  if (!goal) {
    return (
      <section className="p-5 h-full flex flex-col" data-hovedmaal-kort data-tilstand="ingen" style={ramme}>
        <div className="xp-kh"><span className="xp-beam" /><h2 className="xp-kh-t">Hovedmål</h2></div>
        <p className="xp-key-h3">Ingen mål satt</p>
        <p className="xp-key-p">Sett sesongens hovedmål i årsplanen, så følger kortet timer, skudd og resultatmål her.</p>
        <div className="mt-auto"><Link href="/app/periodisering" className="xp-hbtn" style={{ backgroundColor: ORANSJE, color: 'var(--tekst-1-ren)' }}>Åpne årsplan →</Link></div>
      </section>
    )
  }
  // Framdrift i sesongen: dager gått / dager totalt → «plan y %».
  const start = goal.season_start ?? null
  const dagerTotalt = start ? Math.max(1, Math.round((new Date(goal.season_end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000) + 1) : null
  const dagerGaatt = start ? Math.max(0, Math.round((new Date(todayISO + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000) + 1) : null
  const planPct = dagerTotalt && dagerGaatt != null ? Math.min(100, Math.round((dagerGaatt / dagerTotalt) * 100)) : null
  const ukerGaatt = dagerGaatt != null ? Math.max(1, dagerGaatt / 7) : null
  const timer = goal.actual_hours_to_date
  const timerPlan = goal.planned_hours_total
  const timerPct = timer != null && timerPlan ? pct(timer, timerPlan) : null
  const iRute = timerPct != null && planPct != null ? (timerPct >= planPct ? 'i rute' : 'bak') : null
  const snittUke = timer != null && ukerGaatt ? (timer / ukerGaatt).toFixed(1).replace('.', ',') : null
  const skuddPct = shotGoal?.annual_shot_goal ? pct(shotGoal.skutt, shotGoal.annual_shot_goal) : null
  const skuddIRute = skuddPct != null && planPct != null ? (skuddPct >= planPct ? 'i rute' : 'bak') : null

  return (
    <section className="p-5 h-full flex flex-col" data-hovedmaal-kort data-tilstand="maal" style={ramme}>
      <div className="xp-kh" style={{ marginBottom: 8 }}>
        <span className="xp-beam" />
        <h2 className="xp-kh-t">Hovedmål</h2>
        <span className="xp-kh-tag">{goal.season_name}</span>
      </div>
      <p className="xp-key-h3" style={{ marginBottom: 2 }}>{goal.goal_main}</p>
      <p style={{ fontFamily: FONT, fontSize: 13, color: 'var(--tekst-5-app)', margin: 0 }} data-sesongslutt>
        {goal.days_until_end >= 0 ? `${goal.days_until_end} dager til sesongslutt · ${fmtDato(goal.season_end)}` : `Sesongen sluttet ${fmtDato(goal.season_end)}`}
      </p>

      {timer != null && timerPlan ? (
        <Framdrift navn="Timer hittil" data="timer" verdi={timer} maal={timerPlan} verdiTekst={fmtT(timer)} maalTekst={fmtT(timerPlan)} farge={iRute === 'bak' ? ORANSJE : GRONN}
          under={[iRute, planPct != null ? `plan ${planPct} %` : null, snittUke ? `${snittUke} t/uke snitt` : null].filter(Boolean).join(' · ') || null} />
      ) : (
        <p style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-8-alt)', margin: '10px 0 0' }} data-framdrift="timer-mangler">
          Timer hittil: {timer != null ? fmtT(timer) : '—'} · ingen planlagt volum å måle mot
        </p>
      )}
      {harSki && shotGoal && shotGoal.annual_shot_goal ? (
        <Framdrift navn="Skudd hittil" data="skudd" verdi={shotGoal.skutt} maal={shotGoal.annual_shot_goal}
          verdiTekst={tusen(shotGoal.skutt)} maalTekst={tusen(shotGoal.annual_shot_goal)} farge={skuddIRute === 'bak' ? ORANSJE : GRONN}
          under={[skuddIRute, planPct != null ? `plan ${planPct} %` : null, shotGoal.treffPct != null ? `treff ${shotGoal.treffPct} %` : null].filter(Boolean).join(' · ') || null} />
      ) : null}

      {resultGoals.length > 0 && (
        <div data-resultatmaal className="flex flex-col" style={{ marginTop: 12, borderTop: '1px solid var(--line)' }}>
          {resultGoals.map(m => (
            <div key={m.nr} className="flex items-center gap-3" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: 'var(--flate-12-alt)', fontFamily: FONT, fontSize: 12, fontWeight: 800, color: 'var(--tekst-1-app)', flexShrink: 0 }}>{m.nr}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: 'var(--tekst-1-app)', margin: 0 }}>{m.tekst}</p>
                <p style={{ fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-8-alt)', margin: 0 }}>resultatmål</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3">
        <Link href="/app/periodisering" style={{ fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: ORANSJE, textDecoration: 'none' }}>Åpne årsplan →</Link>
      </div>
    </section>
  )
}
