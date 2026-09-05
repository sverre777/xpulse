// YTELSE bolk 2 (Sverre 5. sep 2026): ÉN kilde for kalenderens tidsområde —
// uke / måned / år ut fra visning + referansedato, og posisjonen fra URL-en
// (cv/cd). Sidene (DagbokPageView/PlanPageView) henter NØYAKTIG området
// klienten vil vise og sender «serverRange» med; Calendar hopper over
// mount-henting når serverRange er det ønskede området. Ren logikk, delt
// av server og klient.

export type KalenderVisning = 'uke' | 'måned' | 'år'

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Mandag–søndag rundt datoen. */
export function buildWeekDates(ref: Date): Date[] {
  const dow = (ref.getDay() + 6) % 7
  const mon = new Date(ref); mon.setDate(ref.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
}

export function getDateRange(v: KalenderVisning, ref: Date): { start: Date; end: Date } {
  if (v === 'uke') {
    const wk = buildWeekDates(ref)
    return { start: wk[0], end: wk[6] }
  }
  if (v === 'år') {
    return { start: new Date(ref.getFullYear(), 0, 1), end: new Date(ref.getFullYear(), 11, 31) }
  }
  return { start: new Date(ref.getFullYear(), ref.getMonth(), 1), end: new Date(ref.getFullYear(), ref.getMonth() + 1, 0) }
}

export function getPrevRange(v: KalenderVisning, ref: Date): { start: Date; end: Date } | null {
  if (v === 'uke') {
    const p = new Date(ref); p.setDate(ref.getDate() - 7)
    return getDateRange('uke', p)
  }
  if (v === 'måned') {
    const p = new Date(ref.getFullYear(), ref.getMonth() - 1, 15)
    return getDateRange('måned', p)
  }
  // År: forrige kalenderår — driver årssammendragets delta i YearView.
  if (v === 'år') {
    return getDateRange('år', new Date(ref.getFullYear() - 1, 5, 15))
  }
  return null
}

export interface ServerOmraade { view: KalenderVisning; start: string; end: string }

export function erSammeOmraade(a: ServerOmraade | null | undefined, view: KalenderVisning, ref: Date): boolean {
  if (!a || a.view !== view) return false
  const { start, end } = getDateRange(view, ref)
  return a.start === toISO(start) && a.end === toISO(end)
}

/** Posisjonen fra URL-en (cv/cd) — samme validering som Calendar bruker. */
export function lesKalenderPosisjon(sp: { cv?: string | string[]; cd?: string | string[] } | null | undefined, fallbackView: KalenderVisning, naa: Date = new Date()): { view: KalenderVisning; refDate: Date; fraUrl: boolean } {
  const cv = Array.isArray(sp?.cv) ? sp?.cv[0] : sp?.cv
  const cd = Array.isArray(sp?.cd) ? sp?.cd[0] : sp?.cd
  const view: KalenderVisning = cv === 'uke' || cv === 'måned' || cv === 'år' ? cv : fallbackView
  let refDate = naa
  if (cd && /^\d{4}-\d{2}-\d{2}$/.test(cd)) {
    const [y, m, d] = cd.split('-').map(Number)
    const kandidat = new Date(y, m - 1, d)
    if (!Number.isNaN(kandidat.getTime())) refDate = kandidat
  }
  return { view, refDate, fraUrl: !!(cv || cd) }
}

/** ISO-ukenøkkel «2026-W36» (samme regel som notatene bruker). */
export function ukeNokkel(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const aarStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const uke = Math.ceil((((t.getTime() - aarStart.getTime()) / 86400000) + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(uke).padStart(2, '0')}`
}

export function maanedNokkel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
