'use client'

// Prestasjonsmodellen bolk 1 — «Profil › Terskler, soner & helse».
// Fasit: design/xpulse-terskler-design.html, visning I (INNSTILLINGENE).
// A: terskler per bevegelsesform/underkategori (versjonert, historikk-
// linje, egne soner-toggle per rad). B: helse-gruppa (dagens felter,
// bare flyttet). I6–I8-togglen i utkastet hører til bolk 5 og er
// bevisst IKKE med her.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  lagreTerskel, lagreEgneSoner, slaaAvEgneSoner, hentEgneSoner,
  lagreHelseProfil,
  type TerskelRad, type TerskelVersjon,
} from '@/app/actions/terskler'
import {
  ZONE_NAMES, computeZonesFromMaxHr, resolveMaxHr, type ZoneName, type HeartZone,
} from '@/lib/heart-zones'
import { ZONE_COLORS_V2 as ZONE_COLORS } from '@/lib/activity-summary'

interface BevegelsesValg { name: string; subcategories: string[] }

interface Props {
  rader: TerskelRad[]
  soneNokler: { movement_name: string; movement_subcategory: string }[]
  bevegelsesvalg: BevegelsesValg[]
  birthYear: number | null
  initialMaxHr: number | null
}

const GLOBAL_KEY = '|'

function nokkelLabel(name: string, sub: string): { tittel: string; sub: string } {
  if (!name) return { tittel: 'Alle bevegelsesformer', sub: 'globalt nivå — arves når ikke annet er satt' }
  if (!sub) return { tittel: name, sub: 'alle underkategorier' }
  return { tittel: `${name} · ${sub}`, sub: `underkategori av ${name.toLowerCase()}` }
}

function fmtPace(sek: number | null): string {
  if (sek == null || !Number.isFinite(sek) || sek <= 0) return ''
  const m = Math.floor(sek / 60), s = Math.round(sek % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function parsePace(input: string): number | null | 'ugyldig' {
  const t = input.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})[:.](\d{2})$/)
  if (!m) return 'ugyldig'
  return parseInt(m[1]) * 60 + parseInt(m[2])
}

