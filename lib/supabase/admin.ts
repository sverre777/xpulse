import { createClient } from '@supabase/supabase-js'

// Service-role-klient for system-jobs (cron-poller, webhooks). Bypasser
// RLS — bruk kun fra trygde server-context der vi vet hvem operasjonen
// gjelder for. Aldri eksponert mot klient.
//
// Krever SUPABASE_SERVICE_ROLE_KEY i env. Ikke prefikset med NEXT_PUBLIC_
// så den aldri lekkes til klient-bundle.

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'createAdminClient: NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY ' +
      'må være satt i env. Service-role brukes kun fra cron/webhook-jobs.'
    )
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
