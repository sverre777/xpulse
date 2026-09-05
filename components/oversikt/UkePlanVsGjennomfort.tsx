'use client'

// HJEM v2 bolk 5 — UKENS TOTALER, nytt under sonestripa: PLAN VS GJENNOMFØRT
// som fire barer m/ planstrek (Timer · Hard I3+ · Skudd · Treff %) og en
// dagsrad man–søn (stiplet = planlagt, fylt = gjennomført, gul = hardøkt,
// i dag markert). Fasit design/xpulse-hjem-kort-v2-design.html (kort 2).
// Bar = gjennomført (grønn), strek = planen, over plan → oransje.
// Skudd/treff kun for skiskyttere (prompt «skyting kun for skiskyttere»).

import type { OversiktUkePlan } from '@/app/actions/oversikt'
import { fmtHM } from './kort-deler'

const FONT = "'Barlow Condensed', sans-serif"
const GRONN = '#28A86E'
const ORANSJE = '#FF4500'
const GUL = '#E8B93C'
const DAGER = ['MA', 'TI', 'ON', 'TO', 'FR', 'LØ', 'SØ']

function Bar({ navn, verdi, plan, verdiTekst, planTekst, data }: {
  navn: string
  verdi: number
  plan: number | null
  verdiTekst: string
  planTekst: string
  data: string
}) {
  const maks = Math.max(verdi, plan ?? 0, 1)
  const overPlan = plan != null && plan > 0 && verdi > plan
  const bredde = Math.min(100, (verdi / maks) * 100)
  const strek = plan != null && plan > 0 ? Math.min(100, (plan / maks) * 100) : null
  return (
    <div data-ukebar={data} data-over-plan={overPlan ? '1' : '0'} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 92px', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: FONT, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tekst-5-app)' }}>{navn}</span>
      <span style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--flate-12-alt)', overflow: 'visible' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bredde}%`, borderRadius: 999, background: overPlan ? ORANSJE : GRONN }} />
        {strek != null && <span data-planstrek style={{ position: 'absolute', left: `${strek}%`, top: -3, width: 2, height: 14, background: 'var(--tekst-1-app)', opacity: 0.85, transform: 'translateX(-1px)' }} />}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-1-app)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        <b>{verdiTekst}</b> <span style={{ color: 'var(--tekst-8-alt)' }}>{planTekst}</span>
      </span>
    </div>
  )
}

export function UkePlanVsGjennomfort({ plan, todayISO, harSki }: { plan: OversiktUkePlan; todayISO: string; harSki: boolean }) {
  const t = (sek: number) => fmtHM(sek).replace(' ', '')
  const maksDag = Math.max(1, ...plan.dager.map(d => Math.max(d.planlagtSek, d.gjennomfortSek)))
  const treffMaal = plan.treffMaalPct ?? plan.treffSnitt30dPct
  const treffMaalTekst = plan.treffMaalPct != null ? `· mål ${plan.treffMaalPct}` : plan.treffSnitt30dPct != null ? `· snitt 30 d ${plan.treffSnitt30dPct}` : ''
  return (
    <div data-uke-plan style={{ marginTop: 12 }}>
      <p style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tekst-8-alt)', margin: '0 0 6px' }}>Plan vs gjennomført</p>
      <div className="flex flex-col gap-2">
        <Bar navn="Timer" data="timer" verdi={plan.gjennomfortSek} plan={plan.planlagtSek > 0 ? plan.planlagtSek : null}
          verdiTekst={t(plan.gjennomfortSek)} planTekst={plan.planlagtSek > 0 ? `/ ${t(plan.planlagtSek)} plan` : '· ingen plan'} />
        <Bar navn="Hard (I3+)" data="hard" verdi={plan.gjennomfortHardSek} plan={plan.planlagtHardSek > 0 ? plan.planlagtHardSek : null}
          verdiTekst={t(plan.gjennomfortHardSek)} planTekst={plan.planlagtHardSek > 0 ? `/ ${t(plan.planlagtHardSek)} plan` : '· ingen plan'} />
        {harSki && (plan.skutt > 0 || plan.planlagtSkudd > 0) && (
          <Bar navn="Skudd" data="skudd" verdi={plan.skutt} plan={plan.planlagtSkudd > 0 ? plan.planlagtSkudd : null}
            verdiTekst={String(plan.skutt)} planTekst={plan.planlagtSkudd > 0 ? `/ ${plan.planlagtSkudd} plan` : '· ingen plan'} />
        )}
        {harSki && plan.treffPct != null && (
          <Bar navn="Treff" data="treff" verdi={plan.treffPct} plan={treffMaal}
            verdiTekst={`${plan.treffPct} %`} planTekst={treffMaalTekst} />
        )}
      </div>

      {/* Dagsrad man–søn */}
      <div data-uke-dager style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 12, alignItems: 'end' }}>
        {plan.dager.map((d, i) => {
          const erIdag = d.date === todayISO
          const planH = d.planlagtSek > 0 ? Math.max(6, Math.round((d.planlagtSek / maksDag) * 40)) : 0
          const gjH = d.gjennomfortSek > 0 ? Math.max(6, Math.round((d.gjennomfortSek / maksDag) * 40)) : 0
          return (
            <div key={d.date} data-uke-dag={d.date} data-idag={erIdag ? '1' : '0'} data-hard={d.hard ? '1' : '0'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ position: 'relative', width: '100%', height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {planH > 0 && <span data-dag-plan style={{ position: 'absolute', bottom: 0, width: '70%', height: planH, border: '1.5px dashed var(--kant-6)', borderRadius: 4 }} />}
                {gjH > 0 && <span data-dag-gjort style={{ position: 'absolute', bottom: 0, width: '70%', height: gjH, background: d.hard ? GUL : GRONN, borderRadius: 4, opacity: 0.9 }} />}
                {planH === 0 && gjH === 0 && <span style={{ position: 'absolute', bottom: 0, width: '70%', height: 2, background: 'var(--line2)', borderRadius: 2 }} />}
              </div>
              <span style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: '0.1em', fontWeight: erIdag ? 800 : 600, color: erIdag ? ORANSJE : 'var(--tekst-8-alt)', borderBottom: erIdag ? `2px solid ${ORANSJE}` : '2px solid transparent', lineHeight: 1.4 }}>{DAGER[i]}</span>
            </div>
          )
        })}
      </div>
      <p style={{ fontFamily: FONT, fontSize: 11, color: 'var(--tekst-8-alt)', margin: '6px 0 0' }}>
        Stiplet = planlagt · fylt = gjennomført (gul = hardøkt). Strek i barene = planen.
      </p>
    </div>
  )
}
