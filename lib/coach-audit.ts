// SKRIVING TIL coach_audit_log - ett sted, delt av alle (Sverre 16. sep 2026).
//
// Loggen har ligget der siden fase 26 med riktig RLS: utøveren leser sine
// egne rader («Athlete reads own logs»), og innsettingen krever en AKTIV
// relasjon til utøveren. Men den ble bare skrevet ett sted i hele
// kodebasen - coach-push.ts, når en mal ble pushet. Alt annet en trener
// gjorde, forsvant sporløst.
//
// Hjelperen lå privat i den fila. Nå bor den her, så neste skriver ikke
// lager sin egen variant (regel 11).
//
// AUDIT-SVIKT SKAL ALDRI BLOKKERE HANDLINGEN. Feiler loggingen, er det
// verre å nekte treneren å lagre enn å miste én logglinje - så den svelges
// og logges server-side. Det er et valg, ikke en forglemmelse.

import type { Endring } from '@/lib/endringslogg'

/** Det loggen trenger. Holdt smalt så enhver klient kan sendes inn. */
type Skriver = {
  from: (t: string) => { insert: (rad: Record<string, unknown>) => PromiseLike<{ error: unknown }> }
}

export interface AuditRad {
  coachId: string
  athleteId: string
  /** Hva som skjedde: 'oppdatert', 'opprettet', 'slettet', 'pushet' ... */
  actionType: string
  /** Hva det skjedde med: 'workout', 'terskel', 'ski_test' ... */
  entityType: string
  entityId: string | null
  details?: unknown
}

export async function skrivAudit(supabase: unknown, rad: AuditRad): Promise<void> {
  try {
    const { error } = await (supabase as Skriver).from('coach_audit_log').insert({
      coach_id: rad.coachId,
      athlete_id: rad.athleteId,
      action_type: rad.actionType,
      entity_type: rad.entityType,
      entity_id: rad.entityId,
      details: rad.details ?? null,
    })
    if (error) console.error('[coach-audit] logging feilet:', error)
  } catch (e) {
    console.error('[coach-audit] logging kastet:', e)
  }
}

/**
 * Loggfør en endring med HVA som ble endret.
 *
 * Skriver ingenting når ingenting endret seg - en trener som åpner og
 * lukker en økt skal ikke fylle utøverens logg med tomme linjer.
 */
export async function loggEndringer(
  supabase: unknown,
  rad: Omit<AuditRad, 'actionType' | 'details'> & { actionType?: string },
  endringer: Endring[],
): Promise<void> {
  if (endringer.length === 0) return
  await skrivAudit(supabase, {
    ...rad,
    actionType: rad.actionType ?? 'oppdatert',
    details: { endringer },
  })
}
