'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  hentLeggTilDetaljer, lagreLeggTilDetaljer,
  type LeggTilDetaljerData,
} from '@/app/actions/tidsplassering'
import { SEGMENT_FARGER, fmtKlokkeSek, pulsIVindu } from '@/lib/segmenter'
import { OktKurve, type KurveSerie } from './OktKurve'
import { lagreVindu, hentVindu } from '@/lib/kurve-zoom'
import { type ActivityType, type ShootingSeriesRow, type Sport } from '@/lib/types'
import {
  Verktoypalett, SegmentLag, SegmentHandlinger, etikettFor, segmentTypeFor,
  STANDARD_LENGDE, type Utkast,
} from './TidslinjeRedigering'
import { lagreTidslinje } from '@/app/actions/tidsplassering'
import { PlottTreffPopup } from './PlottTreff'

// «Legg til detaljer» (fase 113, bolk 3): pop-upen. Fasit: design/
// xpulse-tidsplassering-design.html V9.3, seksjon 1 + 2 + NOTAT.
//
// Mental modell: «intervall-byggeren, bare for klokkesynk» — byggeren
// tegner strukturen FØR økta, denne tegner den PÅ den gjennomførte, med
// pulskurven som lerret.
//
// - Draggbart vindu KUN på økter uten runder (avgrensningen er hele
//   poenget — finnes runder: omdøp runden, den har alt).
// - SKYTETID-PORTEN: ført skytetid (serienes time_seconds) = vinduslengde
//   og teller i statistikk; uten ført tid er vinduet en ~40 s
//   puls-markering UTENFOR all skytetid-statistikk. Porten avgjøres av
//   skytetid-feltet alene — drag endrer aldri statistikk-status.
// - Punkter (laktat/ernæring) skriver de EKSISTERENDE feltene
//   (measured_at_time / time_offset_minutes) — aldri parallelle kopier.
// - Rekkefølge = sort_order, ren visning.
//
// Inngangene (to piller) rendres statisk med sida og åpner i samme tick
// (regel 20) — datahentingen skjer først når pop-upen står åpen.


export function LeggTilDetaljerInngang({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
        color: 'var(--accent)', background: 'rgba(255,69,0,.08)',
        border: '1px solid var(--accent)', borderRadius: 999,
        padding: '6px 14px', cursor: 'pointer', minHeight: 32,
      }}>
      ✚ Legg til detaljer
    </button>
  )
}


