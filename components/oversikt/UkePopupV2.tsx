'use client'

// Ukens totaler «Vis mer» v2 (Sverre 5. sep: «må faktisk vise mer enn kortet
// — bev.form, soner, belastning osv, og en del med månedens totaler»).
// Lesing. Alt kommer fra Hjems ene henting (bolk 0 + ukeDetaljer).

import type { OversiktWeekTotals, OversiktUkePlan, OversiktUkeDetaljer } from '@/app/actions/oversikt'
import { beregnSoneTss } from '@/lib/belastning'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { SPORTS } from '@/lib/types'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'
import { KortPopup, PopupSeksjon, PopupTall } from './KortPopup'
import { ZoneBar, fmtHM, COLOR_PRONE, COLOR_STANDING } from './kort-deler'
import { UkePlanVsGjennomfort } from './UkePlanVsGjennomfort'

const FONT = "'Barlow Condensed', sans-serif"
const UKEDAG = ['sø', 'ma', 'ti', 'on', 'to', 'fr', 'lø']
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
function fmtDato(iso: string): string { const d = new Date(iso + 'T00:00:00'); return `${UKEDAG[d.getDay()]} ${d.getDate()}. ${MND[d.getMonth()]}` }
function fmtKm(m: number): string { return m > 0 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : '—' }
function sportLabel(v: string): string { return SPORTS.find(s => s.value === v)?.label ?? v }
function delta(naa: number, forrige: number): string | null {
  return forrige > 0 ? `${naa >= forrige ? '↑' : '↓'} ${Math.abs(Math.round(((naa - forrige) / forrige) * 100))} %` : null
}
const tekst: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-3-app)' }
const tall: React.CSSProperties = { fontFamily: FONT, fontSize: 13, color: 'var(--tekst-1-app)', fontVariantNumeric: 'tabular-nums' }

