'use client'

// FORMKARTET bolk 3 - DAGVISNINGEN. Én komponent, to monteringspunkter:
// under formkartet på Oversikt (dagen du klikket) og i ukevisningens
// dagdetalj i dagboka (FormkartDagvisningSelvhentende) - samme mønster som
// plan-grafen og klokke-grafen. Ikke to kopier.
//
// Innhold (fasit tegnDag()): øktene med sonestripe · HRV/hvilepuls/søvn/
// følelse med avvik mot 30-dagers snitt · standplass når dagen har skyting ·
// laktatmålingene med puls og % av terskel. «Se økta» åpner den eksisterende
// WorkoutModal via /app/dagbok?edit= (AVGJORT - ingen ny modal). Manuelt
// førte verdier merkes M og vinner alltid (kilder fra getHelseOversikt).
// Helsefeltene finnes bare i payloaden når leseren har lov (art. 9).

import { useEffect, useState } from 'react'
import { getFormkart } from '@/app/actions/formkart'
import { avvikMot30, treffPct, type Formkart as FormkartData, type FormkartDag } from '@/lib/formkart'
import { ZONE_COLORS_V2 } from '@/lib/activity-summary'
import { ALL_ZONE_NAMES } from '@/lib/heart-zones'
import { minusDager } from '@/lib/helse-vindu'
import { STATUS_GRONN, STATUS_ROD } from '@/lib/status-farger'
import { useHarSkiskyting } from '@/components/sport/BrukerSporter'

const FONT = "'Barlow Condensed', sans-serif"
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const DAGER = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const fmtDato = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return `${DAGER[d.getDay()]} ${d.getDate()}. ${MND[d.getMonth()]}` }
const fmtTid = (sek: number) => { const t = Math.floor(sek / 3600), m = Math.round((sek % 3600) / 60); return `${t ? `${t} t ` : ''}${m} min` }
const k = (v: number, d = 1) => v.toFixed(d).replace('.', ',')

interface Props {
  dag: FormkartDag
  /** Dagene FØR og med dagen, kronologisk - snittet «mot 30 d» regnes på dem. */
  historikk: FormkartDag[]
  helseInkludert: boolean
  harSkyting: boolean
  targetUserId?: string
  /** Under formkartet: lukk-knapp. I dagboka: ingen (dagen velges i uka). */
  onLukk?: () => void
}

