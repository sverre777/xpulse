// Parse "MM:SS", "HH:MM:SS", or a bare number ("45") → seconds.
// Returns null for empty/invalid input.
//
// Tåler også verdier som IKKE er strenger (14. sep 2026): et jsonb-felt kan
// bære et tall fra en eldre skriver eller en import, og en kastende parser her
// tok ned hele siden («This page couldn't load»). Vi gjetter ikke på enheten -
// ikke-strenger gir null, og normaliseringen skjer der jsonb leses.
export function parseActivityDuration(input: string | null | undefined): number | null {
  const s = typeof input === 'string' ? input.trim() : ''
  if (!s) return null
  if (/^\d+$/.test(s)) {
    const mins = parseInt(s, 10)
    return Number.isFinite(mins) ? mins * 60 : null
  }
  const parts = s.split(':').map(p => p.trim())
  if (parts.some(p => !/^\d+$/.test(p))) return null
  const nums = parts.map(p => parseInt(p, 10))
  if (nums.length === 2) {
    const [m, sec] = nums
    return m * 60 + sec
  }
  if (nums.length === 3) {
    const [h, m, sec] = nums
    return h * 3600 + m * 60 + sec
  }
  return null
}

// Format seconds → "MM:SS" (<1h) or "HH:MM:SS" (≥1h).
export function formatActivityDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || totalSeconds < 0) return ''
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