export function UkePopupV2({ totals, plan, detaljer, weekNumber, todayISO, onClose }: {
  totals: OversiktWeekTotals
  plan: OversiktUkePlan
  detaljer: OversiktUkeDetaljer
  weekNumber: number
  todayISO: string
  onClose: () => void
}) {
  const harSki = useHarSkiskyting()
  const c = totals.current, p = totals.previous
  const tss = Math.round(beregnSoneTss(c.zones))
  const hardSek = c.zones.I3 + c.zones.I4 + c.zones.I5 + c.zones.I6 + c.zones.I7 + c.zones.I8 + c.zones.Hurtighet
  const m = detaljer.maaned
  const bevMaks = Math.max(1, ...detaljer.bevFordeling.map(b => b.sek))
  return (
    <KortPopup kicker={`Uke ${weekNumber}`} tittel="Ukens totaler"
      undertittel={p.workout_count > 0 ? `Forrige uke: ${p.workout_count} økter · ${fmtHM(p.total_seconds)}` : 'Ingen forrige uke å sammenligne med'}
      videreHref="/app/dagbok" videreTekst="Åpne dagboken" onClose={onClose} bred>
      <div data-uke-popup>
        <PopupTall celler={[
          { k: 'Tid', v: fmtHM(c.total_seconds) },
          { k: 'Distanse', v: c.total_meters > 0 ? (c.total_meters / 1000).toFixed(1).replace('.', ',') : null, enhet: 'km' },
          { k: 'Økter', v: String(c.workout_count) },
          { k: 'Hard (I3+)', v: hardSek > 0 ? fmtHM(hardSek) : null },
          { k: 'Belastning', v: tss > 0 ? String(tss) : null, enhet: 'TSS' },
          { k: 'Mot forrige', v: delta(c.total_seconds, p.total_seconds) },
        ]} />

        <div className="xp-popup-to" style={{ marginTop: 4 }}>
          <div>
            <PopupSeksjon tittel="Tid per sone">
              <ZoneBar zones={c.zones} />
            </PopupSeksjon>
            <PopupSeksjon tittel="Plan vs gjennomført">
              <div style={{ marginTop: -12 }}>
                <UkePlanVsGjennomfort plan={plan} todayISO={todayISO} harSki={harSki} />
              </div>
            </PopupSeksjon>
            {detaljer.bevFordeling.length > 0 && (
              <PopupSeksjon tittel="Bevegelsesformer">
                <div className="flex flex-col gap-2" data-uke-bevformer>
                  {detaljer.bevFordeling.map(b => (
                    <div key={b.navn} data-uke-bevform={b.navn} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px', alignItems: 'center', gap: 8 }}>
                      <span style={{ ...tekst, color: 'var(--tekst-1-app)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.navn}</span>
                      <span style={{ height: 8, borderRadius: 999, background: 'var(--flate-12-alt)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${Math.round((b.sek / bevMaks) * 100)}%`, background: 'var(--accent)', borderRadius: 999, opacity: 0.85 }} />
                      </span>
                      <span style={{ ...tall, textAlign: 'right' }}>{fmtHM(b.sek)}{b.km > 0 ? <span style={{ color: 'var(--tekst-8-alt)' }}> · {fmtKm(b.km * 1000)}</span> : null}</span>
                    </div>
                  ))}
                </div>
              </PopupSeksjon>
            )}
          </div>
          <div>
            {detaljer.okter.length > 0 && (
              <PopupSeksjon tittel={`Økter i uka · ${detaljer.okter.length}`}>
                <div className="flex flex-col" data-uke-okter>
                  {detaljer.okter.map(o => {
                    const sone = o.primary_intensity_zone
                    return (
                      <a key={o.id} href={`/app/dagbok?edit=${o.id}`} data-uke-okt={o.id} className="flex items-center gap-3" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'inherit' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: sone ? ZONE_COLORS_V2[sone as keyof typeof ZONE_COLORS_V2] : 'var(--line2)', flexShrink: 0 }} />
                        <span style={{ ...tekst, width: 58, flexShrink: 0 }}>{fmtDato(o.date)}</span>
                        <span style={{ ...tall, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{o.title}<span style={{ fontWeight: 500, color: 'var(--tekst-8-alt)' }}> · {sportLabel(o.sport)}</span></span>
                        <span style={{ ...tall, flexShrink: 0 }}>{o.duration_minutes != null ? fmtHM(o.duration_minutes * 60) : '—'}</span>
                        <span style={{ ...tekst, width: 34, textAlign: 'right', flexShrink: 0 }}>{o.avg_heart_rate ?? '—'}</span>
                      </a>
                    )
                  })}
                </div>
              </PopupSeksjon>
            )}
            {harSki && c.shots && c.shots.shots > 0 && (
              <PopupSeksjon tittel={`Skyting · ${c.shots.hits}/${c.shots.recorded_shots || c.shots.shots}`}>
                <div className="flex gap-4 flex-wrap" data-uke-skyting>
                  <span style={tekst}><b style={{ color: COLOR_PRONE }}>Ligg</b> {c.shots.prone.hits}/{c.shots.prone.recorded_shots || c.shots.prone.shots}{c.shots.prone.accuracy_pct != null ? ` · ${c.shots.prone.accuracy_pct} %` : ''}</span>
                  <span style={tekst}><b style={{ color: COLOR_STANDING }}>Stå</b> {c.shots.standing.hits}/{c.shots.standing.recorded_shots || c.shots.standing.shots}{c.shots.standing.accuracy_pct != null ? ` · ${c.shots.standing.accuracy_pct} %` : ''}</span>
                  <span style={tekst}>Totalt <b style={{ color: 'var(--tekst-1-app)' }}>{c.shots.accuracy_pct != null ? `${c.shots.accuracy_pct} %` : '—'}</b> · {c.shots.shots} skudd</span>
                </div>
              </PopupSeksjon>
            )}
          </div>
        </div>

        <PopupSeksjon tittel={`${m.navn} hittil · måneden`}>
          <div data-uke-maaned>
            <PopupTall celler={[
              { k: 'Tid', v: fmtHM(m.total_seconds) },
              { k: 'Distanse', v: m.total_meters > 0 ? (m.total_meters / 1000).toFixed(1).replace('.', ',') : null, enhet: 'km' },
              { k: 'Økter', v: String(m.workout_count) },
              { k: 'Hard (I3+)', v: m.hard_seconds > 0 ? fmtHM(m.hard_seconds) : null },
              { k: 'Belastning', v: m.tss > 0 ? String(Math.round(m.tss)) : null, enhet: 'TSS' },
              { k: 'Mot forrige mnd', v: delta(m.total_seconds, m.forrige_total_seconds) },
            ]} />
            <div style={{ marginTop: 8 }}><ZoneBar zones={m.zones} /></div>
          </div>
        </PopupSeksjon>
      </div>
    </KortPopup>
  )
}
