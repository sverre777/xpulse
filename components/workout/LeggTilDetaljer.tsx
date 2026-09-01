'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  hentLeggTilDetaljer, lagreLeggTilDetaljer,
  type LeggTilDetaljerData,
} from '@/app/actions/tidsplassering'
import { SEGMENT_FARGER, fmtKlokkeSek, pulsIVindu } from '@/lib/segmenter'
import { zoneForHeartRate } from '@/lib/heart-zones'
import { xpConfirm } from '@/components/ui/ConfirmDialog'
import { OktKurve, type KurveSerie } from './OktKurve'
import { BlokkLerret } from './BlokkLerret'
import { RundeValg } from './RundeValg'
import { PlanSpokelse, VisPlanBryter } from './PlanSpokelse'
import { hentPlanensRunder, type PlanBlokk } from '@/app/actions/runder'
import { visPlanBak, settVisPlanBak, VIS_PLAN_HENDELSE } from '@/lib/vis-plan'
import { ByggSum } from './ByggSum'
import { lagreVindu, hentVindu } from '@/lib/kurve-zoom'
import { PAUSE_TYPER, type ActivityType, type ShootingSeriesRow, type Sport } from '@/lib/types'
import {
  Verktoypalett, SegmentLag, SegmentHandlinger, etikettFor, segmentTypeFor,
  STANDARD_LENGDE, type Utkast, type PunktVerktoy,
} from './TidslinjeRedigering'
import { lagreTidslinje, lagreNyePunkter } from '@/app/actions/tidsplassering'
import { SegmentEditor } from './SegmentEditor'
import { antallRepetisjoner, type Kortintervall } from '@/lib/intervall-monstre'
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
      ⚡ Øktbygger
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
  // Bytter man runder (bolk 4) er HELE grunnlaget nytt — radene, vinduene
  // og pulsen per runde. Da lastes økta på nytt i stedet for å lappe på
  // et utkast som beskriver rader som ikke finnes lenger.
  const [lastTick, setLastTick] = useState(0)
  // BOLK 6 — planen som spøkelse bak det som faktisk skjedde.
  const [planBlokker, setPlanBlokker] = useState<PlanBlokk[]>([])
  const [visPlan, setVisPlan] = useState(false)
  // Rundebyttet skriver DIREKTE til basen (det er ikke et utkast), men
  // flatene bak skal ikke lastes på nytt midt i arbeidet: gjør de det,
  // rives byggeren ned, og valget kan ikke angres der og da — som det
  // skal kunne. Beskjeden til foreldreflata utsettes derfor til lukking.
  const [rundeneErByttet, setRundeneErByttet] = useState(false)
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
  const [palettPunkt, setPalettPunkt] = useState<PunktVerktoy | null>(null)
  // Dra-fra-paletten: verktøyet henger i pekeren til man slipper over
  // kurven. Klikk-og-plasser er snarveien ved siden av (fasiten).
  const [drar, setDrar] = useState<
    | { slag: 'segment'; type: ActivityType; x: number; y: number }
    | { slag: 'punkt'; type: PunktVerktoy; x: number; y: number }
    | null
  >(null)
  // Punkter lagt inn her, men uten verdi ennå: mmol og ernæringstype er
  // NOT NULL i basen, så de kan ikke lagres tomme (målt). De lever lokalt
  // til verdien er ført — og lagringen sier ærlig fra hvis den mangler.
  // Kurvens synlige vindu (oppdateres av kurve-komponenten) — trengs for
  // å regne om et drop-punkt til tid når man har zoomet.
  const sisteVindu = useRef<[number, number]>([0, 0])
  const [nyePunkter, setNyePunkter] = useState<
    { id: string; slag: 'laktat' | 'ernaering'; tSek: number; verdi: string }[]
  >([])
  // ANGRE (fasiten): hele redigeringsøkten kan angres steg for steg før
  // lagring. Hvert steg legger forrige tilstand på stabelen.
  const [angreStabel, setAngreStabel] = useState<{ utkast: Utkast[]; slettede: string[] }[]>([])
  const [utgangspunktTidslinje, setUtgangspunktTidslinje] = useState('')

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
    setVisPlan(visPlanBak())
    const oppdater = () => setVisPlan(visPlanBak())
    window.addEventListener(VIS_PLAN_HENDELSE, oppdater)
    return () => window.removeEventListener(VIS_PLAN_HENDELSE, oppdater)
  }, [])

  useEffect(() => {
    let avbrutt = false
    hentPlanensRunder(workoutId)
      .then(b => { if (!avbrutt) setPlanBlokker(b) })
      .catch(() => {})
    return () => { avbrutt = true }
  }, [workoutId, lastTick])

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
          setUtgangspunktTidslinje(JSON.stringify(d.rader
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
              arvetPuls: null,
            })))
          if (d.hr.length === 0) setKurve(d.fart.length > 0 ? 'fart' : 'watt')
        }
      })
      .catch(() => { if (!avbrutt) { setLaster(false); setFeil('Kunne ikke laste økta — prøv igjen') } })
    return () => { avbrutt = true }
  }, [workoutId, lastTick])

  const totalSek = data?.totalSek ?? 0

  /** Har brukeren endret noe som ikke er lagret? Dekker tidslinja
      (flytting, deling, sammenslåing, navn, type, sletting) og punkter
      som er lagt inn her — ikke bare de gamle vindusverdiene. */
  const harUlagredeEndringer = () => {
    const naa = JSON.stringify(utkast
      .slice()
      .sort((a, b) => a.startSek - b.startSek)
      .map(u => [u.dbId, u.startSek, u.startSek + u.varighetSek, u.type, u.navn || null]))
    const opprinnelig = JSON.stringify(JSON.parse(utgangspunktTidslinje || '[]')
      .slice()
      .sort((a: [string, number], b: [string, number]) => a[1] - b[1]))
    return naa !== opprinnelig || slettede.length > 0 || nyePunkter.length > 0
  }

  const lukk = async () => {
    if (harUlagredeEndringer()) {
      const ok = await xpConfirm('Lukke uten å lagre? Endringene i tidslinja går tapt.')
      if (!ok) return
    }
    // Et rundebytte er allerede skrevet — foreldreflata får beskjed nå,
    // ikke i det byttet skjedde, slik at byggeren fikk stå åpen imens.
    if (rundeneErByttet) onLagret()
    onClose()
  }

  const skytingRader = data?.rader.filter(r => (r.activity_type ?? '').startsWith('skyting')) ?? []
  const valgtUtkast = utkast.find(u => u.id === valgtSegment) ?? null
  const naboEtter = valgtUtkast
    ? [...utkast].sort((a, b) => a.startSek - b.startSek)
        .find(u => u.startSek >= valgtUtkast.startSek + valgtUtkast.varighetSek - 1.5 && u.id !== valgtUtkast.id) ?? null
    : null

  /** Slipper man et palett-verktøy over kurven, legges det inn der. */
  const startDra = (
    verktoy: { slag: 'segment'; type: ActivityType } | { slag: 'punkt'; type: PunktVerktoy },
    e: React.PointerEvent,
  ) => {
    setDrar({ ...verktoy, x: e.clientX, y: e.clientY })
    const flytt = (ev: PointerEvent) => setDrar(d => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))
    const slipp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', flytt)
      window.removeEventListener('pointerup', slipp)
      setDrar(null)
      // Traff vi kurven? (data-oktkurve settes av OktKurve på plot-flata.)
      const under = document.elementFromPoint(ev.clientX, ev.clientY)
      const flate = under?.closest('[data-oktkurve]') as HTMLElement | null
      if (!flate) return
      const r = flate.getBoundingClientRect()
      const andel = Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width)))
      const sek = sisteVindu.current[0] + andel * (sisteVindu.current[1] - sisteVindu.current[0])
      if (verktoy.slag === 'segment') leggInnSegmentType(verktoy.type, sek)
      else leggInnPunkt(verktoy.type, sek)
    }
    window.addEventListener('pointermove', flytt)
    window.addEventListener('pointerup', slipp)
  }

  /** Punkt: ett tidspunkt, ingen varighet. */
  const leggInnPunkt = (verktoy: PunktVerktoy, sek: number) => {
    if (verktoy === 'bevform') {
      // Bevegelsesform-bytte er et SEGMENT (en ny bevegelsesform varer i
      // tid) — bevegelsesformen settes i segment-editoren (bolk 2).
      leggInnSegmentType('aktivitet', sek)
      return
    }
    setNyePunkter(liste => [...liste, {
      id: `punkt-${crypto.randomUUID()}`, slag: verktoy,
      tSek: Math.max(0, Math.round(sek)), verdi: '',
    }])
    setPalettPunkt(null)
  }

  /** Legger et nytt segment der brukeren klikket på kurven. */
  const leggInnSegment = (sek: number) => {
    if (palettPunkt) { leggInnPunkt(palettPunkt, sek); return }
    if (!palettType) return
    leggInnSegmentType(palettType, sek)
  }

  const leggInnSegmentType = (type: ActivityType, sek: number) => {
    const lengde = STANDARD_LENGDE[type] ?? 120
    const start = Math.max(0, Math.round(sek))
    const slutt = Math.min(totalSek || start + lengde, start + lengde)
    const nytt: Utkast = {
      id: `ny-${crypto.randomUUID()}`, dbId: null, type,
      navn: '', bevegelsesform: '', startSek: start, varighetSek: Math.max(5, slutt - start),
      skytetidSek: null,
      distanseKm: '', snittpuls: '', makspuls: '', sone: '', beskrivelse: '', gruppeId: null,
      arvetPuls: null,
    }
    // SETTES INN i tidslinja, ikke oppå den: en tidslinje fra klokka er
    // sammenhengende, så et nytt segment må gjøre plass til seg selv.
    // Ligger dropp-punktet inne i et segment, deles det; treffer det bare
    // kanten, kortes naboen. Ellers ville hvert eneste dropp gitt overlapp
    // og en lagring som nekter.
    endreUtkast(liste => {
      const ut: Utkast[] = []
      for (const u of liste) {
        const uSlutt = u.startSek + u.varighetSek
        const overlapper = u.startSek < nytt.startSek + nytt.varighetSek && nytt.startSek < uSlutt
        if (!overlapper) { ut.push(u); continue }
        const forDel = nytt.startSek - u.startSek
        const etterDel = uSlutt - (nytt.startSek + nytt.varighetSek)
        if (forDel >= 5) ut.push({ ...u, varighetSek: forDel })
        if (etterDel >= 5) {
          ut.push({
            ...u,
            id: forDel >= 5 ? `ny-${crypto.randomUUID()}` : u.id,
            dbId: forDel >= 5 ? null : u.dbId,
            startSek: nytt.startSek + nytt.varighetSek,
            varighetSek: etterDel,
          })
        }
        // Ble hele segmentet dekket, forsvinner det (og slettes ved lagring).
        if (forDel < 5 && etterDel < 5 && u.dbId) setSlettede(s2 => [...s2, u.dbId!])
      }
      return [...ut, nytt]
    })
    setValgtSegment(nytt.id)
    setPalettType(null)
  }

  /** Det klokka MÅLTE i segmentets vindu — grunnlaget for «MÅLT»-merket
      og for plassholderne i editoren. Uten klokkedata: null overalt. */
  const maaltForSegment = (u: Utkast) => {
    if (!data || data.hr.length === 0) return null
    const p2 = pulsIVindu(data.hr, u.startSek, u.startSek + u.varighetSek)
    return { snittpuls: p2.snitt, makspuls: p2.maks, distanseKm: null }
  }

  /** Deler draget i repetisjoner etter mønsteret. Repetisjonene er EKTE
      rader med samme gruppe_id — «én flyt» krever at den som aldri åpner
      byggeren ser de samme radene. Rest som ikke går opp blir liggende
      som et eget segment, aldri skjult. */
  const delIRepetisjoner = (u: Utkast, m: Kortintervall) => {
    const antall = antallRepetisjoner(u.varighetSek, m)
    if (antall < 1) return
    const gruppeId = crypto.randomUUID()
    endreUtkast(liste => {
      const uten = liste.filter(x => x.id !== u.id)
      const nye: Utkast[] = []
      let t = u.startSek
      // PULSEN ARVES ALDRI NEDOVER. Med klokkedata leses den av seg selv
      // fra repetisjonens EGET vindu (maaltForSegment + lagringen).
      // Uten klokke står feltet tomt til brukeren fører, med dragets
      // snitt som grå plassholder — et hint om hva draget var, ikke et
      // tall som utgir seg for å være målt på repetisjonen.
      const arvetPuls = data && data.hr.length === 0 && (u.snittpuls || u.makspuls)
        ? { snitt: u.snittpuls, maks: u.makspuls } : null
      for (let i = 0; i < antall; i++) {
        nye.push({
          ...u, id: `ny-${crypto.randomUUID()}`, dbId: i === 0 ? u.dbId : null,
          type: u.type, startSek: t, varighetSek: m.paaSek, gruppeId, navn: '',
          snittpuls: '', makspuls: '', sone: '', arvetPuls,
        })
        t += m.paaSek
        if (m.avSek > 0) {
          nye.push({
            ...u, id: `ny-${crypto.randomUUID()}`, dbId: null,
            type: 'pause' as ActivityType, startSek: t, varighetSek: m.avSek,
            gruppeId, navn: '', distanseKm: '', snittpuls: '', makspuls: '', sone: '',
            arvetPuls: null,
          })
          t += m.avSek
        }
      }
      const rest = (u.startSek + u.varighetSek) - t
      if (rest >= 5) {
        nye.push({
          ...u, id: `ny-${crypto.randomUUID()}`, dbId: null,
          startSek: t, varighetSek: rest, gruppeId: null, navn: '',
          snittpuls: '', makspuls: '', sone: '', arvetPuls,
        })
      }
      return [...uten, ...nye]
    })
    setValgtSegment(null)
  }

  /** Skriver man starttid i en rad, flyttes GRENSEN mot forrige segment —
      samme handling som å dra grensehåndtaket. Ellers ville raden dyttet
      segmentet inn i naboen og lagringen nektet med «overlapper». */
  const settRadStart = (u: Utkast, sek: number) => {
    const sortert = [...utkast].sort((a, b) => a.startSek - b.startSek)
    const forrige = [...sortert].reverse().find(x =>
      x.id !== u.id && Math.abs(x.startSek + x.varighetSek - u.startSek) < 1.5)
    const ny = Math.max(0, Math.min(u.startSek + u.varighetSek - 5, sek))
    if (forrige) { flyttGrense(forrige.id, u.id, ny); return }
    endreUtkast(liste => liste.map(x =>
      x.id === u.id ? { ...x, startSek: ny, varighetSek: (u.startSek + u.varighetSek) - ny } : x))
  }

  /** Varighet skriver grensen mot NESTE segment (samme prinsipp). */
  const settRadVarighet = (u: Utkast, sek: number) => {
    const varighet = Math.max(5, sek)
    const sortert = [...utkast].sort((a, b) => a.startSek - b.startSek)
    const neste = sortert.find(x =>
      x.id !== u.id && Math.abs(x.startSek - (u.startSek + u.varighetSek)) < 1.5)
    if (neste) { flyttGrense(u.id, neste.id, u.startSek + varighet); return }
    endreUtkast(liste => liste.map(x =>
      x.id === u.id ? { ...x, varighetSek: Math.min(totalSek - x.startSek, varighet) } : x))
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
        distanseKm: u.distanseKm,
        snittpuls: u.snittpuls,
        makspuls: u.makspuls,
        sone: u.sone,
        beskrivelse: u.beskrivelse,
        // gruppe_id sendes KUN for repetisjoner — kolonnen kommer med
        // fase 117, og resten av lagringen skal ikke avhenge av den.
        gruppeId: u.gruppeId,
      })),
      slettede,
    )
    if (!tid.ok) { setLagrer(false); setFeil(tid.error); return }
    const nye = await lagreNyePunkter(workoutId, nyePunkter.map(np => ({
      slag: np.slag, tSek: np.tSek, verdi: np.verdi,
    })))
    setLagrer(false)
    if (!nye.ok) { setFeil(nye.error); return }
    onLagret()
    onClose()
  }

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
          <button type="button" onClick={lukk} aria-label="Lukk"
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
          {/* Den gamle sperren «trenger klokkesynkede sekund-data» er borte:
              byggeren har tre lerret, og kurven er bare ett av dem. Eneste
              ekte tomtilstand er en økt uten både rader og lengde — da er
              det ingen tidslinje å bygge på ennå. */}
          {!laster && (!data || (data.totalSek <= 0 && data.rader.length === 0)) && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)', fontSize: 14 }}>
              Økta har ingen aktiviteter ennå — legg til én først, så kan den bygges i tid her.
            </p>
          )}

          {data && (data.totalSek > 0 || data.rader.length > 0) && (
            <>
              {/* BOLK 4 ★ — rundene: fra klokka, planens runder, eller
                  tilbake til klokka. Står bare når det finnes et reelt
                  valg (komponenten skjuler seg selv ellers). */}
              {planBlokker.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <VisPlanBryter paa={visPlan} antall={planBlokker.length}
                    onEndre={p2 => setVisPlan(settVisPlanBak(p2))} />
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
                    color: 'var(--tekst-8-alt)',
                  }}>
                    Planens {planBlokker.length} blokker legges bak — da ser du hvor
                    økta forlot planen.
                  </span>
                </div>
              )}
              <RundeValg workoutId={workoutId} onEndret={() => {
                setValgtSegment(null)
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
                palettAktiv={palettType != null || palettPunkt != null}
                onVelgSegment={setValgtSegment}
                onEndreSegment={(id, patch) => endreUtkast(liste =>
                  liste.map(u => u.id === id ? { ...u, ...patch } : u))}
                onGrense={flyttGrense}
                onLeggInn={leggInnSegment}
                onVinduEndret={v => { sisteVindu.current = v }}
                nyePunkter={nyePunkter}
                erPlanlagt={data.erPlanlagt}
                onFlyttNyttPunkt={(id, sek) => setNyePunkter(liste =>
                  liste.map(p2 => p2.id === id ? { ...p2, tSek: Math.max(0, Math.round(sek)) } : p2))}
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
                onLaktat={(id, sek) => setLaktatSek(m => new Map(m).set(id, sek))}
                onErnaering={(id, min) => setErnaeringMin(m => new Map(m).set(id, min))}
              />

              {/* «SE HVORDAN DEN BLIR» — live oppsummering under BLOKK-lerretene
                  (A og B). Ikke på kurve-lerretet (C): der er tallene målt og
                  står allerede i økta — å gjenta dem her ville vært dublering. */}
              {!data.harKurve && (
                <ByggSum
                  utkast={utkast}
                  heartZones={data.heartZones}
                  rpe={data.rpe}
                  erPlanlagt={data.erPlanlagt}
                />
              )}

              {/* ── TIDSLINJA (LTD-A) ──
                  Den gamle avgrensningen «kun økter uten runder» er
                  OPPHEVET: alle typer kan plasseres og redigeres i tid,
                  også når klokka har levert runder. */}
              <Verktoypalett
                sport={(data.sport ?? null) as Sport | null}
                userHasBiathlon={data.rader.some(r => (r.activity_type ?? '').startsWith('skyting')) || data.sport === 'biathlon'}
                valgtType={palettType}
                onVelg={t => { setPalettType(t); if (t) setPalettPunkt(null) }}
                valgtPunkt={palettPunkt}
                onVelgPunkt={p2 => { setPalettPunkt(p2); if (p2) setPalettType(null) }}
                onDraStart={startDra}
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

              {valgtUtkast && (
                <SegmentEditor
                  segment={valgtUtkast}
                  alle={utkast}
                  sport={(data.sport ?? null) as Sport | null}
                  userHasBiathlon={data.sport === 'biathlon'}
                  felter={{
                    distanseKm: valgtUtkast.distanseKm,
                    snittpuls: valgtUtkast.snittpuls,
                    makspuls: valgtUtkast.makspuls,
                    sone: valgtUtkast.sone,
                    beskrivelse: valgtUtkast.beskrivelse,
                    bevegelsesform: valgtUtkast.bevegelsesform,
                    kortintervall: null,
                  }}
                  maalt={maaltForSegment(valgtUtkast)}
                  onFelt={patch => endreUtkast(liste => liste.map(x => {
                    if (x.id !== valgtUtkast.id) return x
                    const neste = { ...x, ...patch }
                    // LERRET B: den FØRTE pulsen bestemmer blokkens sone —
                    // ikke planens. Sonen skrives som tid i sonen, så øktas
                    // sonefordeling og belastningsgrafene regnes om av seg
                    // selv (de leser samme zones-jsonb som før).
                    if (patch.snittpuls != null && patch.sone == null) {
                      const bpm = parseInt(patch.snittpuls)
                      if (Number.isFinite(bpm) && bpm > 0 && data.heartZones.length > 0) {
                        const sone = zoneForHeartRate(bpm, data.heartZones)
                        if (sone) neste.sone = sone
                      }
                    }
                    return neste
                  }))}
                  onTid={patch => {
                    if (patch.startSek != null) settRadStart(valgtUtkast, patch.startSek)
                    if (patch.varighetSek != null) settRadVarighet(valgtUtkast, patch.varighetSek)
                  }}
                  onType={t => endreUtkast(liste => liste.map(x =>
                    x.id === valgtUtkast.id ? { ...x, type: t } : x))}
                  onNavn={navn => endreUtkast(liste => liste.map(x =>
                    x.id === valgtUtkast.id ? { ...x, navn } : x))}
                  onDelIRepetisjoner={m => delIRepetisjoner(valgtUtkast, m)}
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
                        <b style={{ color: 'var(--tekst-1-app)', fontWeight: 600, minWidth: 96 }}>{etikettFor(u, utkast)}</b>
                        {/* Tiden står BÅDE som lesbar tekst og som felter:
                            teksten er for å se, feltene for å skrive. */}
                        <span>{fmtKlokkeSek(u.startSek)}–{fmtKlokkeSek(u.startSek + u.varighetSek)} ⌚</span>
                        <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>start</span>
                        <TidInput sek={u.startSek} onSek={sek => settRadStart(u, sek)} />
                        <span style={{ color: 'var(--tekst-8-alt)', fontSize: 11.5 }}>varighet</span>
                        <TidInput sek={u.varighetSek} onSek={sek => settRadVarighet(u, sek)} />
                        {puls.snitt != null && (
                          <span className="ml-auto" style={{ color: 'var(--tekst-8-alt)' }}>snitt {puls.snitt}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* ── Punkter ── */}
              {(data.laktat.length > 0 || data.ernaering.length > 0 || nyePunkter.length > 0) && (
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
                  {nyePunkter.map(np => (
                    <div key={np.id} className="flex items-center gap-3 flex-wrap"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--tekst-5-app)' }}>
                      <span style={{
                        width: 9, height: 9, borderRadius: np.slag === 'laktat' ? '50%' : 2,
                        border: `2px dashed ${np.slag === 'laktat' ? '#E23A5A' : '#FFB300'}`,
                      }} />
                      <span style={{ minWidth: 150 }}>
                        {np.slag === 'laktat' ? 'Laktat (ny)' : 'Ernæring (ny)'} · {fmtKlokkeSek(np.tSek)}
                      </span>
                      <input value={np.verdi}
                        onChange={e => setNyePunkter(liste => liste.map(x =>
                          x.id === np.id ? { ...x, verdi: e.target.value } : x))}
                        placeholder={np.slag === 'laktat' ? 'mmol' : 'gel / drikke / bar'}
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, minHeight: 36,
                          width: np.slag === 'laktat' ? 80 : 150, textAlign: 'center',
                          background: 'var(--flate-14)', border: '1px solid var(--kant-3)',
                          borderRadius: 6, color: 'var(--tekst-1-app)',
                        }} />
                      <button type="button" className="xp-pill xp-pill-ghost"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setNyePunkter(liste => liste.filter(x => x.id !== np.id))}>
                        Fjern
                      </button>
                    </div>
                  ))}
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
          <button type="button" onClick={lukk} className="xp-pill xp-pill-ghost">
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
      {drar && createPortal(
        <span aria-hidden style={{
          position: 'fixed', left: drar.x, top: drar.y, transform: 'translate(-50%, -140%)',
          zIndex: 300, pointerEvents: 'none',
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11.5,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--tekst-1-app)', background: 'var(--flate-3)',
          border: '1px solid var(--accent)', borderRadius: 999, padding: '5px 11px',
        }}>
          {drar.slag === 'segment' ? 'Slipp for å legge inn' : 'Slipp for å sette punkt'}
        </span>,
        document.body,
      )}
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
  onVinduEndret, nyePunkter, onFlyttNyttPunkt, erPlanlagt,
  hr, fart, watt, hoyde, kurve, sport, totalSek,
  laktat, ernaering, laktatSek, ernaeringMin, planBlokker,
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
  onVinduEndret: (v: [number, number]) => void
  nyePunkter: { id: string; slag: 'laktat' | 'ernaering'; tSek: number; verdi: string }[]
  onFlyttNyttPunkt: (id: string, sek: number) => void
  /** Lerret A: planlagt økt — punkter tegnes hule. */
  erPlanlagt: boolean
  hr: Array<{ t: number; hr: number }>
  fart: Array<{ t: number; mps: number }>
  watt: Array<{ t: number; w: number }>
  hoyde: Array<{ t: number; alt: number }>
  /** Planens blokker, tomt når spøkelseslaget er av (bolk 6). */
  planBlokker: PlanBlokk[]
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

  // Etiketten viser TALL som finnes: ført verdi først, ellers det klokka
  // målte i segmentets eget vindu. Finnes ingen av delene, står det
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

  // «plan: 8 min» — hva planen sa på dette stedet.
  //
  // Blokka må dekke segmentets MIDTPUNKT og være av SAMME TYPE. Kravet om
  // lik type er ikke pynt: når økta blir kortere enn planen, forskyves alt
  // etterpå, og uten typesjekken fikk pausen og nedjoggen «plan: 8:00» fra
  // draget de tilfeldigvis lå under. Et tall som beskriver noe annet er
  // verre enn ingen tekst.
  const planTekstFor = (u: Utkast) => {
    if (planBlokker.length === 0) return null
    const midt = u.startSek + u.varighetSek / 2
    const minType = segmentTypeFor(u.type, u.bevegelsesform)
    const b = planBlokker.find(x =>
      midt >= x.startSek && midt < x.sluttSek && segmentTypeFor(x.type, '') === minType)
    if (!b) return null
    const planSek = b.sluttSek - b.startSek
    // Traff planen, er det ingenting å si.
    if (Math.abs(planSek - u.varighetSek) < 5) return null
    return `plan: ${fmtKlokkeSek(planSek)}`
  }

  // LERRETET velges av hva økta HAR, ikke av en egen modus: har klokka
  // levert en kurve er den lerretet (C); ellers tegnes blokkene (A/B).
  const harKurve = kurveSerier.some(k => !k.somAreal && k.punkter.length > 0)

  if (!harKurve) {
    return (
      <div>
        <BlokkLerret
          totalSek={totalSek}
          planlagt={erPlanlagt}
          onKlikk={sek => { if (palettAktiv) onLeggInn(sek) }}
          overlay={h => {
            sekFraAndelRef.current = h.sekFraAndel
            onVinduEndret([h.fraSek, h.tilSek])
            return (
              <div ref={boks}
                onPointerMove={paaFlytt}
                onPointerUp={() => { drag.current = null }}
                onPointerLeave={() => { drag.current = null }}
                style={{ position: 'absolute', inset: 0, cursor: palettAktiv ? 'copy' : undefined }}>
                <PlanSpokelse blokker={planBlokker} pct={h.pct} />
                <SegmentLag
                  palettAktiv={palettAktiv}
                  utkast={utkast}
                  valgtId={valgtSegment}
                  h={h}
                  totalSek={totalSek}
                  onVelg={onVelgSegment}
                  onEndre={onEndreSegment}
                  onGrense={onGrense}
                  tallFor={tallFor}
                  planTekstFor={planTekstFor}
                />
                {/* Punkter — hule/stiplede i plan (fasiten), fylte ellers. */}
                {nyePunkter.map(np => (
                  <span key={np.id} aria-label={`${np.slag} (ny)`} style={{
                    position: 'absolute', left: h.pct(np.tSek), top: '18%',
                    transform: 'translate(-50%, -50%)', width: 13, height: 13,
                    borderRadius: np.slag === 'laktat' ? '50%' : 3, background: 'transparent',
                    border: `2px dashed ${np.slag === 'laktat' ? '#E23A5A' : '#FFB300'}`,
                  }} />
                ))}
                {laktat.map(l => {
                  const sek = laktatSek.get(l.id) ?? null
                  if (sek == null) return null
                  return (
                    <span key={l.id} title={`Laktat ${l.mmol} mmol`} style={{
                      position: 'absolute', left: h.pct(sek), top: '18%',
                      transform: 'translate(-50%, -50%)', width: 12, height: 12, borderRadius: '50%',
                      background: erPlanlagt ? 'transparent' : '#E23A5A',
                      border: `2px ${erPlanlagt ? 'dashed' : 'solid'} #E23A5A`,
                    }} />
                  )
                })}
                {ernaering.map(n2 => {
                  const min = ernaeringMin.get(n2.id) ?? null
                  if (min == null) return null
                  return (
                    <span key={n2.id} title={`Ernæring — ${n2.type}`} style={{
                      position: 'absolute', left: h.pct(min * 60), top: '18%',
                      transform: 'translate(-50%, -50%) rotate(45deg)', width: 11, height: 11,
                      background: erPlanlagt ? 'transparent' : '#FFB300',
                      border: `2px ${erPlanlagt ? 'dashed' : 'solid'} #FFB300`,
                    }} />
                  )
                })}
              </div>
            )
          }}
        />
      </div>
    )
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
          onVinduEndret([h.fraSek, h.tilSek])
          const pct = h.pct
          const verdiYPct = (t: number) => h.yPctForSerie(kurve, t)
          return (
      <div ref={boks}
        onPointerMove={paaFlytt}
        onPointerUp={() => { drag.current = null }}
        onPointerLeave={() => { drag.current = null }}
        style={{ position: 'absolute', inset: 0, cursor: palettAktiv ? 'copy' : undefined }}>
        <PlanSpokelse blokker={planBlokker} pct={h.pct} />
        <SegmentLag
          palettAktiv={palettAktiv}
          utkast={utkast}
          valgtId={valgtSegment}
          h={h}
          totalSek={totalSek}
          onVelg={onVelgSegment}
          onEndre={onEndreSegment}
          onGrense={onGrense}
          tallFor={tallFor}
          planTekstFor={planTekstFor}
        />
        {/* Nye punkter lagt inn her (uten verdi ennå) — stiplet ring til
            de er ført, så de ikke ser ut som en måling. */}
        {nyePunkter.map(np => (
          <button key={np.id} type="button"
            aria-label={`${np.slag === 'laktat' ? 'Laktat' : 'Ernæring'} (ny) — dra for å flytte`}
            onPointerDown={e => {
              e.stopPropagation()
              const el = e.currentTarget
              el.setPointerCapture?.(e.pointerId)
              const flytt = (ev: PointerEvent) => {
                const r = boks.current?.getBoundingClientRect()
                if (!r) return
                const andel = Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width)))
                onFlyttNyttPunkt(np.id, sekFraAndelRef.current(andel))
              }
              const slipp = () => {
                el.removeEventListener('pointermove', flytt)
                el.removeEventListener('pointerup', slipp)
              }
              el.addEventListener('pointermove', flytt)
              el.addEventListener('pointerup', slipp)
            }}
            style={{
              position: 'absolute', left: pct(np.tSek), top: verdiYPct(np.tSek),
              transform: 'translate(-50%, -50%)', width: 13, height: 13, padding: 0,
              borderRadius: np.slag === 'laktat' ? '50%' : 3,
              background: 'transparent',
              border: `2px dashed ${np.slag === 'laktat' ? '#E23A5A' : '#FFB300'}`,
              cursor: 'grab', touchAction: 'none', zIndex: 7,
            }} />
        ))}

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

// Redigerbart tidsfelt (mm:ss eller t:mm:ss). Dette er den ANDRE veien i
// «én flyt»: drar man segmentet endres raden, og skriver man i raden
// flytter segmentet seg på kurven.
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

