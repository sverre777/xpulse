'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTargetUser } from '@/lib/target-user'
import { ZONE_NAMES, type ZoneName } from '@/lib/heart-zones'
import { resolveTerskel, type TerskelDbRad } from '@/lib/terskel-oppslag'

// Prestasjonsmodellen bolk 1 (fase 110): terskler som data.
// ÉN fasit-tabell (user_thresholds) per bruker × bevegelsesform ×
// underkategori, VERSJONERT med valid_from — aldri overskrevet (samme
// dato = korreksjon, ny dato = ny versjon). '' betyr «hele
// bevegelsesformen» (arvenivå); '' × '' er globalt fallback-nivå.
// Soner per bevegelsesform bor i user_heart_zones med samme nøkkel
// ('' × '' = dagens globale rader). Regel 24: ingen type-re-eksport.

export interface TerskelVersjon {
  threshold_hr: number
  threshold_pace_sec_km: number | null
  ftp_watts: number | null
  valid_from: string
}

export interface TerskelRad {
  movement_name: string
  movement_subcategory: string
  gjeldende: TerskelVersjon
  // Eldste først — historikk-linja («167 → 170 ▲ 12. mai»).
  historikk: TerskelVersjon[]
  harEgneSoner: boolean
}

export interface EgneSonerRad {
  zone_name: ZoneName
  min_bpm: number
  max_bpm: number
}

function revalider() {
  revalidatePath('/app/innstillinger/profil/terskler')
}

// Hele oversikten for flaten: hver nøkkel med gjeldende versjon +
// historikk + egne soner-status. Trener med plan-rett ser og skriver
// SAMME innstilling som utøveren (delt innstilling, aldri kopi).
export async function hentTerskelOversikt(
  targetUserId?: string,
): Promise<
  | { rader: TerskelRad[]; soneNokler: { movement_name: string; movement_subcategory: string }[] }
  | { error: string }
> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan', 'read')
  if ('error' in resolved) return { error: resolved.error }

  const { data: rows, error } = await supabase
    .from('user_thresholds')
    .select('movement_name, movement_subcategory, threshold_hr, threshold_pace_sec_km, ftp_watts, valid_from')
    .eq('user_id', resolved.userId)
    .order('valid_from')
  if (error) return { error: error.message }

  // Alle sone-nøkler — også globalnivået ('' × '', dagens rader) og
  // nøkler med soner men uten terskel (UI-et viser dem som rader).
  const { data: soneRader } = await supabase
    .from('user_heart_zones')
    .select('movement_name, movement_subcategory')
    .eq('user_id', resolved.userId)
  const soneNokler: { movement_name: string; movement_subcategory: string }[] = []
  const harSoner = new Set<string>()
  for (const r of soneRader ?? []) {
    const key = `${r.movement_name}|${r.movement_subcategory}`
    if (!harSoner.has(key)) {
      harSoner.add(key)
      soneNokler.push({ movement_name: r.movement_name, movement_subcategory: r.movement_subcategory })
    }
  }

  const byKey = new Map<string, TerskelRad>()
  for (const r of rows ?? []) {
    const key = `${r.movement_name}|${r.movement_subcategory}`
    const v: TerskelVersjon = {
      threshold_hr: r.threshold_hr,
      threshold_pace_sec_km: r.threshold_pace_sec_km,
      ftp_watts: r.ftp_watts,
      valid_from: r.valid_from,
    }
    const eksisterende = byKey.get(key)
    if (eksisterende) {
      eksisterende.historikk.push(v)
      eksisterende.gjeldende = v // radene kommer stigende på valid_from
    } else {
      byKey.set(key, {
        movement_name: r.movement_name,
        movement_subcategory: r.movement_subcategory,
        gjeldende: v,
        historikk: [v],
        harEgneSoner: harSoner.has(key),
      })
    }
  }
  return { rader: [...byKey.values()], soneNokler }
}

// Lagre terskel: ny valid_from = ny versjonsrad; samme valid_from som
// en eksisterende rad = korreksjon av den versjonen (upsert). Verdier
// UPDATEs aldri på tvers av versjoner.
export async function lagreTerskel(
  input: {
    movement_name: string
    movement_subcategory: string
    threshold_hr: number
    threshold_pace_sec_km: number | null
    ftp_watts: number | null
    valid_from: string
  },
  targetUserId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan')
  if ('error' in resolved) return { error: resolved.error }

  if (!Number.isFinite(input.threshold_hr) || input.threshold_hr < 60 || input.threshold_hr > 250) {
    return { error: 'Terskelpuls må være mellom 60 og 250' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.valid_from)) {
    return { error: 'Ugyldig gjelder fra-dato' }
  }
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('user_thresholds')
    .upsert({
      user_id: resolved.userId,
      movement_name: input.movement_name,
      movement_subcategory: input.movement_subcategory,
      threshold_hr: Math.round(input.threshold_hr),
      threshold_pace_sec_km: input.threshold_pace_sec_km,
      ftp_watts: input.ftp_watts,
      valid_from: input.valid_from,
      created_by: user?.id ?? null,
    }, { onConflict: 'user_id,movement_name,movement_subcategory,valid_from' })
  if (error) return { error: error.message }
  revalider()
  return {}
}