export function LeggTilDetaljerPopup({
  workoutId, onClose, onLagret, onSerierLagret,
}: {
  workoutId: string
  onClose: () => void
  onLagret: () => void
  /** Videresendes fra «Plott treff» når serier lagres derfra. */
  onSerierLagret?: (lagret: Array<{ activityId: string; serier: ShootingSeriesRow[] }>) => void
}) {
  const [data, setData] = useState<LeggTilDetaljerData | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)

  // Lokal redigeringstilstand — skrives først ved Lagre.
  const [laktatSek, setLaktatSek] = useState<Map<string, number | null>>(new Map())
  const [ernaeringMin, setErnaeringMin] = useState<Map<string, number | null>>(new Map())
  // «Plott treff» åpnes herfra (fasit) — skytingene er nettopp plassert, så
  // AUTO-pulsen er riktig. Lukking returnerer hit med oppdaterte tall.
  const [visPlottTreff, setVisPlottTreff] = useState(false)
  // TIDSLINJA: hele økta som redigerbare segmenter. Klokkas runder er
  // utgangspunktet — de kan flyttes, deles, slås sammen og omdøpes.
  const [utkast, setUtkast] = useState<Utkast[]>([])
  const [slettede, setSlettede] = useState<string[]>([])
  const [valgtSegment, setValgtSegment] = useState<string | null>(null)
  const [palettType, setPalettType] = useState<ActivityType | null>(null)
  // ANGRE (fasiten): hele redigeringsøkten kan angres steg for steg før
  // lagring. Hvert steg legger forrige tilstand på stabelen.
  const [angreStabel, setAngreStabel] = useState<{ utkast: Utkast[]; slettede: string[] }[]>([])

  const endreUtkast = (f: (liste: Utkast[]) => Utkast[]) => {
    setAngreStabel(st => [...st.slice(-49), { utkast, slettede }])
    setUtkast(f(utkast))
  }
  const angre = () => {
    setAngreStabel(st => {
      const forrige = st[st.length - 1]
      if (!forrige) return st
      setUtkast(forrige.utkast)
      setSlettede(forrige.slettede)
      return st.slice(0, -1)
    })
  }
  // Kurvevelger (V9.4): hvilken kurve man plasserer PÅ. Vinduer og punkter
  // er de samme uansett — kun lerretet bytter.
  const [kurve, setKurve] = useState<'puls' | 'fart' | 'watt'>('puls')

  useEffect(() => {
    let avbrutt = false
    hentLeggTilDetaljer(workoutId)
      .then(d => {
        if (avbrutt) return
        setData(d)
        setLaster(false)
        if (d) {
          setLaktatSek(new Map(d.laktat.map(l => [l.id, l.sekunder])))
          setErnaeringMin(new Map(d.ernaering.map(n => [n.id, n.minutter])))
          setUtkast(d.rader
            .filter(r => r.startSek != null && r.sluttSek != null)
            .map(r => ({
              id: r.id, dbId: r.id,
              type: (r.activity_type ?? 'aktivitet') as ActivityType,
              navn: r.navn ?? '',
              bevegelsesform: r.movement_name ?? '',
              startSek: r.startSek!,
              varighetSek: Math.max(1, r.sluttSek! - r.startSek!),
              skytetidSek: r.skytetidSek,
            })))
          if (d.hr.length === 0) setKurve(d.fart.length > 0 ? 'fart' : 'watt')
        }
      })
      .catch(() => { if (!avbrutt) { setLaster(false); setFeil('Kunne ikke laste økta — prøv igjen') } })
    return () => { avbrutt = true }
  }, [workoutId])

  const totalSek = data?.totalSek ?? 0

  const skytingRader = data?.rader.filter(r => (r.activity_type ?? '').startsWith('skyting')) ?? []
  const valgtUtkast = utkast.find(u => u.id === valgtSegment) ?? null
  const naboEtter = valgtUtkast
    ? [...utkast].sort((a, b) => a.startSek - b.startSek)
        .find(u => u.startSek >= valgtUtkast.startSek + valgtUtkast.varighetSek - 1.5 && u.id !== valgtUtkast.id) ?? null
    : null

  /** Legger et nytt segment der brukeren klikket på kurven. */
  const leggInnSegment = (sek: number) => {
    if (!palettType) return
    const lengde = STANDARD_LENGDE[palettType] ?? 120
    const nytt: Utkast = {
      id: `ny-${crypto.randomUUID()}`, dbId: null, type: palettType,
      navn: '', bevegelsesform: '', startSek: Math.max(0, Math.round(sek)),
      varighetSek: lengde, skytetidSek: null,
    }
    endreUtkast(liste => [...liste, nytt])
    setValgtSegment(nytt.id)
    setPalettType(null)
  }

  /** Flytter grensen mellom to naboer — begge endres samtidig (ingen hull). */
  const flyttGrense = (venstreId: string, hoyreId: string, sek: number) => {
    endreUtkast(liste => liste.map(u => {
      if (u.id === venstreId) {
        const ny = Math.max(u.startSek + 5, sek)
        return { ...u, varighetSek: ny - u.startSek }
      }
      if (u.id === hoyreId) {
        const slutt = u.startSek + u.varighetSek
        const ny = Math.min(slutt - 5, Math.max(0, sek))
        return { ...u, startSek: ny, varighetSek: slutt - ny }
      }
      return u
    }))
  }

  const lagre = async () => {
    if (!data) return
    // Klient-validering av overlapp — samme regel som serveren (regel 22),
    // nå over hele tidslinja, ikke bare skytevinduene.
    const sortert = [...utkast].sort((a, b) => a.startSek - b.startSek)
    for (let i = 1; i < sortert.length; i++) {
      const f = sortert[i - 1]
      if (sortert[i].startSek < f.startSek + f.varighetSek - 0.5) {
        setFeil('To segmenter overlapper i tid — flytt eller kort inn det ene')
        return
      }
    }
    setLagrer(true)
    setFeil(null)
    const input = {
      vinduer: [],
      rekkefolge: null,
      laktat: data.laktat
        .filter(l => (laktatSek.get(l.id) ?? null) !== l.sekunder)
        .map(l => ({ id: l.id, sekunder: laktatSek.get(l.id) ?? null })),
      ernaering: data.ernaering
        .filter(n => (ernaeringMin.get(n.id) ?? null) !== n.minutter)
        .map(n => ({ id: n.id, minutter: ernaeringMin.get(n.id) ?? null })),
    }
    const res = await lagreLeggTilDetaljer(workoutId, input)
    if (!res.ok) { setLagrer(false); setFeil(res.error); return }
    // Tidslinja lagres etter punktene: den kan opprette og slette rader,
    // og skal ikke kunne etterlate punkter uten sin rad.
    const tid = await lagreTidslinje(
      workoutId,
      [...utkast].sort((a, b) => a.startSek - b.startSek).map((u, i) => ({
        dbId: u.dbId,
        activityType: u.type,
        bevegelsesform: u.bevegelsesform || null,
        navn: u.navn || null,
        startSek: u.startSek,
        varighetSek: u.varighetSek,
        sortOrder: i,
      })),
      slettede,
    )
    setLagrer(false)
    if (!tid.ok) { setFeil(tid.error); return }
    onLagret()
    onClose()
  }

  const body = (
    <div onClick={onClose}
      style={{
        // z 200: økt-modalen ligger på 100 (samme stige som utstyrsvelgeren).
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'var(--scrim-70)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '5vh', paddingBottom: '5vh', overflow: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--flate-3)', border: '1px solid var(--line2)',
          borderRadius: 14, width: '94%', maxWidth: 640,
        }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--kant-3)' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--tekst-1-app)', fontSize: 22, letterSpacing: '0.08em' }}>
            Legg til detaljer
          </h2>
          {/* Fasit: «Plott treff» ligger synlig HER når økta har skyting —
              man plasserer skytingene i tid og fører treffene uten å lukke.
              Samme komponent som fra knapperaden (regel 11). */}
          {angreStabel.length > 0 && (
            <button type="button" onClick={angre}
              className="ml-auto"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                letterSpacing: '0.1em', fontSize: 12, textTransform: 'uppercase',
                color: 'var(--tekst-1-app)', background: 'none',
                border: '1.5px solid var(--line2)', borderRadius: 999,
                padding: '6px 14px', cursor: 'pointer', minHeight: 34, marginRight: 8,
              }}>
              ↶ Angre
            </button>
          )}
          {skytingRader.length > 0 && (
            <button type="button" onClick={() => setVisPlottTreff(true)}
              className={angreStabel.length > 0 ? 'mr-2' : 'ml-auto mr-2'}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                letterSpacing: '0.1em', fontSize: 12, textTransform: 'uppercase',
                color: '#FF4500', background: 'none', border: '1.5px solid #FF4500',
                borderRadius: 999, padding: '6px 14px', cursor: 'pointer', minHeight: 34,
              }}>
              🎯 Plott treff
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Lukk"
            style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', fontSize: 20, cursor: 'pointer', minWidth: 36, minHeight: 36 }}>
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {laster && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)', fontSize: 14 }}>
              Laster kurven …
            </p>
          )}
          {!laster && (!data || (data.hr.length === 0 && data.fart.length === 0 && data.watt.length === 0)) && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14 }}>
              Økta mangler pulskurve — «Legg til detaljer» trenger klokkesynkede sekund-data.
            </p>
          )}

          {data && (data.hr.length > 0 || data.fart.length > 0 || data.watt.length > 0) && (
            <>
              {(() => {
                const valg = ([
                  ['puls', 'Puls', data.hr.length] as const,
                  ['fart', 'Fart', data.fart.length] as const,
                  ['watt', 'Watt', data.watt.length] as const,
                ]).filter(([, , n]) => n > 0)
                // Kurver uten data vises ikke — aldri en tom fane (V9.4).
                if (valg.length < 2) return null
                return (
                  <div className="flex gap-1.5">
                    {valg.map(([id, navn]) => (
                      <button key={id} type="button" onClick={() => setKurve(id)}
                        className="text-xs tracking-widest uppercase"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                          color: kurve === id ? KURVE_FARGER[id] : 'var(--tekst-8-alt)',
                          background: 'none',
                          border: `1px solid ${kurve === id ? KURVE_FARGER[id] : 'var(--kant-3)'}`,
                          borderRadius: 999, padding: '4px 12px', cursor: 'pointer', minHeight: 30,
                        }}>
                        {navn}
                      </button>
                    ))}
                  </div>
                )
              })()}
              <KurveMedVinduer
                workoutId={workoutId}
                utkast={utkast}
                valgtSegment={valgtSegment}
                palettAktiv={palettType != null}
                onVelgSegment={setValgtSegment}
                onEndreSegment={(id, patch) => endreUtkast(liste =>
                  liste.map(u => u.id === id ? { ...u, ...patch } : u))}
                onGrense={flyttGrense}
                onLeggInn={leggInnSegment}
                hr={data.hr}
                fart={data.fart}
                watt={data.watt}
                hoyde={data.hoyde}
                kurve={kurve}
                sport={data.sport}
                totalSek={totalSek}
                laktat={data.laktat}
                ernaering={data.ernaering}
                laktatSek={laktatSek}
                ernaeringMin={ernaeringMin}
                onLaktat={(id, sek) => setLaktatSek(m => new Map(m).set(id, sek))}
                onErnaering={(id, min) => setErnaeringMin(m => new Map(m).set(id, min))}
              />

              {/* ── TIDSLINJA (LTD-A) ──
                  Den gamle avgrensningen «kun økter uten runder» er
                  OPPHEVET: alle typer kan plasseres og redigeres i tid,
                  også når klokka har levert runder. */}
              <Verktoypalett
                sport={(data.sport ?? null) as Sport | null}
                userHasBiathlon={data.rader.some(r => (r.activity_type ?? '').startsWith('skyting')) || data.sport === 'biathlon'}
                valgtType={palettType}
                onVelg={setPalettType}
              />

              {valgtUtkast && (
                <SegmentHandlinger
                  valgt={valgtUtkast}
                  alle={utkast}
                  userHasBiathlon={data.sport === 'biathlon'}
                  sport={(data.sport ?? null) as Sport | null}
                  onDel={() => endreUtkast(liste => {
                    const u = liste.find(x => x.id === valgtUtkast.id)
                    if (!u || u.varighetSek < 10) return liste
                    const halv = Math.round(u.varighetSek / 2)
                    const nytt: Utkast = {
                      ...u, id: `ny-${crypto.randomUUID()}`, dbId: null,
                      startSek: u.startSek + halv, varighetSek: u.varighetSek - halv,
                      navn: '', skytetidSek: null,
                    }
                    return liste.map(x => x.id === u.id ? { ...x, varighetSek: halv } : x).concat(nytt)
                  })}
                  onSlaaSammen={naboEtter ? () => endreUtkast(liste => {
                    const u = liste.find(x => x.id === valgtUtkast.id)!
                    const n = liste.find(x => x.id === naboEtter.id)!
                    if (n.dbId) setSlettede(s2 => [...s2, n.dbId!])
                    return liste
                      .filter(x => x.id !== n.id)
                      .map(x => x.id === u.id
                        ? { ...x, varighetSek: (n.startSek + n.varighetSek) - u.startSek }
                        : x)
                  }) : null}
                  onNavn={navn => endreUtkast(liste => liste.map(x => x.id === valgtUtkast.id ? { ...x, navn } : x))}
                  onType={t => endreUtkast(liste => liste.map(x => x.id === valgtUtkast.id ? { ...x, type: t } : x))}
                  onSlett={() => endreUtkast(liste => {
                    if (valgtUtkast.dbId) setSlettede(s2 => [...s2, valgtUtkast.dbId!])
                    setValgtSegment(null)
                    return liste.filter(x => x.id !== valgtUtkast.id)
                  })}
                />
              )}

              {/* ── AKTIVITETSRADENE — oppdateres mens du drar ──
                  Radene og kurven er ÉN visning av samme data: drar man et
                  segment, endres raden i samme øyeblikk, og klikker man en
                  rad velges segmentet på kurven. */}
              {utkast.length > 0 && (
                <div className="space-y-1">
                  <Overskrift>Aktivitetsradene — oppdateres mens du drar</Overskrift>
                  {[...utkast].sort((a, b) => a.startSek - b.startSek).map(u => {
                    const valgt = valgtSegment === u.id
                    const farge = SEGMENT_FARGER[segmentTypeFor(u.type, u.bevegelsesform)]
                    const puls = pulsIVindu(data.hr, u.startSek, u.startSek + u.varighetSek)
                    return (
                      <button key={u.id} type="button"
                        onClick={() => setValgtSegment(valgt ? null : u.id)}
                        className="w-full flex items-center gap-3 flex-wrap text-left"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5,
                          color: 'var(--tekst-5-app)', background: valgt ? 'var(--flate-12-alt)' : 'none',
                          border: `1px solid ${valgt ? farge : 'var(--kant-3)'}`,
                          borderLeft: `3px solid ${farge}`,
                          borderRadius: 8, padding: '8px 10px', minHeight: 40, cursor: 'pointer',
                        }}>
                        <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{etikettFor(u, utkast)}</b>
                        <span>{fmtKlokkeSek(u.startSek)}–{fmtKlokkeSek(u.startSek + u.varighetSek)} ⌚</span>
                        <span style={{ color: 'var(--tekst-8-alt)' }}>{fmtKlokkeSek(u.varighetSek)}</span>
                        {puls.snitt != null && (
                          <span className="ml-auto" style={{ color: 'var(--tekst-8-alt)' }}>snitt {puls.snitt}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* ── Punkter ── */}
              {(data.laktat.length > 0 || data.ernaering.length > 0) && (
                <div className="space-y-2">
                  <Overskrift>Punkter på kurven</Overskrift>
                  {data.laktat.map(l => {
                    const sek = laktatSek.get(l.id) ?? null
                    return (
                      <PunktRad key={l.id}
                        farge="#E23A5A"
                        navn={`Laktat ${String(l.mmol).replace('.', ',')} mmol`}
                        tid={sek != null ? fmtKlokkeSek(sek) : null}
                        onPlasser={() => setLaktatSek(m => new Map(m).set(l.id, Math.round(totalSek / 2)))}
                        onFjern={() => setLaktatSek(m => new Map(m).set(l.id, null))}
                      />
                    )
                  })}
                  {data.ernaering.map(n => {
                    const min = ernaeringMin.get(n.id) ?? null
                    return (
                      <PunktRad key={n.id}
                        farge="#FFB300"
                        navn={`Ernæring — ${n.type}${n.carbs_g != null ? ` (${n.carbs_g} g)` : ''}`}
                        tid={min != null ? fmtKlokkeSek(min * 60) : null}
                        onPlasser={() => setErnaeringMin(m => new Map(m).set(n.id, Math.round(totalSek / 120)))}
                        onFjern={() => setErnaeringMin(m => new Map(m).set(n.id, null))}
                      />
                    )
                  })}
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>
                    Punktene er målingene du allerede har ført — her får de bare et tidspunkt.
                    Nye målinger føres i redigeringen som før.
                  </p>
                </div>
              )}

              {/* Rekkefølgen (sort_order) følger nå TIDEN: hvert segment har
                  en eksplisitt plassering, så en manuell rekkefølge ville
                  kunne motsi tidslinja — og to skrivere av samme kolonne kan
                  ikke begge ha rett. Den gamle drag-lista er derfor fjernet;
                  lagringen sorterer på starttid. */}
            </>
          )}

          {feil && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: '#E23A5A' }}>
              {feil}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--kant-3)' }}>
          <button type="button" onClick={onClose} className="xp-pill xp-pill-ghost">
            Avbryt
          </button>
          <button type="button" onClick={lagre} disabled={lagrer || !data}
            className="xp-pill xp-pill-primary">
            {lagrer ? 'Lagrer …' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return (
    <>
      {createPortal(body, document.body)}
      {visPlottTreff && (
        <PlottTreffPopup
          workoutId={workoutId}
          onClose={() => setVisPlottTreff(false)}
          onLagret={lagret => {
            // Skytetiden er PORTEN — den kan nettopp ha endret seg. Patches
            // lokalt fra det som ble lagret, så vindus-dragene brukeren har
            // gjort her ikke kastes av en re-henting.
            setData(d => d && ({
              ...d,
              rader: d.rader.map(r => {
                const t = lagret.find(l => l.activityId === r.id)
                if (!t) return r
                const sum = t.serier.reduce((n, s) => {
                  const v = parseFloat(String(s.time_seconds).replace(',', '.'))
                  return Number.isFinite(v) ? n + v : n
                }, 0)
                return { ...r, skytetidSek: sum > 0 ? sum : null }
              }),
            }))
            onSerierLagret?.(lagret)
          }}
        />
      )}
    </>
  )
}

// ── Kurven med draggbare vinduer og punkter ─────────────────
// Lerretet kan være puls, fart eller watt (V9.4) — vinduer og punkter er
// de samme uansett valg. Høyde tegnes som stille bakgrunnsprofil når den
// finnes (målt 29. aug: altitude_samples er punkt-for-punkt-kurve i 69 av
// 89 samples-rader). Leser-raden viser snittpuls OG snittfart samtidig,
// uavhengig av valgt lerret.

const KURVE_HOYDE = 190

// Samme fargefasit som økt-grafen (design/xpulse-oktgraf-design.html):
// puls #E23A5A · tempo/fart #28A86E · watt #E8B93C. Da motoren ble delt,
// måtte fargene bli det også — to ulike puls-farger for samme kurve er
// nettopp den slags avvik regel 11 finnes for.
export const KURVE_FARGER = {
  puls: '#E23A5A',
  fart: '#28A86E',
  watt: '#E8B93C',
} as const

type KurveValg = keyof typeof KURVE_FARGER

function KurveMedVinduer({
  workoutId, utkast, valgtSegment, palettAktiv, onVelgSegment, onEndreSegment, onGrense, onLeggInn,
  hr, fart, watt, hoyde, kurve, sport, totalSek,
  laktat, ernaering, laktatSek, ernaeringMin,
  onLaktat, onErnaering,
}: {
  workoutId: string
  utkast: Utkast[]
  valgtSegment: string | null
  palettAktiv: boolean
  onVelgSegment: (id: string | null) => void
  onEndreSegment: (id: string, patch: { startSek?: number; varighetSek?: number }) => void
  onGrense: (venstreId: string, hoyreId: string, sek: number) => void
  onLeggInn: (sek: number) => void
  hr: Array<{ t: number; hr: number }>
  fart: Array<{ t: number; mps: number }>
  watt: Array<{ t: number; w: number }>
  hoyde: Array<{ t: number; alt: number }>
  kurve: KurveValg
  sport: string | null
  totalSek: number
  laktat: Array<{ id: string; mmol: number }>
  ernaering: Array<{ id: string; type: string }>
  laktatSek: Map<string, number | null>
  ernaeringMin: Map<string, number | null>
  onLaktat: (id: string, sek: number) => void
  onErnaering: (id: string, min: number) => void
}) {
  const boks = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ slag: 'laktat' | 'ernaering'; id: string } | null>(null)

  // LTD tegner IKKE lenger sin egen kurve — den bruker OktKurve, samme
  // motor som økt-grafen (regel 11/21: den håndtegnede SVG-en her var
  // hele begrunnelsen for å forlate recharts, og er nå slettet). Zoom-
  // nivået deles med grafen gjennom lib/kurve-zoom.
  const kurveSerier: KurveSerie[] = useMemo(() => {
    const ut: KurveSerie[] = []
    if (hr.length > 0) ut.push({
      id: 'puls', navn: 'Puls', farge: KURVE_FARGER.puls,
      punkter: hr.map(p => ({ t: p.t, v: p.hr })), format: (v: number) => `${Math.round(v)}`,
    })
    if (fart.length > 0) ut.push({
      id: 'fart', navn: 'Fart', farge: KURVE_FARGER.fart,
      punkter: fart.map(p => ({ t: p.t, v: p.mps })),
      format: (v: number) => fmtFartVerdi(v, sport),
    })
    if (watt.length > 0) ut.push({
      id: 'watt', navn: 'Watt', farge: KURVE_FARGER.watt,
      punkter: watt.map(p => ({ t: p.t, v: p.w })), format: (v: number) => `${Math.round(v)}`,
    })
    if (hoyde.length > 2) ut.push({
      id: 'hoyde', navn: 'Høyde', farge: 'var(--tekst-5-app)',
      punkter: hoyde.map(p => ({ t: p.t, v: p.alt })), format: (v: number) => `${Math.round(v)}`,
      somAreal: true,
    })
    return ut
  }, [hr, fart, watt, hoyde, sport])

  const [vindu, setVindu] = useState<[number, number] | null>(
    () => hentVindu(workoutId),
  )

  const sekFraAndelRef = useRef<(a: number) => number>(a => a * totalSek)

  // Drag av PUNKTER (laktat/ernæring). Segmentene håndteres av
  // SegmentLag — de har sine egne håndtak og grensehåndtak.
  const paaFlytt = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const el = boks.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const andel = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)))
    const sek = Math.round(sekFraAndelRef.current(andel))
    if (d.slag === 'laktat') { onLaktat(d.id, sek); return }
    if (d.slag === 'ernaering') { onErnaering(d.id, Math.round(sek / 60)) }
  }

  return (
    <div>
      <OktKurve
        serier={kurveSerier}
        paaIds={kurveSerier.filter(x => x.id === kurve || x.somAreal).map(x => x.id)}
        fokusId={kurve}
        totalSek={totalSek}
        hoyde={KURVE_HOYDE}
        vindu={vindu ?? undefined}
        onKlikk={sek => { if (palettAktiv) onLeggInn(sek) }}
        onVindu={v => {
          const heleOkta = v[0] <= 0.5 && v[1] >= totalSek - 0.5
          setVindu(heleOkta ? null : v)
          lagreVindu(workoutId, heleOkta ? [0, totalSek] : v)
        }}
        overlay={h => {
          sekFraAndelRef.current = h.sekFraAndel
          const pct = h.pct
          const verdiYPct = (t: number) => h.yPctForSerie(kurve, t)
          return (
      <div ref={boks}
        onPointerMove={paaFlytt}
        onPointerUp={() => { drag.current = null }}
        onPointerLeave={() => { drag.current = null }}
        style={{ position: 'absolute', inset: 0, cursor: palettAktiv ? 'copy' : undefined }}>
        <SegmentLag
          palettAktiv={palettAktiv}
          utkast={utkast}
          valgtId={valgtSegment}
          h={h}
          totalSek={totalSek}
          onVelg={onVelgSegment}
          onEndre={onEndreSegment}
          onGrense={onGrense}
        />
        {/* Punkter: draggbare prikker PÅ kurven. */}
        {laktat.map(l => {
          const sek = laktatSek.get(l.id) ?? null
          if (sek == null) return null
          return (
            <button key={l.id} type="button"
              aria-label={`Laktat ${l.mmol} mmol — dra for å flytte`}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture?.(e.pointerId)
                drag.current = { slag: 'laktat', id: l.id }
              }}
              style={{
                position: 'absolute', left: pct(sek), top: verdiYPct(sek),
                transform: 'translate(-50%, -50%)',
                width: 14, height: 14, borderRadius: '50%', padding: 0,
                background: '#E23A5A', border: '2px solid var(--flate-3)',
                cursor: 'grab', touchAction: 'none',
              }} />
          )
        })}
        {ernaering.map(n => {
          const min = ernaeringMin.get(n.id) ?? null
          if (min == null) return null
          return (
            <button key={n.id} type="button"
              aria-label={`Ernæring ${n.type} — dra for å flytte`}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture?.(e.pointerId)
                drag.current = { slag: 'ernaering', id: n.id }
              }}
              style={{
                position: 'absolute', left: pct(min * 60), top: verdiYPct(min * 60),
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: 12, height: 12, padding: 0,
                background: '#FFB300', border: '2px solid var(--flate-3)',
                cursor: 'grab', touchAction: 'none',
              }} />
          )
        })}
      </div>
          )
        }}
      />


      {/* Live-leser for VALGT SEGMENT: puls og fart samtidig. */}
      {(() => {
        const v = utkast.find(u => u.id === valgtSegment)
        if (!v) return null
        const puls = pulsIVindu(hr, v.startSek, v.startSek + v.varighetSek)
        const snittFart = snittIVindu(
          fart.map(p2 => ({ t: p2.t, v: p2.mps })), v.startSek, v.startSek + v.varighetSek,
        )
        return (
          <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-5-app)' }}>
            <b>{etikettFor(v, utkast)}</b>
            {' '}{fmtKlokkeSek(v.startSek)}–{fmtKlokkeSek(v.startSek + v.varighetSek)}
            {' · varighet '}<b>{fmtKlokkeSek(v.varighetSek)}</b>
            {puls.snitt != null
              ? <>{' · puls snitt '}<b>{puls.snitt}</b>{puls.inn != null ? <>{' · inn '}<b>{puls.inn}</b></> : null}</>
              : <>{' · puls: for lite data'}</>}
            {snittFart != null && <>{' · fart '}<b>{fmtFartVerdi(snittFart, sport)}</b></>}
            {v.type.startsWith('skyting') && (
              <span style={{ color: 'var(--tekst-8-alt)' }}>
                {' · '}{v.skytetidSek != null
                  ? `ført skytetid ${fmtKlokkeSek(v.skytetidSek)} — teller i statistikken`
                  : 'kun puls-markering — utenfor skytetid-statistikk'}
              </span>
            )}
          </p>
        )
      })()}
    </div>
  )
}

