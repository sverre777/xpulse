'use client'

// De tre popup-innholdene. Alle viser BARE det kortet allerede har lastet —
// ingen nye kall, samme datasett i to detaljnivåer (notat pkt 1).

import type {
  OversiktWorkoutCard, OversiktHealthSummary, OversiktWeekTotals,
} from '@/app/actions/oversikt'
import { KortPopup, PopupSeksjon, PopupTall, Sparkline } from './KortPopup'
import { ZoneBar, fmtHM, COLOR_PRONE, COLOR_STANDING } from './kort-deler'
import type { OversiktShots } from '@/app/actions/oversikt'
import { SPORTS, WORKOUT_TYPES_BASE } from '@/lib/types'

const FONT = "'Barlow Condensed', sans-serif"

/**
 * Treff % LIGGENDE / STÅENDE / TOTALT. Kun-førte per stilling: prosenten
 * deles på skudd der treff faktisk er ført i DEN stillingen. En stilling
 * som ikke er skutt gir «—», aldri 0 % — en nullverdi ville påstått at man
 * bommet på alt. Selvskjulende uten skudd.
 */
function SkyteSplitt({ shots }: { shots: OversiktShots }) {
  const rader = [
    { navn: 'Liggende', farge: COLOR_PRONE, d: shots.prone },
    { navn: 'Stående', farge: COLOR_STANDING, d: shots.standing },
    { navn: 'Totalt', farge: '#F2F2F0', d: shots },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {rader.map(r => (
        <div key={r.navn}
          style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 11px', borderLeft: `2px solid ${r.farge}` }}>
          <div style={{ fontFamily: FONT, fontSize: 8.5, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#55555F' }}>
            {r.navn}
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, marginTop: 6, color: r.d.accuracy_pct != null ? '#F2F2F0' : '#55555F' }}>
            {r.d.accuracy_pct != null ? `${r.d.accuracy_pct} %` : '—'}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: '#55555F', marginTop: 3 }}>
            {r.d.accuracy_pct != null
              ? `${r.d.hits}/${r.d.recorded_shots} treff`
              : r.d.shots > 0 ? `${r.d.shots} skudd · treff ikke ført` : 'ikke skutt'}
          </div>
        </div>
      ))}
    </div>
  )
}
const sportLabel = (v: string) => SPORTS.find(s => s.value === v)?.label ?? v
const typeLabel = (v: string) => WORKOUT_TYPES_BASE.find(t => t.value === v)?.label ?? v
const fmtDato = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })

export function HardoktPopup({ w, onClose }: { w: OversiktWorkoutCard; onClose: () => void }) {
  return (
    <KortPopup
      kicker="Siste hardøkt"
      tittel={w.title}
      undertittel={[
        fmtDato(w.date), sportLabel(w.sport), typeLabel(w.workout_type),
        w.primary_intensity_zone ? `dominerende sone ${w.primary_intensity_zone}` : null,
      ].filter(Boolean).join(' · ')}
      videreHref={`/app/dagbok?edit=${w.id}`}
      videreTekst="Åpne i dagbok"
      onClose={onClose}
    >
      <PopupTall celler={[
        { k: 'Varighet', v: w.effective_duration_minutes != null ? fmtHM(w.effective_duration_minutes * 60) : null },
        { k: 'Distanse', v: w.distance_km != null && w.distance_km > 0 ? w.distance_km.toFixed(1) : null, enhet: 'km' },
        { k: 'Snittpuls', v: w.avg_heart_rate != null ? String(w.avg_heart_rate) : null, enhet: 'bpm' },
        { k: 'Makspuls', v: w.max_heart_rate != null ? String(w.max_heart_rate) : null, enhet: 'bpm' },
      ]} />

      <PopupSeksjon tittel="Soner i økta">
        <ZoneBar zones={w.zones} />
      </PopupSeksjon>

      {w.activities.length > 0 && (
        <PopupSeksjon tittel="Aktiviteter">
          <div className="flex flex-col gap-1">
            {w.activities.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3"
                style={{ fontFamily: FONT, fontSize: 12, color: '#8B8B95', padding: '5px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                <span style={{ color: '#F2F2F0' }}>{a.movement_name || a.activity_type || 'Aktivitet'}</span>
                <span>
                  {a.duration_seconds ? fmtHM(a.duration_seconds) : '—'}
                  {a.distance_meters ? ` · ${(a.distance_meters / 1000).toFixed(1)} km` : ''}
                </span>
              </div>
            ))}
          </div>
        </PopupSeksjon>
      )}

      {/* Selvskjulende: seksjonene under rendres bare når de har noe. */}
      {w.shots && (
        <PopupSeksjon tittel="Treff%">
          <SkyteSplitt shots={w.shots} />
        </PopupSeksjon>
      )}
      {w.lactate_mmol != null && (
        <p style={{ fontFamily: FONT, fontSize: 12, color: '#8B8B95', marginTop: 10 }}>
          Høyeste laktat <b style={{ color: '#F2F2F0' }}>{w.lactate_mmol} mmol</b>
        </p>
      )}
      {w.notes && (
        <PopupSeksjon tittel="Notat">
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: '#C0C0CC', whiteSpace: 'pre-wrap' }}>{w.notes}</p>
        </PopupSeksjon>
      )}
    </KortPopup>
  )
}