// Terskelen som gjaldt på en gitt DATO for en nøkkel, med arv:
// underkategori → bevegelsesform ('') → globalt nivå ('' × '').
// Brukes av sone-/IF-/TSS-beregningene i senere bolker — én kilde.
export async function hentTerskelForDato(
  dato: string,
  movementName: string,
  movementSubcategory: string,
  targetUserId?: string,
): Promise<TerskelVersjon | null | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, ['can_edit_plan', 'can_view_dagbok'], 'read')
  if ('error' in resolved) return { error: resolved.error }

  const { data } = await supabase
    .from('user_thresholds')
    .select('movement_name, movement_subcategory, threshold_hr, threshold_pace_sec_km, ftp_watts, valid_from')
    .eq('user_id', resolved.userId)
  const rad = resolveTerskel(
    (data ?? []) as TerskelDbRad[], dato, movementName, movementSubcategory,
  )
  if (!rad) return null
  return {
    threshold_hr: rad.threshold_hr,
    threshold_pace_sec_km: rad.threshold_pace_sec_km,
    ftp_watts: rad.ftp_watts,
    valid_from: rad.valid_from,
  }
}

// ── Egne soner per bevegelsesform ('' × '' = globalnivået) ──
// Toggle AV = slett radene for nøkkelen → Olympiatoppens standard fra
// terskel/makspuls gjelder (dagens oppførsel, default).

export async function hentEgneSoner(
  movementName: string,
  movementSubcategory: string,
  targetUserId?: string,
): Promise<EgneSonerRad[] | { error: string }> {
  const supabase = await createClient()
  const resolved = await resolveTargetUser(supabase, targetUserId, 'can_edit_plan', 'read')
  if ('error' in resolved) return { error: resolved.error }
  const { data, error } = await supabase
    .from('user_heart_zones')
    .select('zone_name, min_bpm, max_bpm')
    .eq('user_id', resolved.userId)
    .eq('movement_name', movementName)
    .eq('movement_subcategory', movementSubcategory)
  if (error) return { error: error.message }
  const byName = new Map((data ?? []).map(z => [z.zone_name, z]))
  return ZONE_NAMES.filter(n => byName.has(n)).map(n => byName.get(n)! as EgneSonerRad)
}

export async function lagreEgneSoner(
  movementName: string,
  movementSubcategory: string,
  soner: { zone_name: ZoneName; min_bpm: number; max_bpm: number }[],
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  if (soner.length !== ZONE_NAMES.length
      || !ZONE_NAMES.every(n => soner.some(s => s.zone_name === n))) {
    return { error: 'Alle fem soner (I1–I5) må ha verdier' }
  }
  for (const s of soner) {
    if (!Number.isFinite(s.min_bpm) || !Number.isFinite(s.max_bpm) || s.max_bpm <= s.min_bpm) {
      return { error: `${s.zone_name}: øvre grense må være høyere enn nedre` }
    }
  }
  const { error } = await supabase
    .from('user_heart_zones')
    .upsert(soner.map(s => ({
      user_id: user.id,
      movement_name: movementName,
      movement_subcategory: movementSubcategory,
      zone_name: s.zone_name,
      min_bpm: Math.round(s.min_bpm),
      max_bpm: Math.round(s.max_bpm),
    })), { onConflict: 'user_id,movement_name,movement_subcategory,zone_name' })
  if (error) return { error: error.message }
  updateTag(`heart-zones-${user.id}`)
  revalider()
  return {}
}

export async function slaaAvEgneSoner(
  movementName: string,
  movementSubcategory: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }
  const { error } = await supabase
    .from('user_heart_zones')
    .delete()
    .eq('user_id', user.id)
    .eq('movement_name', movementName)
    .eq('movement_subcategory', movementSubcategory)
  if (error) return { error: error.message }
  updateTag(`heart-zones-${user.id}`)
  revalider()
  return {}
}

// Helse-gruppa (flyttet fra Innstillinger › Helse og soner): makspuls +
// hvilepuls. Terskelen bor i tabellen over.
// profiles.lactate_threshold_hr er FROSSET (Sverre 28. aug, alt. A):
// leses ikke (terskel-analysen byttet kilde), skrives ikke —
// kolonnen pensjoneres i egen opprydding.
export async function lagreHelseProfil(
  input: { max_heart_rate: string; resting_heart_rate: string },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const tall = (s: string, lo: number, hi: number, navn: string): number | null | string => {
    const t = s.trim()
    if (!t) return null
    const n = parseInt(t, 10)
    if (!Number.isFinite(n) || n < lo || n > hi) return `${navn} må være mellom ${lo} og ${hi}`
    return n
  }
  const maks = tall(input.max_heart_rate, 100, 250, 'Makspuls')
  if (typeof maks === 'string') return { error: maks }
  const hvile = tall(input.resting_heart_rate, 20, 120, 'Hvilepuls')
  if (typeof hvile === 'string') return { error: hvile }

  const { error } = await supabase
    .from('profiles')
    .update({ max_heart_rate: maks, resting_heart_rate: hvile })
    .eq('id', user.id)
  if (error) return { error: error.message }
  updateTag(`heart-zones-${user.id}`)
  revalider()
  return {}
}
