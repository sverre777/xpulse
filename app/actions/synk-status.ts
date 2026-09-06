'use server'

// NAVIGASJON v2 bolk 5 — status per kilde for Synk-arket. Leser de samme
// tabellene som klokkesync-innstillingene (strava_connections, polar_connections,
// stridee_link → stridee_connections per provider) — ingen ny synklogikk.
// «Nye økter hentet i dag» = importerte økter opprettet siste 24 t.

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { KLOKKESYNC_BRANDS } from '@/lib/klokkesync-brands'

export interface SynkKilde {
  slug: string
  name: string
  via: 'stridee' | null
  tilkoblet: boolean
  autoSynk: boolean
  lastSyncAt: string | null
  feil: boolean
  connectPath: string | null
}
export interface SynkStatus {
  kilder: SynkKilde[]
  lastSyncAt: string | null
  nyeIDag: number
}

export async function hentSynkStatus(): Promise<SynkStatus | { error: string }> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return { error: 'Ikke innlogget' }
  const siden = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const [strava, polar, stridee, nye] = await Promise.all([
    supabase.from('strava_connections').select('auto_sync, last_sync_at, token_expires_at').eq('user_id', user.id).maybeSingle(),
    supabase.from('polar_connections').select('auto_sync, last_sync_at, registered_at').eq('user_id', user.id).maybeSingle(),
    supabase.from('stridee_link').select('status, stridee_connections(provider, status, koblet_at)').eq('user_id', user.id).maybeSingle(),
    supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('imported_from', 'is', null).gte('created_at', siden),
  ])
  type StrideeKobling = { provider: string; status: string; koblet_at: string | null }
  const koblinger = ((stridee.data as { stridee_connections?: StrideeKobling[] | null } | null)?.stridee_connections ?? []).filter(k => k.status !== 'frakoblet')
  const kilder: SynkKilde[] = KLOKKESYNC_BRANDS.filter(b => b.status === 'live').map(b => {
    if (b.slug === 'strava') {
      const s = strava.data as { auto_sync: boolean | null; last_sync_at: string | null; token_expires_at: string | null } | null
      return { slug: b.slug, name: b.name, via: null, tilkoblet: !!s, autoSynk: !!s?.auto_sync, lastSyncAt: s?.last_sync_at ?? null, feil: !!s && !!s.token_expires_at && new Date(s.token_expires_at).getTime() < Date.now() && !!s.last_sync_at && Date.now() - new Date(s.last_sync_at).getTime() > 24 * 3600 * 1000, connectPath: b.connectPath ?? null }
    }
    if (b.slug === 'polar') {
      const p = polar.data as { auto_sync: boolean | null; last_sync_at: string | null; registered_at: string | null } | null
      return { slug: b.slug, name: b.name, via: null, tilkoblet: !!p, autoSynk: !!p?.auto_sync, lastSyncAt: p?.last_sync_at ?? null, feil: !!p && !p.registered_at, connectPath: b.connectPath ?? null }
    }
    const k = koblinger.find(x => x.provider === b.slug)
    return { slug: b.slug, name: b.name, via: 'stridee', tilkoblet: !!k, autoSynk: !!k, lastSyncAt: k?.koblet_at ?? null, feil: false, connectPath: b.connectPath ?? null }
  })
  const lastSyncAt = kilder.map(k => k.lastSyncAt).filter((v): v is string => !!v).sort().at(-1) ?? null
  return { kilder, lastSyncAt, nyeIDag: nye.count ?? 0 }
}
