// UNDERSIDENE bolk 3: laster forsidens scenemotor lat på en underside - ÉN gang per side.
// tokens.css (forsidens fargetokens, scopet på .xp-forside-tokens), runde3.css (scenenes
// CSS), ikoner.js (IK) og karusell.js (Scene, enScene, karusell). Scenefilene lastes av
// enScene selv (bare den fila scenen ligger i) eller av Scenerad (trener-raden).
declare global {
  interface Window {
    enScene?: (tittel: string, element: HTMLElement, opts?: { fil?: string }) => Promise<{ stopp: () => void }>
    lastScenefil?: (fil: string) => Promise<void>
    karusell?: (SC: unknown[], KAP: unknown[], P: string) => { stopp: () => void }
    KARUSELLER?: Record<string, { stopp: () => void }>
    SC3?: unknown[]
    KAP3?: unknown[]
  }
}

const skript = new Map<string, Promise<void>>()
export function lastSkript(src: string): Promise<void> {
  const eksisterende = skript.get(src)
  if (eksisterende) return eksisterende
  const p = new Promise<void>((ok, feil) => {
    const s = document.createElement('script')
    s.src = src; s.async = true
    s.onload = () => ok(); s.onerror = () => feil(new Error(`fant ikke ${src}`))
    document.head.appendChild(s)
  })
  skript.set(src, p)
  return p
}
export function lastCss(href: string): void {
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href
  document.head.appendChild(l)
}
let motor: Promise<void> | null = null
export function lastForsideMotor(): Promise<void> {
  if (motor) return motor
  lastCss('/forside/tokens.css'); lastCss('/forside/runde3.css')
  motor = lastSkript('/forside/ikoner.js').then(() => lastSkript('/forside/karusell.js'))
  return motor
}
