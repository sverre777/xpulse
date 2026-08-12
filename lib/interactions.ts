// Små taktile/visuelle kvitteringer. Kun klient-side; alle kall er trygge
// no-ops der API-et mangler (iOS Safari har f.eks. ikke navigator.vibrate).

export function hapticTap(pattern: number | number[] = 15) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    // haptikk skal aldri kunne krasje noe
  }
}

// Kort ✓-kvittering midt på skjermen (ikke-blokkerende, pointer-events none).
// Fjerner seg selv; respekterer prefers-reduced-motion via CSS (display:none).
export function showCompletionCheck() {
  try {
    if (typeof document === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const el = document.createElement('div')
    el.className = 'xp-check-pop'
    el.setAttribute('aria-hidden', 'true')
    el.innerHTML = '<span>✓</span>'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 800)
  } catch {
    // ren pynt — aldri krasj
  }
}
