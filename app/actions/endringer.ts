'use server'

// HVA TRENEREN ENDRET PÅ ÉN ØKT (Sverre 16. sep 2026).
//
// Leser coach_audit_log. RLS gjør jobben: «Athlete reads own logs» gir
// utøveren sine egne rader, «Coach reads own logs» gir treneren sine.
// Ingen ekstra rettighetssjekk her - den ville vært en ANNEN regel enn
// databasens, og to regler blir før eller siden uenige.
//
// Hentes ved KLIKK, ikke ved hver visning av en økt: hjelpefeltene på
// workouts (fase 129) sier at noe ble endret og av hvem, og det er nok til
// å tegne linja. Detaljene koster en rundtur, og den tas bare når utøveren
// faktisk spør.

import { createClient } from '@/lib/supabase/server'

export async function hentEndringer(
  workoutId: string,
): Promise<{ endringer: { navn: string; fra: string | null; til: string | null }[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('coach_audit_log')
    .select('details, created_at')
    .eq('entity_type', 'workout')
    .eq('entity_id', workoutId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return { error: error.message }

  const rad = (data ?? [])[0] as { details?: unknown } | undefined
  const raa = (rad?.details as { endringer?: unknown })?.endringer
  if (!Array.isArray(raa)) return { endringer: [] }

  // Loggen er skrevet av oss, men leses som data: bare det vi kjenner igjen
  // slipper ut, og alt gjøres til tekst før det når skjermen.
  const tekst = (v: unknown) => (v === null || v === undefined ? null : String(v))
  return {
    endringer: raa
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map(e => ({ navn: String(e.navn ?? e.felt ?? 'Felt'), fra: tekst(e.fra), til: tekst(e.til) })),
  }
}
