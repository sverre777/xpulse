// Lineær regresjon y = slope·x + intercept — ÉN kopi (regel 11): terskel-
// estimatet på serveren og laktatprofilen per bev.form i fanen bruker samme.
// null ved < 3 punkter eller nullvarians.
export function lineaerRegresjon(points: { x: number; y: number }[]):
  { slope: number; intercept: number; r2: number; n: number } | null {
  const n = points.length
  if (n < 3) return null
  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0, denX = 0, denY = 0
  for (const p of points) {
    const dx = p.x - meanX, dy = p.y - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  const slope = num / denX
  const intercept = meanY - slope * meanX
  const r = num / Math.sqrt(denX * denY)
  return { slope, intercept, r2: r * r, n }
}