export function FormkartDagvisning({ dag, historikk, helseInkludert, harSkyting, targetUserId, onLukk }: Props) {
  const s = dag.status
  const helse = dag.helse
  const h = (f: 'hrv' | 'hvilepuls' | 'sovnTimer' | 'folelse') => historikk.map(d => d.helse?.[f] ?? null)
  const kort: { navn: string; verdi: string | null; avvik: number | null; omvendt: boolean; manuell: boolean; enhet: string }[] = helseInkludert && helse ? [
    { navn: 'HRV', verdi: helse.hrv != null ? String(helse.hrv) : null, enhet: ' ms', avvik: avvikMot30(h('hrv'), helse.hrv), omvendt: false, manuell: helse.kilder.hrv_ms === 'manual' },
    { navn: 'Hvilepuls', verdi: helse.hvilepuls != null ? String(helse.hvilepuls) : null, enhet: '', avvik: avvikMot30(h('hvilepuls'), helse.hvilepuls), omvendt: true, manuell: helse.kilder.resting_hr === 'manual' },
    { navn: 'Søvn', verdi: helse.sovnTimer != null ? k(helse.sovnTimer) : null, enhet: ' t', avvik: avvikMot30(h('sovnTimer'), helse.sovnTimer), omvendt: false, manuell: helse.kilder.total_sleep_minutes === 'manual' },
    { navn: 'Følelse', verdi: helse.folelse != null ? String(helse.folelse) : null, enhet: ' / 5', avvik: avvikMot30(h('folelse'), helse.folelse), omvendt: false, manuell: true },
  ] : []
  const sk = dag.skyting
  const notat = s.sykdom ? 'Sykdom ført denne dagen. Tallene vises, men holdes utenfor snitt og trender.'
    : s.konkurranse ? 'Konkurransedag. Resultatet ligger i konkurransepanelet.'
    : helseInkludert ? 'Manuelt førte verdier vinner alltid over klokka og merkes M.' : 'Helsetallene er skjult - utøveren har ikke delt helsedata.'

  return (
    <section data-formkart-dag={dag.dato} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px 14px' }}>
      <div className="flex items-start gap-3 flex-wrap" style={{ marginBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: FONT, fontWeight: 700, fontSize: 19, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--tekst-1-app)' }}>
            Dagen <span style={{ color: 'var(--tekst-5-app)', fontWeight: 400 }}>- {fmtDato(dag.dato)}</span>
          </h3>
          <p style={{ margin: '3px 0 0', fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)' }}>Trening og helse i ett bilde - samme lager som kartet, ingen ny henting.</p>
        </div>
        {onLukk && <button type="button" onClick={onLukk} className="xp-pill xp-pill-ghost" style={{ marginLeft: 'auto', minHeight: 36 }} data-formkart-dag-lukk>Lukk</button>}
      </div>

      <div className="xp-formkart-daggrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 12 }}>
        <div style={boks}>
          <h4 style={boksH}>Trening</h4>
          {dag.okter.length === 0 ? (
            <p style={{ ...und, margin: 0 }}>{s.sykdom ? 'Sykdom ført - ingen økt.' : s.hviledag ? 'Hviledag - ingen økt ført.' : 'Ingen økt ført.'}</p>
          ) : dag.okter.map(o => {
            const sum = ALL_ZONE_NAMES.reduce((a, z) => a + (o.soneSek[z] ?? 0), 0)
            return (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }} data-formkart-dag-okt={o.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: 'var(--tekst-1-app)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.tittel || 'Økt'}</b>
                  <span style={{ fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-5-app)' }}>
                    {o.gjennomfort ? fmtTid(o.sek) : 'Planlagt, ikke gjennomført'}{s.konkurranse ? ' · konkurranse' : ''}{o.importert ? ` · importert (${o.importert})` : ''}
                  </span>
                </div>
                {sum > 0 && (
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, width: 132, flex: 'none' }} aria-hidden>
                    {ALL_ZONE_NAMES.filter(z => (o.soneSek[z] ?? 0) > 0).map(z => <i key={z} style={{ display: 'block', background: ZONE_COLORS_V2[z], width: `${((o.soneSek[z] ?? 0) / sum * 100).toFixed(1)}%` }} />)}
                  </div>
                )}
                <a href={`${targetUserId ? `/app/trener/utover/${targetUserId}/dagbok` : '/app/dagbok'}?edit=${o.id}`} data-formkart-dag-se className="xp-pill xp-pill-ghost" style={{ minHeight: 32, padding: '0 10px', fontSize: 11 }}>Se økta</a>
              </div>
            )
          })}
          {dag.treningSek > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 12, fontFamily: FONT, fontSize: 12, color: 'var(--tekst-5-app)' }}>
              {ALL_ZONE_NAMES.filter(z => (dag.soneSek[z] ?? 0) > 0).map(z => (
                <span key={z} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 11, height: 11, borderRadius: 3, background: ZONE_COLORS_V2[z], display: 'inline-block' }} />{z} {Math.round((dag.soneSek[z] ?? 0) / 60)} min</span>
              ))}
              {dag.hardOkt && <span style={{ color: '#FF4500' }}>Hardøkt</span>}
              {dag.tsb != null && <span>Form (TSB) {dag.tsb > 0 ? '+' : ''}{Math.round(dag.tsb)}</span>}
            </div>
          )}
        </div>

        <div style={boks}>
          <h4 style={boksH}>Helse og følelse</h4>
          {helseInkludert ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 10 }} data-formkart-dag-helse>
              {kort.map(c => {
                const flat = c.avvik == null || Math.abs(c.avvik) < 0.4
                const bra = c.avvik != null && (c.omvendt ? c.avvik < 0 : c.avvik > 0)
                return (
                  <div key={c.navn} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 10px' }}>
                    <div style={{ fontFamily: FONT, fontSize: 21, fontWeight: 700, lineHeight: 1.1, color: c.verdi == null ? 'var(--tekst-8-app)' : 'var(--tekst-1-app)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {c.verdi != null ? `${c.verdi}${c.enhet}` : '-'}
                      {c.verdi != null && c.manuell && <span title="Manuelt ført - vinner over klokka" style={{ marginLeft: 6, fontSize: 10, letterSpacing: '0.06em', color: 'var(--tekst-5-app)', border: '1px solid var(--line2)', borderRadius: 4, padding: '0 4px', verticalAlign: 'middle' }}>M</span>}
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: 10.5, color: 'var(--tekst-8-app)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{c.navn}</div>
                    <div style={{ fontFamily: FONT, fontSize: 11, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: flat ? 'var(--tekst-5-app)' : bra ? STATUS_GRONN : STATUS_ROD }}>
                      {c.avvik == null ? (c.verdi != null ? 'for lite data' : '') : flat ? `${k(Math.abs(c.avvik))} mot 30 d` : `${c.avvik > 0 ? '↑' : '↓'} ${k(Math.abs(c.avvik))} mot 30 d`}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ ...und, margin: 0 }} data-formkart-dag-helse-skjult>Helsetallene er skjult for deg.</p>
          )}

          {harSkyting && sk && (
            <div data-formkart-dag-skyting>
              <h4 style={{ ...boksH, marginTop: 14 }}>Standplass</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 10 }}>
                <Tall n={sk.liggendeSkudd ? `${Math.round(treffPct(sk.liggendeTreff, sk.liggendeSkudd) ?? 0)} %` : '-'} e="Liggende" />
                <Tall n={sk.staaendeSkudd ? `${Math.round(treffPct(sk.staaendeTreff, sk.staaendeSkudd) ?? 0)} %` : '-'} e="Stående" />
                <Tall n={sk.pulsInn != null ? String(sk.pulsInn) : '-'} e="Puls inn" />
                <Tall n={sk.skytetidSek != null ? `${k(sk.skytetidSek)} s` : '-'} e="Skytetid" />
              </div>
            </div>
          )}

          {dag.laktat.length > 0 && (
            <div data-formkart-dag-laktat>
              <h4 style={{ ...boksH, marginTop: 14 }}>Laktat</h4>
              {dag.laktat.map((m, i) => (
                <div key={i} style={{ padding: '7px 0', borderBottom: i < dag.laktat.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <b style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: 'var(--tekst-1-app)' }}>{k(m.mmol)} mmol</b>
                  <span style={{ display: 'block', fontFamily: FONT, fontSize: 11.5, color: 'var(--tekst-5-app)' }}>
                    {m.puls != null ? `ved ${m.puls} bpm` : 'uten puls'}{m.pctAvTerskel != null && dag.terskelHr != null ? ` · ${k(m.pctAvTerskel)} % av terskel (${dag.terskelHr})` : m.puls != null ? ' · ingen terskel den dagen' : ''}{m.bevegelse ? ` · ${m.bevegelse}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p style={{ ...und, marginTop: 12 }}>{notat}</p>
        </div>
      </div>
    </section>
  )
}

function Tall({ n, e }: { n: string; e: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 10px' }}>
      <div style={{ fontFamily: FONT, fontSize: 21, fontWeight: 700, lineHeight: 1.1, color: n === '-' ? 'var(--tekst-8-app)' : 'var(--tekst-1-app)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{n}</div>
      <div style={{ fontFamily: FONT, fontSize: 10.5, color: 'var(--tekst-8-app)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{e}</div>
    </div>
  )
}

const boks: React.CSSProperties = { background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }
const boksH: React.CSSProperties = { margin: '0 0 10px', fontFamily: FONT, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tekst-5-app)', fontWeight: 700 }
const und: React.CSSProperties = { fontFamily: FONT, fontSize: 12.5, color: 'var(--tekst-5-app)' }

/**
 * Dagboka-monteringen: henter selv 30 dager t.o.m. dagen (til «mot 30 d»)
 * gjennom SAMME action som kartet. Vises bare når dagen har noe å vise.
 */
export function FormkartDagvisningSelvhentende({ dato, targetUserId }: { dato: string; targetUserId?: string }) {
  const nokkel = `${dato}|${targetUserId ?? ''}`
  const [svar, setSvar] = useState<{ nokkel: string; data: FormkartData | null } | null>(null)
  const harSkytingProfil = useHarSkiskyting()
  useEffect(() => {
    let live = true
    const n = `${dato}|${targetUserId ?? ''}`
    getFormkart(minusDager(dato, 29), dato, targetUserId).then(r => { if (live) setSvar({ nokkel: n, data: 'error' in r ? null : r }) }).catch(() => { if (live) setSvar({ nokkel: n, data: null }) })
    return () => { live = false }
  }, [dato, targetUserId])
  const data = svar?.nokkel === nokkel ? svar.data : null
  if (!data) return null
  const dag = data.dager[data.dager.length - 1]
  if (!dag || dag.dato !== dato) return null
  const harNoe = dag.okter.length > 0 || dag.helse != null && (dag.helse.hrv != null || dag.helse.hvilepuls != null || dag.helse.sovnTimer != null || dag.helse.folelse != null) || dag.laktat.length > 0 || dag.skyting != null
  if (!harNoe) return null
  return <FormkartDagvisning dag={dag} historikk={data.dager} helseInkludert={data.helseInkludert} harSkyting={data.harSkyting || harSkytingProfil} targetUserId={targetUserId} />
}
