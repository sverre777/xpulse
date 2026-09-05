// SKYTING KUN FOR SKISKYTTERE (Sverre 5. sep 2026): ÉN regel, ÉN kilde.
// Alt som gjelder skyting/skiskyting tilbys bare når BRUKEREN (eller
// utøveren i trenervisning) har skiskyting som primær eller sekundær sport
// i profilen. Øktas sport kan brukes i tillegg — aldri i stedet.
// Eksisterende skytedata VISES fortsatt (lesing) selv om skiskyting er
// fjernet fra profilen; det er de NYE valgene som skjules.
import type { Sport } from './types'

export function harSkiskyting(userSports: readonly Sport[] | readonly string[] | null | undefined): boolean {
  return !!userSports && (userSports as readonly string[]).includes('biathlon')
}

/** Sportene fra en profil (primær + sekundære, uten dubletter). */
export function sporterFraProfil(profil: { primary_sport?: string | null; secondary_sports?: string[] | null } | null | undefined): Sport[] {
  const primaer = (profil?.primary_sport as Sport | null | undefined) ?? 'running'
  const sekundaere = (profil?.secondary_sports as Sport[] | null | undefined) ?? []
  return Array.from(new Set<Sport>([primaer, ...sekundaere]))
}
