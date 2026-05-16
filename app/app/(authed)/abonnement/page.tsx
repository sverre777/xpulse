import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Placeholder for Fase F. Viser nåværende tier, status og perioder fra
// subscriptions-tabellen. Full Customer Portal-integrasjon (endre tier,
// betalingsmetode, faktura, kansellering) bygges i Fase F.

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ checkout?: string; session_id?: string }>
}

const TIER_LABEL: Record<string, string> = {
  athlete_pro: 'Athlete Pro · 59 kr/mnd',
  trener_basic: 'Trener Basic · 199 kr/mnd',
  trener_pro: 'Trener Pro · 279 kr/mnd',
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  active:             { text: 'Aktiv',             color: '#28A86E' },
  trialing:           { text: 'Prøveperiode',      color: '#28A86E' },
  past_due:           { text: 'Forfalt',           color: '#E11D48' },
  canceled:           { text: 'Kansellert',        color: '#8A8A96' },
  incomplete:         { text: 'Ufullført',         color: '#FFB300' },
  incomplete_expired: { text: 'Utløpt ufullført',  color: '#8A8A96' },
  unpaid:             { text: 'Ubetalt',           color: '#E11D48' },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'long', year: 'numeric' })
}
function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

export default async function AbonnementPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/app')

  const sp = await searchParams
  const justCompleted = sp.checkout === 'success'

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, status, current_period_end, trial_end, cancel_at_period_end, stripe_subscription_id, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const statusInfo = sub ? STATUS_LABEL[sub.status] ?? { text: sub.status, color: '#8A8A96' } : null
  const tierLabel = sub ? TIER_LABEL[sub.tier] ?? sub.tier : null
  const trialDaysLeft = sub?.status === 'trialing' ? daysUntil(sub.trial_end) : null

  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <span style={{ width: '24px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '32px', letterSpacing: '0.08em' }}>
            Abonnement
          </h1>
        </div>

        {justCompleted && (
          <div className="mb-4 p-3"
            style={{
              backgroundColor: 'rgba(40,168,110,0.08)',
              border: '1px solid rgba(40,168,110,0.4)',
              borderLeft: '3px solid #28A86E',
            }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E', fontSize: '13px' }}>
              ✓ Abonnementet er aktivert. Webhook fra Stripe oppdaterer detaljene under når den ankommer.
            </p>
          </div>
        )}

        {!sub ? (
          <section className="p-6"
            style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
            <h2 className="mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.04em' }}>
              Ingen aktivt abonnement
            </h2>
            <p className="mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px', lineHeight: 1.6 }}>
              Du har 30 dagers gratis prøve på Athlete Pro, Trener Basic og Trener Pro.
              Velg planen som passer deg.
            </p>
            <Link href="/#priser"
              className="inline-block px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#FF4500', color: '#FFFFFF', textDecoration: 'none',
              }}>
              Se priser →
            </Link>
          </section>
        ) : (
          <section className="p-6"
            style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '22px', letterSpacing: '0.04em', margin: 0 }}>
                {tierLabel}
              </h2>
              {statusInfo && (
                <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: statusInfo.color,
                    border: `1px solid ${statusInfo.color}`,
                  }}>
                  {statusInfo.text}
                </span>
              )}
            </div>

            <dl className="space-y-2 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
              {sub.status === 'trialing' && (
                <Row label="Prøveperioden slutter"
                  value={`${fmtDate(sub.trial_end)}${trialDaysLeft != null ? ` — ${trialDaysLeft} dager igjen` : ''}`} />
              )}
              {sub.status === 'active' && sub.current_period_end && (
                <Row label={sub.cancel_at_period_end ? 'Abonnement kanselleres' : 'Neste fakturering'}
                  value={fmtDate(sub.current_period_end)} />
              )}
              {sub.status === 'past_due' && (
                <Row label="Status"
                  value="Betaling feilet. Oppdater betalingsmetode for å unngå at tilgangen suspenderes." />
              )}
              {sub.status === 'canceled' && (
                <Row label="Kansellert"
                  value="Tilgang opphørte ved periodeslutt. Aktiver på nytt for å fortsette." />
              )}
            </dl>

            <div className="mt-6 p-3"
              style={{ backgroundColor: 'rgba(255,176,0,0.05)', border: '1px solid rgba(255,176,0,0.3)' }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FFB300', fontSize: '12px', letterSpacing: '0.04em' }}>
                Endring av tier, betalingsmetode og kansellering via Stripe Customer Portal kommer i neste fase.
                Inntil da: kontakt <a href="mailto:support@x-pulse.no" style={{ color: '#FFB300', textDecoration: 'underline' }}>support@x-pulse.no</a>.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <dt className="text-xs tracking-widest uppercase" style={{ color: '#8A8A96' }}>
        {label}:
      </dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  )
}
