import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { hentTerskelOversikt } from '@/app/actions/terskler'
import { TersklerFlate, HelseGruppe, UtvidetSkalaBlokk } from '@/components/settings/TersklerFlate'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { MOVEMENT_CATEGORIES, isEnduranceMovement } from '@/lib/types'

// Prestasjonsmodellen bolk 1: «Profil › Terskler, soner & helse» —
// flyttet fra Innstillinger › Helse og soner (gammel rute redirecter
// hit). Fasit: design/xpulse-terskler-design.html, visning I.

export default async function TersklerPage() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/app')

  const [{ data: profile }, oversikt, { data: userTypes }] = await Promise.all([
    supabase.from('profiles')
      .select('birth_year, max_heart_rate, resting_heart_rate, utvidet_skala')
      .eq('id', user.id).single(),
    hentTerskelOversikt(),
    supabase.from('user_movement_types')
      .select('name, type, subcategories')
      .eq('user_id', user.id),
  ])

  // Velgeren: standard utholdenhets-bevegelsesformer + brukerens egne.
  const bevegelsesvalg = [
    ...MOVEMENT_CATEGORIES
      .filter(m => isEnduranceMovement(m.name))
      .map(m => ({ name: m.name, subcategories: m.subcategories ?? [] })),
    ...(userTypes ?? [])
      .filter(t => t.type === 'utholdenhet')
      .map(t => ({ name: t.name as string, subcategories: (t.subcategories ?? []) as string[] })),
  ]

  const rader = 'error' in oversikt ? [] : oversikt.rader
  const soneNokler = 'error' in oversikt ? [] : oversikt.soneNokler

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <SettingsPageHeader title="Terskler, soner & helse" />
        <p className="mb-6 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}>
          <Link href="/app/innstillinger/profil" style={{ color: 'var(--tekst-5-app)' }}>Profil</Link>
          {' › '}
          <b style={{ color: 'var(--tekst-3-app)' }}>Terskler, soner & helse</b>
          {' '}— terskelen versjoneres per bevegelsesform og underkategori;
          soner, IF og TSS leser herfra. En økt bruker terskelen som gjaldt
          på øktas dato.
        </p>
        <TersklerFlate
          rader={rader}
          soneNokler={soneNokler}
          bevegelsesvalg={bevegelsesvalg}
          birthYear={profile?.birth_year ?? null}
          initialMaxHr={profile?.max_heart_rate ?? null}
        />
        <UtvidetSkalaBlokk initialPaa={profile?.utvidet_skala === true} />
        <HelseGruppe
          birthYear={profile?.birth_year ?? null}
          initialMaxHr={profile?.max_heart_rate ?? null}
          initialResting={profile?.resting_heart_rate ?? null}
        />
      </div>
    </div>
  )
}
