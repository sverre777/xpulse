'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  hentOktbygger, lagreOktbyggerPunkter, lagreTidslinje,
  type OktbyggerData,
} from '@/app/actions/tidsplassering'
import {
  SEGMENT_FARGER, segmentBakgrunn, segmentTypeFor, fmtKlokkeSek, pulsIVindu,
} from '@/lib/segmenter'
import { etikettFor, type Utkast } from '@/lib/oktbygger-rader'
import { xpConfirm } from '@/components/ui/ConfirmDialog'
import { OktKurve, type KurveSerie, type KurveHjelpere } from './OktKurve'
import { BlokkLerret } from './BlokkLerret'
import { RundeValg } from './RundeValg'
import { PlanSpokelse, VisPlanBryter } from './PlanSpokelse'
import { hentPlanensRunder, type PlanBlokk } from '@/app/actions/runder'
import { visPlanBak, settVisPlanBak, VIS_PLAN_HENDELSE } from '@/lib/vis-plan'
import { ByggSum } from './ByggSum'
import { lagreVindu, hentVindu } from '@/lib/kurve-zoom'
import {
  ACTIVITY_TYPES, PAUSE_TYPER,
  type ActivityRow, type ActivityType, type ShootingSeriesRow, type Sport,
} from '@/lib/types'
import { IntervallBygger } from './IntervallBygger'
import { PlottTreffPopup } from './PlottTreff'

// ØKTBYGGEREN — omlegging v6. Erstatter «Legg til detaljer».
//
// Drag-modellen er forkastet (Sverre 2. sep: «drag and drop funker
// dårlig»). Tilbake til det som virker — RADENE — pluss enkle ting på
// grafen. Byggeren er ÉN knapp overalt (plan og dagbok, med og uten
// klokke), og inni ligger:
//   · HURTIGOPPSETTET (antall × dragtid × sone / pause) — uendret,
//     lib/intervall-generator som før. Radene går rett i skjemaet.
//   · KURVEN som lesevisning med radene som bånd, og radlista som
//     editor: start/varighet som TALL, del/slå sammen/slett/type/navn
//     som knapper i raden. Ingen håndtak, ingen palett, ingen drag.
//   · PUNKTENE (laktat/ernæring) får tidspunkt som tall eller «plasser».
//
// Kutt ved klikk (bolk 3), match mot kurven (bolk 3b) og punkt-modus
// (bolk 8) bygges oppå dette — bolk 0 er ryddingen.
//
// Lagringen er den samme som før: lagreTidslinje skriver plasseringen og
// LESER pulsen fra hvert vindu, aldri arvet. Angre steg for steg og
// «lukke uten å lagre?» står.

export function OktbyggerInngang({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
        color: 'var(--accent)', background: 'rgba(255,69,0,.08)',
        border: '1px solid var(--accent)', borderRadius: 999,
        padding: '6px 14px', cursor: 'pointer', minHeight: 32,
      }}>
      ⚡ Øktbygger
    </button>
  )
}

