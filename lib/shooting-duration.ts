/**
 * Parse a MM:SS string (or plain integer seconds) into total seconds.
 * Empty/invalid returns null.
 */
export function parseDurationToSeconds(val: string): number | null {
  if (!val) return null
  if (val.includes(':')) {
    const [m, s] = val.split(':')
    const mn = parseInt(m) || 0
    const sc = parseInt(s) || 0
    const total = mn * 60 + sc
    return total > 0 ? total : null
  }
  const n = parseInt(val)
  return n > 0 ? n : null
}

/**
 * Format total seconds as MM:SS. null/0 → empty string.
 */
export function formatDurationFromSeconds(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