function fmtDatoKort(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

function idag(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TersklerFlate({
  rader, soneNokler, bevegelsesvalg, birthYear, initialMaxHr,
}: Props) {
  const router = useRouter()

  // Radlista: globalnivået alltid øverst (arv-roten — dagens globale
  // soner/migrert terskel bor der), så terskelradene, så nøkler som
  // kun har egne soner. «+ Legg til» skaper nye.
  const alleNokler = useMemo(() => {
    const set = new Map<string, { movement_name: string; movement_subcategory: string }>()
    set.set(GLOBAL_KEY, { movement_name: '', movement_subcategory: '' })
    for (const r of rader) set.set(`${r.movement_name}|${r.movement_subcategory}`, r)
    for (const s of soneNokler) set.set(`${s.movement_name}|${s.movement_subcategory}`, s)
    return [...set.values()]
  }, [rader, soneNokler])

  const [nyeNokler, setNyeNokler] = useState<{ movement_name: string; movement_subcategory: string }[]>([])
  const [leggTilOpen, setLeggTilOpen] = useState(false)
  const [valgtForm, setValgtForm] = useState('')
  const [valgtSub, setValgtSub] = useState('')

  const radByKey = useMemo(() => {
    const m = new Map<string, TerskelRad>()
    for (const r of rader) m.set(`${r.movement_name}|${r.movement_subcategory}`, r)
    return m
  }, [rader])
  const soneKeySet = useMemo(
    () => new Set(soneNokler.map(s => `${s.movement_name}|${s.movement_subcategory}`)),
    [soneNokler],
  )

  const autoZones = useMemo(
    () => computeZonesFromMaxHr(resolveMaxHr(initialMaxHr, birthYear)),
    [initialMaxHr, birthYear],
  )

  const leggTil = () => {
    if (!valgtForm) return
    const ny = { movement_name: valgtForm, movement_subcategory: valgtSub }
    const key = `${ny.movement_name}|${ny.movement_subcategory}`
    if (![...alleNokler, ...nyeNokler].some(n => `${n.movement_name}|${n.movement_subcategory}` === key)) {
      setNyeNokler(p => [...p, ny])
    }
    setLeggTilOpen(false)
    setValgtForm('')
    setValgtSub('')
  }

  const subValg = bevegelsesvalg.find(b => b.name === valgtForm)?.subcategories ?? []

  return (
    <div>
      <div className="mb-3 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        A · Terskler & soner — per bevegelsesform og underkategori
      </div>

      <div className="space-y-2 mb-3">
        {[...alleNokler, ...nyeNokler].map(n => {
          const key = `${n.movement_name}|${n.movement_subcategory}`
          return (
            <TerskelRadKort
              key={key}
              movementName={n.movement_name}
              movementSubcategory={n.movement_subcategory}
              rad={radByKey.get(key) ?? null}
              harEgneSoner={soneKeySet.has(key)}
              autoZones={autoZones}
              onLagret={() => router.refresh()}
            />
          )
        })}
      </div>

      {/* + Legg til — velgeren rendres med sida (regel 20). */}
      {!leggTilOpen ? (
        <button type="button" onClick={() => setLeggTilOpen(true)}
          className="w-full p-3 text-left text-sm"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)',
            background: 'none', border: '1px dashed var(--line2)', borderRadius: 12, cursor: 'pointer',
          }}>
          + Legg til bevegelsesform / underkategori
        </button>
      ) : (
        <div className="p-3 flex flex-wrap items-center gap-2"
          style={{ border: '1px dashed var(--line2)', borderRadius: 12 }}>
          <select value={valgtForm} onChange={e => { setValgtForm(e.target.value); setValgtSub('') }} style={iSt2}>
            <option value="">Velg bevegelsesform …</option>
            {bevegelsesvalg.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
          <select value={valgtSub} onChange={e => setValgtSub(e.target.value)} style={iSt2}
            disabled={subValg.length === 0}>
            <option value="">{subValg.length ? 'Hele bevegelsesformen' : 'Ingen underkategorier'}</option>
            {subValg.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" onClick={leggTil} disabled={!valgtForm} style={miniBtn}>Legg til</button>
          <button type="button" onClick={() => setLeggTilOpen(false)} style={{ ...miniBtn, border: 'none' }}>Avbryt</button>
        </div>
      )}
    </div>
  )
}

function TerskelRadKort({
  movementName, movementSubcategory, rad, harEgneSoner, autoZones, onLagret,
}: {
  movementName: string
  movementSubcategory: string
  rad: TerskelRad | null
  harEgneSoner: boolean
  autoZones: HeartZone[]
  onLagret: () => void
}) {
  const [open, setOpen] = useState(rad === null && movementName !== '')
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const g = rad?.gjeldende ?? null
  const [puls, setPuls] = useState(g ? String(g.threshold_hr) : '')
  const [fart, setFart] = useState(fmtPace(g?.threshold_pace_sec_km == null ? null : Number(g.threshold_pace_sec_km)))
  const [ftp, setFtp] = useState(g?.ftp_watts != null ? String(g.ftp_watts) : '')
  const [gjelderFra, setGjelderFra] = useState(idag())

  // Egne soner for nøkkelen: null = ikke hentet ennå (lastes bak
  // togglen — bryteren selv står i kortet fra første render).
  const [sonerPaa, setSonerPaa] = useState(harEgneSoner)
  const [soner, setSoner] = useState<{ zone_name: ZoneName; min_bpm: string; max_bpm: string }[] | null>(null)

  const lbl = nokkelLabel(movementName, movementSubcategory)

  const visSoner = (kilde: { zone_name: ZoneName; min_bpm: number; max_bpm: number }[]) =>
    ZONE_NAMES.map(n => {
      const r = kilde.find(z => z.zone_name === n)
      return { zone_name: n, min_bpm: r ? String(r.min_bpm) : '', max_bpm: r ? String(r.max_bpm) : '' }
    })

  const toggleSoner = () => {
    if (pending) return
    setMsg(null)
    if (!sonerPaa) {
      // PÅ: vis editor umiddelbart — prefyll fra lagrede rader om de
      // finnes, ellers OT-standard fra makspulsen.
      setSonerPaa(true)
      if (harEgneSoner) {
        setSoner(null)
        hentEgneSoner(movementName, movementSubcategory).then(res => {
          if (Array.isArray(res) && res.length === ZONE_NAMES.length) setSoner(visSoner(res))
          else setSoner(visSoner(autoZones))
        })
      } else {
        setSoner(visSoner(autoZones))
      }
    } else {
      // AV: OT-standarden gjelder igjen — radene slettes.
      setSonerPaa(false)
      setSoner(null)
      if (harEgneSoner) {
        startTransition(async () => {
          const res = await slaaAvEgneSoner(movementName, movementSubcategory)
          if (res.error) { setMsg({ kind: 'err', text: res.error }); setSonerPaa(true); return }
          setMsg({ kind: 'ok', text: 'Egne soner slått av — Olympiatoppens standard gjelder' })
          onLagret()
        })
      }
    }
  }

  const lagreSonerNaa = () => {
    if (!soner || pending) return
    setMsg(null)
    startTransition(async () => {
      const parsed = soner.map(s => ({
        zone_name: s.zone_name,
        min_bpm: parseInt(s.min_bpm) || 0,
        max_bpm: parseInt(s.max_bpm) || 0,
      }))
      const res = await lagreEgneSoner(movementName, movementSubcategory, parsed)
      if (res.error) { setMsg({ kind: 'err', text: res.error }); return }
      setMsg({ kind: 'ok', text: 'Egne soner lagret' })
      onLagret()
    })
  }

  const lagreTerskelNaa = () => {
    if (pending) return
    setMsg(null)
    const pulsN = parseInt(puls)
    if (!Number.isFinite(pulsN)) { setMsg({ kind: 'err', text: 'Terskelpuls må fylles ut' }); return }
    const fartSek = parsePace(fart)
    if (fartSek === 'ugyldig') { setMsg({ kind: 'err', text: 'Terskelfart skrives som M:SS per km, f.eks. 3:12' }); return }
    const ftpN = ftp.trim() ? parseInt(ftp) : null
    startTransition(async () => {
      const res = await lagreTerskel({
        movement_name: movementName,
        movement_subcategory: movementSubcategory,
        threshold_hr: pulsN,
        threshold_pace_sec_km: fartSek,
        ftp_watts: ftpN,
        valid_from: gjelderFra,
      })
      if (res.error) { setMsg({ kind: 'err', text: res.error }); return }
      setMsg({ kind: 'ok', text: 'Terskel lagret som ny versjon' })
      onLagret()
    })
  }

  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <span className="min-w-0">
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--ink)', display: 'block' }}>
            {lbl.tittel}
          </span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'var(--mut)' }}>
            {lbl.sub}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-auto"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, color: 'var(--mut)' }}>
          <span>Terskelpuls <b style={{ color: 'var(--ink)' }}>{g?.threshold_hr ?? '—'}</b></span>
          <span>Terskelfart <b style={{ color: 'var(--ink)' }}>{g?.threshold_pace_sec_km != null ? `${fmtPace(Number(g.threshold_pace_sec_km))} /km` : '—'}</b></span>
          <span>FTP <b style={{ color: 'var(--ink)' }}>{g?.ftp_watts != null ? `${g.ftp_watts} W` : '—'}</b></span>
          <span className="text-xs tracking-widest uppercase px-2 py-0.5"
            style={{
              border: `1px solid ${sonerPaa ? '#28A86E' : 'var(--line2)'}`,
              color: sonerPaaColor(sonerPaa), borderRadius: 999,
            }}>
            {sonerPaa ? 'Egne soner' : 'Standard (OT)'}
          </span>
          <span aria-hidden style={{ color: 'var(--tekst-8-app)' }}>{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Felt label="Terskelpuls" hint="slag/min">
              <input value={puls} onChange={e => setPuls(e.target.value)} inputMode="numeric" style={iSt2} />
            </Felt>
            <Felt label="Terskelfart" hint="min/km — valgfri">
              <input value={fart} onChange={e => setFart(e.target.value)} placeholder="3:45" style={iSt2} />
            </Felt>
            <Felt label="FTP (valgfritt)" hint="watt — for NP/IF">
              <input value={ftp} onChange={e => setFtp(e.target.value)} inputMode="numeric" style={iSt2} />
            </Felt>
            <Felt label="Gjelder fra" hint="historikk beholdes">
              <input type="date" value={gjelderFra} onChange={e => setGjelderFra(e.target.value)} style={iSt2} />
            </Felt>
          </div>

          {rad && rad.historikk.length > 0 && (
            <p className="mt-2 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)' }}>
              {historikkTekst(rad.historikk)}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button type="button" onClick={lagreTerskelNaa} disabled={pending} style={primBtn(pending)}>
              Lagre terskel
            </button>
          </div>

          {/* Egne soner-toggle — svarer i samme tick (regel 20). */}
          <div className="flex items-center gap-2 mt-4">
            <button type="button" onClick={toggleSoner} role="switch" aria-checked={sonerPaa}
              aria-label={`Egne soner for ${lbl.tittel}`}
              style={{
                width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: sonerPaa ? '#28A86E' : 'var(--line2)', position: 'relative',
              }}>
              <span style={{
                position: 'absolute', top: 3, left: sonerPaa ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: 'var(--tekst-1-ren)',
                transition: 'left 120ms',
              }} />
            </button>
            <span className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-3-app)' }}>
              Egne soner for denne bevegelsesformen{' '}
              <span style={{ color: 'var(--mut)' }}>(av = Olympiatoppens standard fra terskel/makspuls)</span>
            </span>
          </div>

          {sonerPaa && (
            <div className="mt-3 space-y-1.5">
              {soner === null ? (
                <p className="text-sm py-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)' }}>
                  Henter soner …
                </p>
              ) : (
                <>
                  {soner.map(sf => (
                    <div key={sf.zone_name} className="flex items-center gap-2">
                      <span style={{
                        fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: 'var(--tekst-1-ren)',
                        background: ZONE_COLORS[sf.zone_name], borderRadius: 6,
                        width: 30, textAlign: 'center', padding: '2px 0',
                      }}>
                        {sf.zone_name}
                      </span>
                      <input value={sf.min_bpm} inputMode="numeric" aria-label={`${sf.zone_name} nedre`}
                        onChange={e => setSoner(p => p!.map(x => x.zone_name === sf.zone_name ? { ...x, min_bpm: e.target.value } : x))}
                        style={{ ...iSt2, width: 76, textAlign: 'center' }} />
                      <span style={{ color: 'var(--tekst-8-app)' }}>–</span>
                      <input value={sf.max_bpm} inputMode="numeric" aria-label={`${sf.zone_name} øvre`}
                        onChange={e => setSoner(p => p!.map(x => x.zone_name === sf.zone_name ? { ...x, max_bpm: e.target.value } : x))}
                        style={{ ...iSt2, width: 76, textAlign: 'center' }} />
                      <span className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>bpm</span>
                    </div>
                  ))}
                  <button type="button" onClick={lagreSonerNaa} disabled={pending} style={{ ...primBtn(pending), marginTop: 8 }}>
                    Lagre egne soner
                  </button>
                </>
              )}
            </div>
          )}

          {msg && (
            <p className="mt-2 text-xs" style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: msg.kind === 'ok' ? '#28A86E' : '#E11D48',
            }}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function historikkTekst(historikk: TerskelVersjon[]): string {
  if (historikk.length === 1) {
    return `Satt ${fmtDatoKort(historikk[0].valid_from)} — terskelen overskrives aldri, den versjoneres.`
  }
  const steg: string[] = []
  for (let i = 1; i < historikk.length; i++) {
    const fra = historikk[i - 1].threshold_hr
    const til = historikk[i].threshold_hr
    const pil = til > fra ? '▲' : til < fra ? '▼' : '→'
    steg.push(`${fra} → ${til} ${pil} ${fmtDatoKort(historikk[i].valid_from)}`)
  }
  return `Historikk: ${steg.join(' · ')} — terskelen overskrives aldri, den versjoneres.`
}

function sonerPaaColor(paa: boolean): string {
  return paa ? '#28A86E' : 'var(--mut)'
}

// ── B · Helse — dagens felter, bare flyttet hit ──
export function HelseGruppe({
  birthYear, initialMaxHr, initialResting,
}: {
  birthYear: number | null
  initialMaxHr: number | null
  initialResting: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [maxHr, setMaxHr] = useState(initialMaxHr != null ? String(initialMaxHr) : '')
  const [resting, setResting] = useState(initialResting != null ? String(initialResting) : '')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const lagre = () => {
    if (pending) return
    setMsg(null)
    startTransition(async () => {
      const res = await lagreHelseProfil({ max_heart_rate: maxHr, resting_heart_rate: resting })
      if (res.error) { setMsg({ kind: 'err', text: res.error }); return }
      setMsg({ kind: 'ok', text: 'Helseprofil lagret' })
      router.refresh()
    })
  }

  return (
    <div className="mt-8">
      <div className="mb-3 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
        B · Helse — samme flate, egen gruppe
      </div>
      <div className="p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14 }}>
        <div className="grid grid-cols-2 gap-3">
          <Felt label="Makspuls" hint="brukes av sone-prosentene">
            <input value={maxHr} onChange={e => setMaxHr(e.target.value)} inputMode="numeric"
              placeholder={`Auto: ${resolveMaxHr(null, birthYear)}`} style={iSt2} />
          </Felt>
          <Felt label="Hvilepuls (manuell)" hint="vinner over klokka (M)">
            <input value={resting} onChange={e => setResting(e.target.value)} inputMode="numeric"
              placeholder="—" style={iSt2} />
          </Felt>
        </div>
        <button type="button" onClick={lagre} disabled={pending} style={{ ...primBtn(pending), marginTop: 12 }}>
          Lagre helseprofil
        </button>
        {msg && (
          <p className="mt-2 text-xs" style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            color: msg.kind === 'ok' ? '#28A86E' : '#E11D48',
          }}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  )
}

function Felt({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-8-app)' }}>
        {label}
      </label>
      {children}
      {hint && (
        <div className="mt-1 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--mut)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

const iSt2: React.CSSProperties = {
  backgroundColor: 'var(--card2)',
  border: '1px solid var(--line)',
  color: 'var(--tekst-1-app)',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px',
  padding: '7px 10px',
  outline: 'none',
  width: '100%',
  borderRadius: 8,
}

const miniBtn: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  color: 'var(--tekst-1-app)',
  background: 'none',
  border: '1px solid var(--line2)',
  cursor: 'pointer',
  padding: '7px 14px',
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  borderRadius: 999,
}

function primBtn(pending: boolean): React.CSSProperties {
  return {
    fontFamily: "'Barlow Condensed', sans-serif",
    backgroundColor: '#FF4500', color: 'var(--tekst-1-ren)',
    border: 'none', cursor: pending ? 'default' : 'pointer',
    padding: '8px 18px', fontSize: '13px', letterSpacing: '0.1em',
    textTransform: 'uppercase', borderRadius: 999,
    opacity: pending ? 0.6 : 1,
  }
}
