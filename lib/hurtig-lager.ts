// Husket hurtigoppsett PER ØKT (Sverre 5. sep 2026): oppsettet i
// hurtigoppsettet (rader, bev.form, skyting, oppvarming/nedjogg) huskes for
// økta, så man kan endre og opprette på nytt — også etter at byggeren har
// vært lukket. localStorage, ingen SQL. Nøkkelen er øktas id; en NY økt
// bruker «ny» og flyttes til id-en når økta lagres (WorkoutForm).
const PREFIX = 'xpulse-hurtig:'

/** Én bolk i hurtigoppsettet: dragradene + det som gjelder bolken. */
export interface HurtigBolk<Rad = unknown> {
  rader: Rad[]
  fartEnhet: string
  bev: string
  sub: string
  skyting: string
  skytetid: string
}

export interface HurtigLager<Rad = unknown> extends HurtigBolk<Rad> {
  opp: string
  ned: string
  /** Sverre 5. sep («endre og opprett på nytt = overskriv»): flere bolker i
      samme oppsett. Feltene over er BOLK 1 (bakoverkompatibelt), resten her. */
  bolker?: HurtigBolk<Rad>[]
}

export function lesHurtigLager<Rad = unknown>(nokkel: string): HurtigLager<Rad> | null {
  try {
    const raa = typeof window !== 'undefined' ? window.localStorage.getItem(PREFIX + nokkel) : null
    if (!raa) return null
    const v = JSON.parse(raa) as Partial<HurtigLager<Rad>>
    if (!Array.isArray(v.rader) || v.rader.length === 0) return null
    return {
      rader: v.rader, fartEnhet: v.fartEnhet ?? 'min_per_km', bev: v.bev ?? '', sub: v.sub ?? '',
      skyting: v.skyting ?? '', skytetid: v.skytetid ?? '45', opp: v.opp ?? '20:00', ned: v.ned ?? '15:00',
      bolker: Array.isArray(v.bolker) ? v.bolker.filter(b => b && Array.isArray(b.rader) && b.rader.length > 0) : [],
    }
  } catch { return null }
}

export function skrivHurtigLager(nokkel: string, v: HurtigLager): void {
  try { window.localStorage.setItem(PREFIX + nokkel, JSON.stringify(v)) } catch { /* privat modus o.l. */ }
}

/** Ny økt lagret: oppsettet under «ny» følger økta til id-en. */
export function flyttHurtigLager(fra: string, til: string): void {
  try {
    const raa = window.localStorage.getItem(PREFIX + fra)
    if (!raa) return
    window.localStorage.setItem(PREFIX + til, raa)
    window.localStorage.removeItem(PREFIX + fra)
  } catch { /* privat modus o.l. */ }
}
