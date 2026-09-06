// Supabase-embed av en 1:1-relasjon kommer som OBJEKT, ikke liste (workout_competition_data
// har unik workout_id). Eldre kode leste `?.[0]` og fikk undefined — én hjelper som tåler begge.
export function forsteEmbed<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}