export function HelsePopup({ h, onClose }: { h: OversiktHealthSummary; onClose: () => void }) {
  const rader: { navn: string; farge: string; verdi: number | null; snitt: number | null; enhet: string; serie: (number | null)[] }[] = [
    { navn: 'Hvilepuls', farge: '#E23A5A', verdi: h.resting_hr, snitt: h.avg_resting_hr_30d, enhet: 'bpm', serie: h.trend_30d.map(d => d.resting_hr) },
    { navn: 'HRV', farge: '#8B5CF6', verdi: h.hrv_ms, snitt: h.avg_hrv_30d, enhet: 'ms', serie: h.trend_30d.map(d => d.hrv_ms) },
    { navn: 'Søvn', farge: '#1A6FD4', verdi: h.sleep_hours, snitt: h.avg_sleep_30d, enhet: 't', serie: h.trend_30d.map(d => d.sleep_hours) },
  ]
  return (
    <KortPopup
      kicker="Helse"
      tittel="Siste 30 dager"
      // DEKNINGSGRAD (notat pkt 8): et 30-dagers snitt bygget på fire
      // målinger er ingen baseline, og da skal det stå.
      undertittel={`${h.days_logged_30d} av ${h.days_in_window} dager ført`}
      videreHref="/app/analyse?tab=helse"
      videreTekst="Se i analysen"
      onClose={onClose}
    >
      <PopupTall celler={[
        { k: 'Hvilepuls snitt', v: h.avg_resting_hr_30d != null ? String(h.avg_resting_hr_30d) : null, enhet: 'bpm' },
        { k: 'HRV snitt', v: h.avg_hrv_30d != null ? String(h.avg_hrv_30d) : null, enhet: 'ms' },
        { k: 'Søvn snitt', v: h.avg_sleep_30d != null ? h.avg_sleep_30d.toFixed(1) : null, enhet: 't' },
        { k: 'Søvnscore snitt', v: h.avg_sleep_score_30d != null ? String(Math.round(h.avg_sleep_score_30d)) : null },
      ]} />

      {rader.map(r => (
        <PopupSeksjon key={r.navn} tittel={r.navn}>
          <div className="flex items-baseline gap-3" style={{ fontFamily: FONT, fontSize: 12, color: '#8B8B95' }}>
            <span style={{ color: r.verdi != null ? '#F2F2F0' : '#55555F', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>
              {r.verdi != null ? r.verdi : '—'}
            </span>
            <span>{r.enhet} i dag</span>
            <span style={{ marginLeft: 'auto' }}>
              {r.snitt != null ? `30d snitt ${r.snitt} ${r.enhet}` : 'ingen baseline'}
            </span>
          </div>
          <Sparkline verdier={r.serie} farge={r.farge} />
        </PopupSeksjon>
      ))}
    </KortPopup>
  )
}

export function UkePopup({ totals, weekNumber, onClose }: {
  totals: OversiktWeekTotals
  weekNumber: number
  onClose: () => void
}) {
  const c = totals.current
  const p = totals.previous
  // «—» når det ikke finnes en forrige uke å sammenligne med (notat pkt 9):
  // «↑ 100 %» på en uke der forrige var null er ikke en dobling, det er
  // fravær av grunnlag.
  const delta = (naa: number, forrige: number): string | null =>
    forrige > 0 ? `${naa >= forrige ? '↑' : '↓'} ${Math.abs(Math.round(((naa - forrige) / forrige) * 100))} %` : null
  return (
    <KortPopup
      kicker={`Uke ${weekNumber}`}
      tittel="Ukens totaler"
      undertittel={p.workout_count > 0 ? `Forrige uke: ${p.workout_count} økter · ${fmtHM(p.total_seconds)}` : 'Ingen forrige uke å sammenligne med'}
      videreHref="/app/dagbok"
      videreTekst="Åpne dagboken"
      onClose={onClose}
    >
      <PopupTall celler={[
        { k: 'Tid', v: fmtHM(c.total_seconds) },
        { k: 'Distanse', v: c.total_meters > 0 ? (c.total_meters / 1000).toFixed(1) : null, enhet: 'km' },
        { k: 'Økter', v: String(c.workout_count) },
        { k: 'Mot forrige', v: delta(c.total_seconds, p.total_seconds) },
      ]} />

      <PopupSeksjon tittel="Tid per sone">
        <ZoneBar zones={c.zones} />
      </PopupSeksjon>

      {c.shots && (
        <PopupSeksjon tittel={`Treff% · ${c.shots.shots} skudd i uka`}>
          <SkyteSplitt shots={c.shots} />
        </PopupSeksjon>
      )}
    </KortPopup>
  )
}