/** Snitt av en generisk {t, v}-serie i [start, slutt] — null under 2 punkter. */
function snittIVindu(serie: Array<{ t: number; v: number }>, startSek: number, sluttSek: number): number | null {
  let sum = 0, n = 0
  for (const p of serie) {
    if (p.t < startSek) continue
    if (p.t > sluttSek) break
    sum += p.v; n++
  }
  return n < 2 ? null : sum / n
}

function fmtFartVerdi(mps: number, sport: string | null): string {
  if (sport === 'cycling' || sport === 'triathlon') return `${(mps * 3.6).toFixed(1)} km/t`
  if (mps <= 0.1) return '—'
  const sekPerKm = 1000 / mps
  const m = Math.floor(sekPerKm / 60)
  const sek = Math.round(sekPerKm % 60)
  return `${m}:${String(sek).padStart(2, '0')}/km`
}

// ── Småting ──────────────────────────────────────────────────

function Overskrift({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs tracking-widest uppercase"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
      {children}
    </p>
  )
}

function PunktRad({
  farge, navn, tid, onPlasser, onFjern,
}: {
  farge: string
  navn: string
  tid: string | null
  onPlasser: () => void
  onFjern: () => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-5-app)' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: farge }} />
      <span style={{ minWidth: 150 }}>{navn}</span>
      {tid ? (
        <>
          <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600 }}>{tid}</b>
          <span style={{ fontSize: 12.5, color: 'var(--tekst-8-alt)' }}>dra prikken på kurven for å flytte</span>
          <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={onFjern}>
            Fjern tidspunkt
          </button>
        </>
      ) : (
        <button type="button" className="xp-pill xp-pill-ghost" style={{ padding: '4px 12px', fontSize: 12 }}
          onClick={onPlasser}>
          Plasser på kurven
        </button>
      )}
    </div>
  )
}

