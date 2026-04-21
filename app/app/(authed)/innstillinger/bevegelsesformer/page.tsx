import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserMovementTypes } from '@/app/actions/user-movement-types'
import { MovementTypesSection } from '@/components/settings/MovementTypesSection'

export default async function BevegelsesformerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const initial = await getUserMovementTypes()

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/app/innstillinger" className="text-xs tracking-widest uppercase hover:opacity-80 transition-opacity"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          ← Innstillinger
        </Link>

        <div className="flex items-center gap-3 mb-8 mt-4">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Bevegelsesformer
          </h1>
        </div>

        <p className="mb-6 text-sm"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Opprett dine egne bevegelsesformer i tillegg til standardlisten. Typen
          (utholdenhet, styrke, tur, annet) styrer hvilke felt som vises i
          aktivitetsraden.
        </p>

        <MovementTypesSection initial={initial} />
      </div>
    </div>
  )
}