export function OktbyggerPopup({
  workoutId, sport, onClose, onLagret, onSerierLagret, onOpprett,
}: {
  /** null = økta er ikke lagret ennå: bare hurtigoppsettet er tilgjengelig. */
  workoutId: string | null
  sport?: Sport
  onClose: () => void
  onLagret?: () => void
  /** Videresendes fra «Plott treff» når serier lagres derfra. */
  onSerierLagret?: (lagret: Array<{ activityId: string; serier: ShootingSeriesRow[] }>) => void
  /** Hurtigoppsettet leverer genererte rader + forslags-tittel. Skjemaet
      eier innsettingen (og bekreftelsen hvis lista alt har innhold). Uten
      denne (øktas hovedside) vises ikke hurtigoppsettet. */
  onOpprett?: (rader: ActivityRow[], tittel: string) => void | Promise<void>
}) {
  const [data, setData] = useState<OktbyggerData | null>(null)
  const [laster, setLaster] = useState(!!workoutId)
  // Bytter man runder (bolk 6) er HELE grunnlaget nytt — radene, vinduene
  // og pulsen per runde. Da lastes økta på nytt i stedet for å lappe på
  // et utkast som beskriver rader som ikke finnes lenger.
  const [lastTick, setLastTick] = useState(0)
  // Planen som spøkelse bak det som faktisk skjedde (bolk 7). Valget bor i
  // localStorage (lib/vis-plan) og leses som ekstern kilde: serveren vet
  // ikke hva som er valgt, så snapshotet der er «av».
  const [planBlokker, setPlanBlokker] = useState<PlanBlokk[]>([])
  const visPlan = useSyncExternalStore(abonnerVisPlan, visPlanBak, () => false)
  // Rundebyttet skriver DIREKTE til basen (det er ikke et utkast), men
  // flatene bak skal ikke lastes på nytt midt i arbeidet: gjør de det,
  // rives byggeren ned, og valget kan ikke angres der og da — som det
  // skal kunne. Beskjeden til foreldreflata utsettes derfor til lukking.
  const [rundeneErByttet, setRundeneErByttet] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  // Hurtigoppsettet: åpent når det er det eneste som finnes (ulagret økt),
  // ellers sammenslått så kurven og radene står øverst.
  const [hurtigAapent, setHurtigAapent] = useState(!workoutId)

  // Lokal redigeringstilstand — skrives først ved Lagre.
  const [laktatSek, setLaktatSek] = useState<Map<string, number | null>>(new Map())
  const [ernaeringMin, setErnaeringMin] = useState<Map<string, number | null>>(new Map())
  const [visPlottTreff, setVisPlottTreff] = useState(false)
  // Radene med plassering i tid. Klokkas runder er utgangspunktet.
  const [utkast, setUtkast] = useState<Utkast[]>([])
  const [slettede, setSlettede] = useState<string[]>([])
  const [valgtRad, setValgtRad] = useState<string | null>(null)
  // ANGRE: hele redigeringsøkten kan angres steg for steg før lagring.
  const [angreStabel, setAngreStabel] = useState<{ utkast: Utkast[]; slettede: string[] }[]>([])
  const [utgangspunkt, setUtgangspunkt] = useState('')

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
  // Hvilken kurve radene tegnes på. Radene er de samme uansett.
  const [kurve, setKurve] = useState<'puls' | 'fart' | 'watt'>('puls')

  useEffect(() => {
    if (!workoutId) return
    let avbrutt = false
    hentPlanensRunder(workoutId)
      .then(b => { if (!avbrutt) setPlanBlokker(b) })
      .catch(() => {})
    return () => { avbrutt = true }
  }, [workoutId, lastTick])

  useEffect(() => {
    if (!workoutId) return
    let avbrutt = false
    hentOktbygger(workoutId)
      .then(d => {
        if (avbrutt) return
        setData(d)
        setLaster(false)
        if (d) {
          setLaktatSek(new Map(d.laktat.map(l => [l.id, l.sekunder])))
          setErnaeringMin(new Map(d.ernaering.map(n => [n.id, n.minutter])))
          setUtgangspunkt(JSON.stringify(d.rader
            .filter(r => r.startSek != null)
            .map(r => [r.id, r.startSek, r.sluttSek, r.activity_type, r.navn])))
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
              distanseKm: r.distanseKm != null ? String(r.distanseKm) : '',
              snittpuls: r.snittpuls != null ? String(r.snittpuls) : '',
              makspuls: r.makspuls != null ? String(r.makspuls) : '',
              sone: r.sone ?? '',
              beskrivelse: r.beskrivelse ?? '',
              gruppeId: r.gruppeId ?? null,
            })))
          if (d.hr.length === 0) setKurve(d.fart.length > 0 ? 'fart' : 'watt')
          if (d.rader.length === 0) setHurtigAapent(true)
        }
      })
      .catch(() => { if (!avbrutt) { setLaster(false); setFeil('Kunne ikke laste økta — prøv igjen') } })
    return () => { avbrutt = true }
  }, [workoutId, lastTick])

  const totalSek = data?.totalSek ?? 0

  /** Har brukeren endret noe som ikke er lagret? Dekker tidslinja (tid,
      navn, type, deling, sammenslåing, sletting) og punktenes tidspunkt. */
  const harUlagredeEndringer = () => {
    if (!data) return false
    const naa = JSON.stringify(utkast
      .slice()
      .sort((a, b) => a.startSek - b.startSek)
      .map(u => [u.dbId, u.startSek, u.startSek + u.varighetSek, u.type, u.navn || null]))
    const opprinnelig = JSON.stringify(JSON.parse(utgangspunkt || '[]')
      .slice()
      .sort((a: [string, number], b: [string, number]) => a[1] - b[1]))
    const punkterEndret =
      data.laktat.some(l => (laktatSek.get(l.id) ?? null) !== l.sekunder) ||
      data.ernaering.some(n => (ernaeringMin.get(n.id) ?? null) !== n.minutter)
    return naa !== opprinnelig || slettede.length > 0 || punkterEndret
  }

  const lukk = async () => {
    if (harUlagredeEndringer()) {
      const ok = await xpConfirm('Lukke uten å lagre? Endringene i tidslinja går tapt.')
      if (!ok) return
    }
    // Et rundebytte er allerede skrevet — foreldreflata får beskjed nå,
    // ikke i det byttet skjedde, slik at byggeren fikk stå åpen imens.
    if (rundeneErByttet) onLagret?.()
    onClose()
  }

  const skytingRader = data?.rader.filter(r => (r.activity_type ?? '').startsWith('skyting')) ?? []
  const sortert = [...utkast].sort((a, b) => a.startSek - b.startSek)
  const naboEtter = (u: Utkast) =>
    sortert.find(x => x.id !== u.id && x.startSek >= u.startSek + u.varighetSek - 1.5) ?? null

  /** Skriver man starttid i en rad, flyttes GRENSEN mot forrige rad —
      ellers ville raden dyttet seg inn i naboen og lagringen nektet. */
  const settRadStart = (u: Utkast, sek: number) => {
    const forrige = [...sortert].reverse().find(x =>
      x.id !== u.id && Math.abs(x.startSek + x.varighetSek - u.startSek) < 1.5)
    const ny = Math.max(0, Math.min(u.startSek + u.varighetSek - 5, sek))
    if (forrige) { flyttGrense(forrige.id, u.id, ny); return }
    endreUtkast(liste => liste.map(x =>
      x.id === u.id ? { ...x, startSek: ny, varighetSek: (u.startSek + u.varighetSek) - ny } : x))
  }

  /** Varighet skriver grensen mot NESTE rad (samme prinsipp). */
  const settRadVarighet = (u: Utkast, sek: number) => {
    const varighet = Math.max(5, sek)
    const neste = sortert.find(x =>
      x.id !== u.id && Math.abs(x.startSek - (u.startSek + u.varighetSek)) < 1.5)
    if (neste) { flyttGrense(u.id, neste.id, u.startSek + varighet); return }
    endreUtkast(liste => liste.map(x =>
      x.id === u.id ? { ...x, varighetSek: totalSek > 0 ? Math.min(totalSek - x.startSek, varighet) : varighet } : x))
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

  /** «Del her»: raden deles på midten. Kutt ved klikk på kurven (bolk 3)
      bruker samme deling med et valgt tidspunkt. */
  const delRad = (u: Utkast, vedSek?: number) => {
    if (u.varighetSek < 10) return
    const kutt = vedSek != null
      ? Math.max(5, Math.min(u.varighetSek - 5, Math.round(vedSek - u.startSek)))
      : Math.round(u.varighetSek / 2)
    const nytt: Utkast = {
      ...u, id: `ny-${crypto.randomUUID()}`, dbId: null,
      startSek: u.startSek + kutt, varighetSek: u.varighetSek - kutt,
      navn: '', skytetidSek: null, snittpuls: '', makspuls: '',
    }
    endreUtkast(liste => liste.map(x => x.id === u.id ? { ...x, varighetSek: kutt } : x).concat(nytt))
  }

  const slaaSammen = (u: Utkast) => {
    const n = naboEtter(u)
    if (!n) return
    if (n.dbId) setSlettede(s2 => [...s2, n.dbId!])
    endreUtkast(liste => liste
      .filter(x => x.id !== n.id)
      .map(x => x.id === u.id ? { ...x, varighetSek: (n.startSek + n.varighetSek) - u.startSek } : x))
  }

  const slettRad = (u: Utkast) => {
    if (u.dbId) setSlettede(s2 => [...s2, u.dbId!])
    setValgtRad(null)
    endreUtkast(liste => liste.filter(x => x.id !== u.id))
  }

  const lagre = async () => {
    if (!data || !workoutId) return
    // Klient-validering av overlapp — samme regel som serveren (regel 22).
    for (let i = 1; i < sortert.length; i++) {
      const f = sortert[i - 1]
      if (sortert[i].startSek < f.startSek + f.varighetSek - 0.5) {
        setFeil('To rader overlapper i tid — flytt eller kort inn den ene')
        return
      }
    }
    setLagrer(true)
    setFeil(null)
    const punkter = await lagreOktbyggerPunkter(workoutId, {
      laktat: data.laktat
        .filter(l => (laktatSek.get(l.id) ?? null) !== l.sekunder)
        .map(l => ({ id: l.id, sekunder: laktatSek.get(l.id) ?? null })),
      ernaering: data.ernaering
        .filter(n => (ernaeringMin.get(n.id) ?? null) !== n.minutter)
        .map(n => ({ id: n.id, minutter: ernaeringMin.get(n.id) ?? null })),
    })
    if (!punkter.ok) { setLagrer(false); setFeil(punkter.error); return }
    // Tidslinja lagres etter punktene: den kan opprette og slette rader,
    // og skal ikke kunne etterlate punkter uten sin rad.
    const tid = await lagreTidslinje(
      workoutId,
      sortert.map((u, i) => ({
        dbId: u.dbId,
        activityType: u.type,
        bevegelsesform: u.bevegelsesform || null,
        navn: u.navn || null,
        startSek: u.startSek,
        varighetSek: u.varighetSek,
        sortOrder: i,
        distanseKm: u.distanseKm,
        snittpuls: u.snittpuls,
        makspuls: u.makspuls,
        sone: u.sone,
        beskrivelse: u.beskrivelse,
        gruppeId: u.gruppeId,
      })),
      slettede,
    )
    setLagrer(false)
    if (!tid.ok) { setFeil(tid.error); return }
    onLagret?.()
    onClose()
  }

  const userHasBiathlon = data?.sport === 'biathlon' || skytingRader.length > 0

  const body = (
    <div onClick={lukk}
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
            Øktbygger
          </h2>
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
          {/* «Plott treff» ligger synlig HER når økta har skyting — man
              plasserer skytingene i tid og fører treffene uten å lukke.
              Samme komponent som fra knapperaden (regel 11). */}
          {workoutId && skytingRader.length > 0 && (
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
          <button type="button" onClick={lukk} aria-label="Lukk"
            style={{ background: 'none', border: 'none', color: 'var(--tekst-5-app)', fontSize: 20, cursor: 'pointer', minWidth: 36, minHeight: 36 }}>
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* ── HURTIGOPPSETTET — antall × dragtid × sone / pause ──
              Uendret i form (lib/intervall-generator). Radene går rett i
              skjemaet; byggeren husker ikke at de kom herfra. */}
          {onOpprett && sport && (
            <div data-hurtigoppsett>
              <button type="button" onClick={() => setHurtigAapent(v => !v)}
                aria-expanded={hurtigAapent}
                className="w-full flex items-center gap-2 text-left"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  letterSpacing: '0.12em', fontSize: 11.5, textTransform: 'uppercase',
                  color: 'var(--tekst-5-app)', background: 'none', border: 'none',
                  padding: '4px 0', cursor: 'pointer', minHeight: 36,
                }}>
                <span style={{ color: 'var(--accent)' }}>⚡</span> Hurtigoppsett — antall × dragtid × sone / pause
                <span className="ml-auto" style={{ color: 'var(--tekst-8-alt)' }}>{hurtigAapent ? '▴' : '▾'}</span>
              </button>
              {hurtigAapent && (
                <IntervallBygger
                  sport={sport}
                  onAvbryt={workoutId ? () => setHurtigAapent(false) : undefined}
                  onOpprett={async (rader, tittel) => {
                    await onOpprett(rader, tittel)
                    // Radene står nå i skjemaet, og grafen tegnes der.
                    onClose()
                  }}
                />
              )}
            </div>
          )}

          {!workoutId && !onOpprett && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14 }}>
              Lagre økta først, så kan den bygges i tid her.
            </p>
          )}

          {workoutId && laster && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-alt)', fontSize: 14 }}>
              Laster kurven …
            </p>
          )}
          {workoutId && !laster && (!data || (data.totalSek <= 0 && data.rader.length === 0)) && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14 }}>
              Økta har ingen aktiviteter ennå — legg til én først, så kan den bygges i tid her.
            </p>
          )}

          {workoutId && data && (data.totalSek > 0 || data.rader.length > 0) && (
            <>
              {planBlokker.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <VisPlanBryter paa={visPlan} antall={planBlokker.length}
                    onEndre={p2 => settVisPlanBak(p2)} />
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
                    color: 'var(--tekst-8-alt)',
                  }}>
                    Planens {planBlokker.length} blokker legges bak — da ser du hvor
                    økta forlot planen.
                  </span>
                </div>
              )}
              {/* Rundene: fra klokka, planens runder, eller tilbake til
                  klokka (bolk 6). Står bare når det finnes et reelt valg. */}
              <RundeValg workoutId={workoutId} onEndret={() => {
                setValgtRad(null)
                setAngreStabel([])
                setLastTick(t => t + 1)
                setRundeneErByttet(true)
              }} />
              {(() => {
                const valg = ([
                  ['puls', 'Puls', data.hr.length] as const,
                  ['fart', 'Fart', data.fart.length] as const,
                  ['watt', 'Watt', data.watt.length] as const,
                ]).filter(([, , n]) => n > 0)
                // Kurver uten data vises ikke — aldri en tom fane.
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
              <KurveMedRader
                workoutId={workoutId}
                utkast={utkast}
                valgtRad={valgtRad}
                onVelgRad={setValgtRad}
                erPlanlagt={data.erPlanlagt}
                hr={data.hr}
                fart={data.fart}
                watt={data.watt}
                hoyde={data.hoyde}
                kurve={kurve}
                sport={data.sport}
                totalSek={totalSek}
                laktat={data.laktat}
                ernaering={data.ernaering}
                planBlokker={visPlan ? planBlokker : []}
                laktatSek={laktatSek}
                ernaeringMin={ernaeringMin}
              />

              {/* «SE HVORDAN DEN BLIR» — live oppsummering under blokk-
                  lerretet. Ikke på kurven: der er tallene målt og står
                  allerede i økta. */}
              {!data.harKurve && (
                <ByggSum
                  utkast={utkast}
                  heartZones={data.heartZones}
                  rpe={data.rpe}
                  erPlanlagt={data.erPlanlagt}
                />
              )}

              {/* ── RADENE ER EDITOREN ── tid som tall, og del/slå sammen/
                  slett/type/navn som knapper i raden. Graf og rader er
                  samme data: skriver man i raden, flytter båndet seg. */}
              {utkast.length > 0 && (
                <div className="space-y-1">
                  <Overskrift>Radene — tid, type og navn</Overskrift>
                  {sortert.map(u => (
                    <Rad key={u.id}
                      u={u}
                      alle={utkast}
                      valgt={valgtRad === u.id}
                      hr={data.hr}
                      userHasBiathlon={userHasBiathlon}
                      harNabo={!!naboEtter(u)}
                      onVelg={() => setValgtRad(valgtRad === u.id ? null : u.id)}
                      onStart={sek => settRadStart(u, sek)}
                      onVarighet={sek => settRadVarighet(u, sek)}
                      onType={t => endreUtkast(liste => liste.map(x => x.id === u.id ? { ...x, type: t } : x))}
                      onNavn={navn => endreUtkast(liste => liste.map(x => x.id === u.id ? { ...x, navn } : x))}
                      onDel={() => delRad(u)}
                      onSlaaSammen={() => slaaSammen(u)}
                      onSlett={() => slettRad(u)}
                    />
                  ))}
                </div>
              )}

              {/* ── Punkter — målingene som allerede er ført, får et tidspunkt ── */}
              {(data.laktat.length > 0 || data.ernaering.length > 0) && (
                <div className="space-y-2">
                  <Overskrift>Punkter på kurven</Overskrift>
                  {data.laktat.map(l => {
                    const sek = laktatSek.get(l.id) ?? null
                    return (
                      <PunktRad key={l.id}
                        farge="#E23A5A"
                        navn={`Laktat ${String(l.mmol).replace('.', ',')} mmol`}
                        sek={sek}
                        onSek={s => setLaktatSek(m => new Map(m).set(l.id, Math.max(0, Math.round(s))))}
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
                        sek={min != null ? min * 60 : null}
                        onSek={s => setErnaeringMin(m => new Map(m).set(n.id, Math.max(0, Math.round(s / 60))))}
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
          <button type="button" onClick={lukk} className="xp-pill xp-pill-ghost">
            {workoutId ? 'Avbryt' : 'Lukk'}
          </button>
          {workoutId && (
            <button type="button" onClick={lagre} disabled={lagrer || !data}
              className="xp-pill xp-pill-primary">
              {lagrer ? 'Lagrer …' : 'Lagre'}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return (
    <>
      {createPortal(body, document.body)}
      {visPlottTreff && workoutId && (
        <PlottTreffPopup
          workoutId={workoutId}
          onClose={() => setVisPlottTreff(false)}
          onLagret={lagret => {
            // Skytetiden er PORTEN — den kan nettopp ha endret seg. Patches
            // lokalt fra det som ble lagret, så endringene brukeren har
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

// ── Kurven med radene som bånd ───────────────────────────────
// Lerretet kan være puls, fart eller watt — radene er de samme uansett.
// Høyde tegnes som stille bakgrunnsprofil når den finnes. Uten kurve
// tegnes blokk-lerretet med samme hjelpere.

/** Abonnerer på «vis plan»-valget — samme hendelse som bryteren sender. */
function abonnerVisPlan(oppdater: () => void): () => void {
  window.addEventListener(VIS_PLAN_HENDELSE, oppdater)
  window.addEventListener('storage', oppdater)
  return () => {
    window.removeEventListener(VIS_PLAN_HENDELSE, oppdater)
    window.removeEventListener('storage', oppdater)
  }
}

const KURVE_HOYDE = 190

// Samme fargefasit som økt-grafen (design/xpulse-oktgraf-design.html):
// puls #E23A5A · tempo/fart #28A86E · watt #E8B93C.
export const KURVE_FARGER = {
  puls: '#E23A5A',
  fart: '#28A86E',
  watt: '#E8B93C',
} as const

type KurveValg = keyof typeof KURVE_FARGER

function KurveMedRader({
  workoutId, utkast, valgtRad, onVelgRad, erPlanlagt,
  hr, fart, watt, hoyde, kurve, sport, totalSek,
  laktat, ernaering, laktatSek, ernaeringMin, planBlokker,
}: {
  workoutId: string
  utkast: Utkast[]
  valgtRad: string | null
  onVelgRad: (id: string | null) => void
  /** Planlagt økt — punkter tegnes hule. */
  erPlanlagt: boolean
  hr: Array<{ t: number; hr: number }>
  fart: Array<{ t: number; mps: number }>
  watt: Array<{ t: number; w: number }>
  hoyde: Array<{ t: number; alt: number }>
  /** Planens blokker, tomt når spøkelseslaget er av (bolk 7). */
  planBlokker: PlanBlokk[]
  kurve: KurveValg
  sport: string | null
  totalSek: number
  laktat: Array<{ id: string; mmol: number }>
  ernaering: Array<{ id: string; type: string }>
  laktatSek: Map<string, number | null>
  ernaeringMin: Map<string, number | null>
}) {
  // Samme motor som økt-grafen (regel 11). Zoom-nivået deles gjennom
  // lib/kurve-zoom.
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

  // Etiketten viser TALL som finnes: ført verdi først, ellers det klokka
  // målte i radens eget vindu. Finnes ingen av delene, står det
  // ingenting — etiketten finner aldri på et tall.
  const tallFor = (u: Utkast) => {
    const fort = (v: string) => { const n = parseInt(v); return Number.isFinite(n) ? n : null }
    const f = { snitt: fort(u.snittpuls), maks: fort(u.makspuls) }
    if (f.snitt != null || f.maks != null) return f
    if (hr.length === 0) return f
    if (PAUSE_TYPER.has(u.type) || u.type.startsWith('skyting')) return { snitt: null, maks: null }
    const m = pulsIVindu(hr, u.startSek, u.startSek + u.varighetSek)
    return { snitt: m.snitt, maks: m.maks }
  }

  // «plan: 8 min» — hva planen sa på dette stedet. Blokka må dekke radens
  // MIDTPUNKT og være av SAMME TYPE: når økta blir kortere enn planen,
  // forskyves alt etterpå, og uten typesjekken fikk pausen «plan: 8:00»
  // fra draget den tilfeldigvis lå under.
  const planTekstFor = (u: Utkast) => {
    if (planBlokker.length === 0) return null
    const midt = u.startSek + u.varighetSek / 2
    const minType = segmentTypeFor(u.type, u.bevegelsesform)
    const b = planBlokker.find(x =>
      midt >= x.startSek && midt < x.sluttSek && segmentTypeFor(x.type, '') === minType)
    if (!b) return null
    const planSek = b.sluttSek - b.startSek
    if (Math.abs(planSek - u.varighetSek) < 5) return null
    return `plan: ${fmtKlokkeSek(planSek)}`
  }

  const punktLag = (h: KurveHjelpere, paaKurve: boolean) => {
    const y = (sek: number) => (paaKurve ? h.yPctForSerie(kurve, sek) : '18%')
    return (
      <>
        {laktat.map(l => {
          const sek = laktatSek.get(l.id) ?? null
          if (sek == null) return null
          return (
            <span key={l.id} title={`Laktat ${l.mmol} mmol · ${fmtKlokkeSek(sek)}`} style={{
              position: 'absolute', left: h.pct(sek), top: y(sek),
              transform: 'translate(-50%, -50%)', width: 12, height: 12, borderRadius: '50%',
              background: erPlanlagt ? 'transparent' : '#E23A5A',
              border: `2px ${erPlanlagt ? 'dashed' : 'solid'} ${erPlanlagt ? '#E23A5A' : 'var(--flate-3)'}`,
              pointerEvents: 'none', zIndex: 5,
            }} />
          )
        })}
        {ernaering.map(n2 => {
          const min = ernaeringMin.get(n2.id) ?? null
          if (min == null) return null
          return (
            <span key={n2.id} title={`Ernæring — ${n2.type} · ${fmtKlokkeSek(min * 60)}`} style={{
              position: 'absolute', left: h.pct(min * 60), top: y(min * 60),
              transform: 'translate(-50%, -50%) rotate(45deg)', width: 11, height: 11,
              background: erPlanlagt ? 'transparent' : '#FFB300',
              border: `2px ${erPlanlagt ? 'dashed' : 'solid'} ${erPlanlagt ? '#FFB300' : 'var(--flate-3)'}`,
              pointerEvents: 'none', zIndex: 5,
            }} />
          )
        })}
      </>
    )
  }

  const overlay = (h: KurveHjelpere, paaKurve: boolean) => (
    <div style={{ position: 'absolute', inset: 0 }}>
      <PlanSpokelse blokker={planBlokker} pct={h.pct} />
      <RadLag utkast={utkast} valgtId={valgtRad} h={h} onVelg={onVelgRad}
        tallFor={tallFor} planTekstFor={planTekstFor} />
      {punktLag(h, paaKurve)}
    </div>
  )

  // LERRETET velges av hva økta HAR, ikke av en egen modus: har klokka
  // levert en kurve er den lerretet; ellers tegnes blokkene.
  const harKurve = kurveSerier.some(k => !k.somAreal && k.punkter.length > 0)

  if (!harKurve) {
    return (
      <BlokkLerret totalSek={totalSek} planlagt={erPlanlagt} overlay={h => overlay(h, false)} />
    )
  }

  const valgt = utkast.find(u => u.id === valgtRad) ?? null
  return (
    <div>
      <OktKurve
        serier={kurveSerier}
        paaIds={kurveSerier.filter(x => x.id === kurve || x.somAreal).map(x => x.id)}
        fokusId={kurve}
        totalSek={totalSek}
        hoyde={KURVE_HOYDE}
        vindu={vindu ?? undefined}
        onVindu={v => {
          const heleOkta = v[0] <= 0.5 && v[1] >= totalSek - 0.5
          setVindu(heleOkta ? null : v)
          lagreVindu(workoutId, heleOkta ? [0, totalSek] : v)
        }}
        overlay={h => overlay(h, true)}
      />

      {/* Live-leser for VALGT RAD: puls og fart samtidig. */}
      {valgt && (() => {
        const puls = pulsIVindu(hr, valgt.startSek, valgt.startSek + valgt.varighetSek)
        const snittFart = snittIVindu(
          fart.map(p2 => ({ t: p2.t, v: p2.mps })), valgt.startSek, valgt.startSek + valgt.varighetSek,
        )
        return (
          <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--tekst-5-app)' }}>
            <b>{etikettFor(valgt, utkast)}</b>
            {' '}{fmtKlokkeSek(valgt.startSek)}–{fmtKlokkeSek(valgt.startSek + valgt.varighetSek)}
            {' · varighet '}<b>{fmtKlokkeSek(valgt.varighetSek)}</b>
            {puls.snitt != null
              ? <>{' · puls snitt '}<b>{puls.snitt}</b>{puls.inn != null ? <>{' · inn '}<b>{puls.inn}</b></> : null}</>
              : <>{' · puls: for lite data'}</>}
            {snittFart != null && <>{' · fart '}<b>{fmtFartVerdi(snittFart, sport)}</b></>}
            {valgt.type.startsWith('skyting') && (
              <span style={{ color: 'var(--tekst-8-alt)' }}>
                {' · '}{valgt.skytetidSek != null
                  ? `ført skytetid ${fmtKlokkeSek(valgt.skytetidSek)} — teller i statistikken`
                  : 'kun puls-markering — utenfor skytetid-statistikk'}
              </span>
            )}
          </p>
        )
      })()}
    </div>
  )
}

// ── Radene som bånd på lerretet — ren lesevisning ───────────
// Klikk velger raden (så radlista og båndet peker på det samme). Ingen
// håndtak: tid endres i raden, som tall.

function RadLag({ utkast, valgtId, h, onVelg, tallFor, planTekstFor }: {
  utkast: Utkast[]
  valgtId: string | null
  h: KurveHjelpere
  onVelg: (id: string | null) => void
  tallFor: (u: Utkast) => { snitt: number | null; maks: number | null }
  planTekstFor: (u: Utkast) => string | null
}) {
  const sortert = [...utkast].sort((a, b) => a.startSek - b.startSek)
  return (
    <>
      {sortert.map(u => {
        const type = segmentTypeFor(u.type, u.bevegelsesform)
        const farge = SEGMENT_FARGER[type]
        const valgt = valgtId === u.id
        const andel = u.varighetSek / Math.max(1, h.tilSek - h.fraSek)
        const smalt = andel < 0.03
        const t = tallFor(u)
        const plan = planTekstFor(u)
        return (
          <button key={u.id} type="button"
            onClick={e => { e.stopPropagation(); onVelg(valgt ? null : u.id) }}
            aria-label={`${etikettFor(u, utkast)} ${fmtKlokkeSek(u.startSek)}–${fmtKlokkeSek(u.startSek + u.varighetSek)}`}
            style={{
              position: 'absolute', left: h.pct(u.startSek),
              width: `calc(${h.pct(h.fraSek + u.varighetSek)} - 1px)`, minWidth: 10,
              top: 6, bottom: 26, padding: 0, borderRadius: 6,
              // Smale rader OVER de brede i treffrekkefølgen — ellers
              // stjeler naboene klikket (målt 29. aug).
              zIndex: smalt ? 4 : 2,
              background: segmentBakgrunn(type), opacity: valgt ? 0.34 : 0.18,
              border: `1.5px solid ${farge}`,
              boxShadow: valgt ? `0 0 0 2px ${farge}66` : 'none',
              cursor: 'pointer',
            }}>
            <span style={{
              position: 'absolute', top: 2, left: 5, whiteSpace: 'nowrap', pointerEvents: 'none',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: farge,
            }}>
              {smalt ? '' : etikettFor(u, utkast)}
              {!smalt && (t.snitt != null || t.maks != null) && (
                <span style={{ color: 'var(--tekst-5-app)' }}>
                  {t.snitt != null ? ` · snitt ${t.snitt}` : ''}
                  {t.maks != null ? ` · maks ${t.maks}` : ''}
                </span>
              )}
            </span>
            {/* Planens tall for samme sted — grått og lite, bak det som
                faktisk skjedde. Står bare når spøkelseslaget er på. */}
            {!smalt && plan && (
              <span style={{
                position: 'absolute', bottom: 2, left: 5, whiteSpace: 'nowrap', pointerEvents: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9.5,
                letterSpacing: '0.05em', color: 'var(--tekst-8-alt)', fontStyle: 'italic',
              }}>
                {plan}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

// ── Én rad i lista — editoren ────────────────────────────────

function Rad({
  u, alle, valgt, hr, userHasBiathlon, harNabo,
  onVelg, onStart, onVarighet, onType, onNavn, onDel, onSlaaSammen, onSlett,
}: {
  u: Utkast
  alle: Utkast[]
  valgt: boolean
  hr: Array<{ t: number; hr: number }>
  userHasBiathlon: boolean
  harNabo: boolean
  onVelg: () => void
  onStart: (sek: number) => void
  onVarighet: (sek: number) => void
  onType: (t: ActivityType) => void
  onNavn: (navn: string) => void
  onDel: () => void
  onSlaaSammen: () => void
  onSlett: () => void
}) {
  const farge = SEGMENT_FARGER[segmentTypeFor(u.type, u.bevegelsesform)]
  const puls = pulsIVindu(hr, u.startSek, u.startSek + u.varighetSek)
  const knapp: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11.5,
    letterSpacing: '0.08em', textTransform: 'uppercase', background: 'none',
    border: '1px solid var(--line2)', color: 'var(--tekst-1-app)',
    borderRadius: 999, padding: '6px 12px', minHeight: 36, cursor: 'pointer',
  }
  return (
    <div data-oktbygger-rad
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5,
        color: 'var(--tekst-5-app)', background: valgt ? 'var(--flate-12-alt)' : 'none',
        border: `1px solid ${valgt ? farge : 'var(--kant-3)'}`,
        borderLeft: `3px solid ${farge}`,
        borderRadius: 8, padding: '8px 10px',
      }}>
      <div role="button" tabIndex={0} onClick={onVelg}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onVelg() } }}
        className="flex items-center gap-3 flex-wrap text-left"
        style={{ minHeight: 36, cursor: 'pointer' }}>
        <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600, minWidth: 96 }}>{etikettFor(u, alle)}</b>
        {/* Tiden står BÅDE som lesbar tekst og som felter: teksten er for
            å se, feltene for å skrive. */}
        <span>{fmtKlokkeSek(u.startSek)}–{fmtKlokkeSek(u.startSek + u.varighetSek)}</span>
        <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>start</span>
        <TidInput sek={u.startSek} onSek={onStart} />
        <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>varighet</span>
        <TidInput sek={u.varighetSek} onSek={onVarighet} />
        {puls.snitt != null && (
          <span className="ml-auto" style={{ color: 'var(--tekst-8-alt)' }}>snitt {puls.snitt}</span>
        )}
      </div>
      {valgt && (
        <div className="flex gap-2 flex-wrap items-center mt-2">
          <select value={u.type}
            onChange={e => onType(e.target.value as ActivityType)}
            aria-label="Type"
            style={{ ...knapp, paddingRight: 8 }}>
            {ACTIVITY_TYPES.filter(t => (!t.legacy || t.value === u.type) && (!t.biathlonOnly || userHasBiathlon))
              .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <NavnFelt navn={u.navn} plassholder={etikettFor(u, alle)} onNavn={onNavn} />
          <button type="button" style={knapp} onClick={onDel} disabled={u.varighetSek < 10}
            title="Deler raden på midten — begge får start og varighet">
            Del her
          </button>
          {harNabo && (
            <button type="button" style={knapp} onClick={onSlaaSammen}>Slå sammen med neste</button>
          )}
          <button type="button" style={{ ...knapp, color: '#E23A5A', borderColor: '#E23A5A55' }}
            onClick={onSlett}>
            Slett
          </button>
        </div>
      )}
    </div>
  )
}

/** Navnet skrives lokalt og legges på angre-stabelen først når man går
    videre — ellers ville hvert tastetrykk vært et angre-steg. */
function NavnFelt({ navn, plassholder, onNavn }: {
  navn: string; plassholder: string; onNavn: (navn: string) => void
}) {
  const [tekst, setTekst] = useState<string | null>(null)
  const bruk = () => {
    if (tekst != null && tekst !== navn) onNavn(tekst)
    setTekst(null)
  }
  return (
    <input value={tekst ?? navn}
      onChange={e => setTekst(e.target.value)}
      onBlur={bruk}
      onKeyDown={e => { if (e.key === 'Enter') { bruk(); e.currentTarget.blur() } }}
      placeholder={plassholder}
      aria-label="Navn på raden"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, minHeight: 36,
        background: 'var(--flate-14)', border: '1px solid var(--kant-3)',
        borderRadius: 8, color: 'var(--tekst-1-app)', padding: '6px 10px', width: 160,
      }} />
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

// Redigerbart tidsfelt (mm:ss eller t:mm:ss). Skriver man i raden,
// flytter båndet seg på kurven.
function TidInput({ sek, onSek }: { sek: number; onSek: (sek: number) => void }) {
  const [tekst, setTekst] = useState<string | null>(null)
  const bruk = () => {
    if (tekst == null) return
    const deler = tekst.trim().split(':').map(Number)
    if (deler.length >= 2 && deler.every(d => Number.isFinite(d) && d >= 0)) {
      onSek(deler.length === 3
        ? deler[0] * 3600 + deler[1] * 60 + deler[2]
        : deler[0] * 60 + deler[1])
    }
    setTekst(null)
  }
  return (
    <input type="text" inputMode="numeric"
      value={tekst ?? fmtKlokkeSek(sek)}
      onClick={e => e.stopPropagation()}
      onFocus={e => { e.stopPropagation(); setTekst(fmtKlokkeSek(sek)); e.currentTarget.select() }}
      onChange={e => setTekst(e.target.value)}
      onBlur={bruk}
      onKeyDown={e => { if (e.key === 'Enter') { bruk(); e.currentTarget.blur() } }}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
        width: 62, textAlign: 'center', minHeight: 36,
        color: 'var(--tekst-1-app)', background: 'var(--flate-14)',
        border: '1px solid var(--kant-3)', borderRadius: 6,
      }} />
  )
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
  farge, navn, sek, onSek, onPlasser, onFjern,
}: {
  farge: string
  navn: string
  sek: number | null
  onSek: (sek: number) => void
  onPlasser: () => void
  onFjern: () => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap"
      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-5-app)' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: farge }} />
      <span style={{ minWidth: 150 }}>{navn}</span>
      {sek != null ? (
        <>
          <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>tidspunkt</span>
          <TidInput sek={sek} onSek={onSek} />
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
