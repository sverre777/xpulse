'use client'

// SETEMODELLEN bolk 4 — «Plasser»-seksjonen i trenerpanelet.
//
// Viser inkludert + kjøpte, brukte/ledige, invitasjonslenka (kopier +
// regenerer) og utøverne på plass m/ «Fjern» (navn + bekreftelse som sier hva
// som skjer). NEDGRADERINGS-SPERREN: settes antallet under plasser i bruk,
// blokkerer serveren og vi viser navnelisten — TRENEREN velger hvem som
// fjernes, systemet velger aldri.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setSeatQuantity, previewSeatQuantity, type SeatStatus, type SeatQuantityPreview } from '@/app/actions/seats'
import { regenerateSeatInviteLink, releaseSeat } from '@/app/actions/seat-invite'
import { xpConfirm } from '@/components/ui/ConfirmDialog'

const COACH_BLUE = '#1A6FD4'

interface Props {
  status: SeatStatus
  inviteUrl: string
}

export function SeatPanelSection({ status, inviteUrl }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mustFree, setMustFree] = useState<number | null>(null)
  const [kopiert, setKopiert] = useState(false)
  const [antall, setAntall] = useState(status.purchased)

  const fmtDato = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'long' }) : '—'

  const kopier = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setKopiert(true)
      setTimeout(() => setKopiert(false), 2500)
    } catch {
      setError('Kunne ikke kopiere — marker lenka manuelt')
    }
  }

  const regenerer = async () => {
    if (!await xpConfirm('Lage ny lenke? Den gamle slutter å virke med en gang — utøvere som allerede er på plass beholder plassen.')) return
    startTransition(async () => {
      const res = await regenerateSeatInviteLink()
      if (res && 'error' in res && res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  // Kjøp skjer ALDRI direkte fra Lagre: først hentes den faktiske
  // proraterte summen fra Stripe og vises i en «helt sikker?»-popup.
  const [preview, setPreview] = useState<SeatQuantityPreview | null>(null)

  const lagreAntall = () => {
    setError(null); setMustFree(null)
    startTransition(async () => {
      const res = await previewSeatQuantity(antall)
      if ('error' in res) {
        setError(res.error)
        if (res.mustFree) setMustFree(res.mustFree)
        return
      }
      setPreview(res)
    })
  }

  const bekreftKjop = () => {
    setError(null)
    startTransition(async () => {
      const res = await setSeatQuantity(antall)
      setPreview(null)
      if (res.error) {
        setError(res.error)
        if (res.mustFree) setMustFree(res.mustFree)
        return
      }
      router.refresh()
    })
  }

  const fjern = async (userId: string, navn: string) => {
    const dato = status.athletes.find(a => a.userId === userId)?.currentPeriodEnd ?? null
    const bekreftelse = `Fjerne ${navn} fra plassen?\n\n` +
      `${navn} beholder tilgangen ut inneværende periode${dato ? ` (til ${fmtDato(dato)})` : ''}, ` +
      `og beholder brukeren og all treningsdata etterpå. Plassen blir ledig hos deg med en gang.`
    if (!await xpConfirm(bekreftelse)) return
    startTransition(async () => {
      const res = await releaseSeat(userId)
      if (res.error) { setError(res.error); return }
      setMustFree(null)
      router.refresh()
    })
  }

  const aktive = status.athletes.filter(a => a.status === 'active' || a.status === 'trialing')
  const utlopende = status.athletes.filter(a => a.status === 'utloper')

  return (
    <section className="mt-6 p-5"
      style={{ backgroundColor: 'var(--card, #101014)', border: '1px solid var(--line, #1E1E22)', borderRadius: 14 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: 20, letterSpacing: '0.08em', margin: 0 }}>
          Utøverplasser
        </h2>
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          {status.inUse} i bruk · {status.available} ledig{status.available === 1 ? '' : 'e'}
        </span>
      </div>

      {/* Teller-bokser */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Tall label="Inkludert" verdi={status.included} />
        <Tall label="Kjøpte" verdi={status.purchased} />
        <Tall label="I bruk" verdi={status.inUse} />
        <Tall label="Ledige" verdi={status.available} farge={status.available > 0 ? '#28A86E' : '#8A8A96'} />
      </div>

      {/* Invitasjonslenka */}
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Invitasjonslenke — utøveren registrerer seg og er koblet + lisensiert på under et minutt
      </p>
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <code className="px-3 py-2 text-xs truncate" style={{
          fontFamily: 'monospace', color: '#C0C0CC',
          backgroundColor: '#0B0B0F', border: '1px solid #2A2A33', borderRadius: 8,
          maxWidth: '100%', flex: '1 1 260px',
        }}>
          {inviteUrl}
        </code>
        <button type="button" onClick={kopier} style={knappPrimar}>
          {kopiert ? '✓ Kopiert' : 'Kopier lenke'}
        </button>
        <button type="button" onClick={regenerer} disabled={pending} style={knappSekundar}>
          ⟳ Ny lenke
        </button>
      </div>

      {/* Kjøp/endre antall */}
      <p className="text-xs tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Ekstra plasser — 29 kr/mnd per plass, prorert av Stripe
      </p>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <button type="button" onClick={() => setAntall(a => Math.max(0, a - 1))} style={knappSekundar} aria-label="Færre plasser">−</button>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: 22, minWidth: 28, textAlign: 'center' }}>
          {antall}
        </span>
        <button type="button" onClick={() => setAntall(a => Math.min(200, a + 1))} style={knappSekundar} aria-label="Flere plasser">+</button>
        {antall !== status.purchased && (
          <button type="button" onClick={lagreAntall} disabled={pending} style={knappPrimar}>
            {pending ? 'Henter pris…' : `Lagre (${antall * 29} kr/mnd)`}
          </button>
        )}
      </div>

      {/* Bekreftelses-popup: viser den FAKTISKE proraterte summen fra Stripe
          før noe endres — kjøp skjer aldri i blinde. */}
      {preview && (
        <div onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#0A0A0B', border: '1px solid #2A2A33', borderRadius: 14, maxWidth: 420, width: '100%', padding: 22 }}>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: 20, letterSpacing: '0.08em', marginBottom: 10 }}>
              {preview.til > preview.fra ? 'Bekreft kjøp av plasser' : 'Bekreft endring'}
            </h3>
            <div className="space-y-2 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#C0C0CC' }}>
              <p>Kjøpte utøverplasser: <b style={{ color: '#F0F0F2' }}>{preview.fra} → {preview.til}</b></p>
              <p>Ny månedspris for plassene: <b style={{ color: '#F0F0F2' }}>{preview.nyMndOre / 100} kr/mnd</b> (fra neste faktura)</p>
              {preview.prorationOre > 0 && (
                <p>Belastes nå (resten av perioden): <b style={{ color: '#F0F0F2' }}>{(preview.prorationOre / 100).toFixed(2)} kr</b></p>
              )}
              {preview.prorationOre < 0 && (
                <p>Godskrives på neste faktura: <b style={{ color: '#28A86E' }}>{(Math.abs(preview.prorationOre) / 100).toFixed(2)} kr</b></p>
              )}
              {preview.prorationOre === 0 && preview.til !== preview.fra && (
                <p style={{ color: '#8A8A96' }}>
                  {preview.status === 'trialing'
                    ? 'Ingen belastning nå — plassene kommer på første faktura etter prøveperioden.'
                    : 'Ingen belastning nå — endringen kommer på neste faktura.'}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setPreview(null)} style={knappSekundar}>Avbryt</button>
              <button type="button" onClick={bekreftKjop} disabled={pending} style={{ ...knappPrimar, opacity: pending ? 0.6 : 1 }}>
                {pending ? 'Utfører…' : preview.til > preview.fra
                  ? `Bekreft kjøp${preview.prorationOre > 0 ? ` — ${(preview.prorationOre / 100).toFixed(2)} kr nå` : ''}`
                  : 'Bekreft endring'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 mb-3" style={{
          backgroundColor: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.4)',
          borderLeft: '3px solid #E11D48', borderRadius: 8,
        }}>
          <p className="text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>{error}</p>
          {mustFree != null && (
            <p className="text-xs mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
              Velg selv hvem som skal miste plassen i listen under — ingen fjernes automatisk.
            </p>
          )}
        </div>
      )}

      {/* Utøverne på plass */}
      {(aktive.length > 0 || utlopende.length > 0) && (
        <>
          <p className="text-xs tracking-widest uppercase mb-2 mt-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            På plass
          </p>
          <div className="space-y-2">
            {[...aktive, ...utlopende].map(a => (
              <div key={a.userId} className="flex items-center justify-between gap-2 px-3 py-2"
                style={{
                  border: `1px solid ${mustFree != null && a.status !== 'utloper' ? 'rgba(225,29,72,0.5)' : '#1E1E22'}`,
                  borderRadius: 9, opacity: a.status === 'utloper' ? 0.6 : 1,
                }}>
                <div className="min-w-0">
                  <p className="truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2', fontSize: 14 }}>
                    {a.name}
                  </p>
                  <p className="text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                    {a.status === 'utloper'
                      ? `Fjernet — beholder tilgang til ${fmtDato(a.currentPeriodEnd)}`
                      : 'Athlete Pro via din plass'}
                  </p>
                </div>
                {a.status !== 'utloper' && (
                  <button type="button" onClick={() => fjern(a.userId, a.name)} disabled={pending}
                    className="text-xs tracking-widest uppercase shrink-0"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: '#E11D48', background: 'none',
                      border: '1px solid rgba(225,29,72,0.5)', borderRadius: 999,
                      padding: '6px 12px', cursor: 'pointer',
                    }}>
                    Fjern
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function Tall({ label, verdi, farge = '#F0F0F2' }: { label: string; verdi: number; farge?: string }) {
  return (
    <div className="p-3 text-center" style={{ backgroundColor: '#0B0B0F', border: '1px solid #1E1E22', borderRadius: 10 }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", color: farge, fontSize: 26, lineHeight: 1 }}>{verdi}</p>
      <p className="text-xs tracking-widest uppercase mt-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        {label}
      </p>
    </div>
  )
}

const knappPrimar: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
  backgroundColor: COACH_BLUE, color: '#F0F0F2',
  border: 'none', borderRadius: 999, padding: '8px 16px', cursor: 'pointer',
}
const knappSekundar: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#8A8A96', background: 'none',
  border: '1px solid #2A2A33', borderRadius: 999, padding: '8px 14px', cursor: 'pointer',
}
