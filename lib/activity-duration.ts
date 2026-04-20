// Parse "MM:SS", "HH:MM:SS", or a bare number ("45") → seconds.
// Returns null for empty/invalid input.
export function parseActivityDuration(input: string): number | null {
  const s = input.trim()
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
