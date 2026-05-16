import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSubscription, hasActiveAccess, tierLabel, tierPriceMonthly } from '@/lib/subscriptions'
import { ManageBillingButton } from './ManageBillingButton'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ checkout?: string; expired?: string; session_id?: string }>
}

const STATUS_INFO: Record<string, { text: string; color: string }> = {
  active:             { text: 'Aktiv',             color: '#28A86E' },
  trialing:           { text: 'Prøveperiode',      color: '#28A86E' },
  past_due:           { text: 'Forfallet betaling', color: '#E11D48' },
  canceled:           { text: 'Kansellert',        color: '#8A8A96' },
  incomplete:         { text: 'Ufullført',         color: '#FFB300' },
  incomplete_expired: { text: 'Utløpt',            color: '#8A8A96' },
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
  const isExpired = sp.expired === 'true'

  const sub = await getActiveSubscription(supabase, user.id)
  const active = hasActiveAccess(sub)
  const statusInfo = sub ? STATUS_INFO[sub.status] ?? { text: sub.status, color: '#8A8A96' } : null

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
          <Toast color="#28A86E" text="✓ Abonnementet er aktivert. Detaljene under oppdateres når Stripe-webhook ankommer." />
        )}

        {isExpired && (
          <Toast color="#E11D48"
            text="Tilgangen din til X-PULSE er pauset. Aktiver eller endre abonnement under for å fortsette." />
        )}

        {!sub ? (
          <section className="p-6"
            style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
            <h2 className="mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '20px', letterSpacing: '0.04em' }}>
              Ingen aktivt abonnement
            </h2>
            <p className="mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '14px', lineHeight: 1.6 }}>
              30 dagers gratis prøve på Athlete Pro, Trener Basic og Trener Pro. Promo-kode kan brukes ved kassen.
            </p>
            <Link href="/onboarding/abonnement"
              className="inline-block px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                backgroundColor: '#FF4500', color: '#FFFFFF', textDecoration: 'none',
              }}>
              Velg abonnement →
            </Link>
          </section>
        ) : (
          <>
            <section className="p-6"
              style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '24px', letterSpacing: '0.04em', margin: 0 }}>
                  {tierLabel(sub.tier)} · {tierPriceMonthly(sub.tier)} kr/mnd
                </h2>
                {statusInfo && (
                  <span className="px-2 py-0.5 text-xs tracking-widest uppercase"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      color: statusInfo.color,
                      border: `1px solid ${statusInfo.color}`,
                    }}>
                    {sub.status === 'trialing' && daysUntil(sub.trial_end) != null
                      ? `${statusInfo.text} — ${daysUntil(sub.trial_end)} dager igjen`
                      : statusInfo.text}
                  </span>
                )}
              </div>

              <dl className="space-y-2 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
                {sub.status === 'trialing' && (
                  <Row label="Prøveperioden slutter" value={fmtDate(sub.trial_end)} />
                )}
                {sub.status === 'active' && sub.cancel_at_period_end && (
                  <Row label="Abonnement kanselleres"
                    value={`${fmtDate(sub.current_period_end)} — du beholder tilgang til denne datoen`} />
                )}
                {sub.status === 'active' && !sub.cancel_at_period_end && (
                  <Row label="Neste fakturering" value={fmtDate(sub.current_period_end)} />
                )}
                {sub.status === 'past_due' && (
                  <Row label="Betaling feilet"
                    value="Oppdater betalingsmetode for å unngå at tilgangen suspenderes." />
                )}
                {(sub.status === 'canceled' || sub.status === 'incomplete_expired' || sub.status === 'unpaid') && (
                  <Row label="Status"
                    value={`Tilgang opphørt ${fmtDate(sub.current_period_end)}. Aktiver for å fortsette.`} />
                )}
              </dl>
            </section>

            <section className="mt-4 p-6"
              style={{ backgroundColor: '#13131A', border: '1px solid #1E1E22' }}>
              <h3 className="mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '16px', letterSpacing: '0.04em', margin: 0 }}>
                Administrer abonnement
              </h3>
              <p className="mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96', fontSize: '13px', lineHeight: 1.6 }}>
                Endre tier, oppdater betalingsmetode, last ned faktura eller kanseller — alt via Stripe sin sikre kundeportal.
              </p>
              <ManageBillingButton
                label={
                  sub.status === 'canceled' || sub.status === 'incomplete_expired'
                    ? 'Aktiver abonnement på nytt'
                    : sub.status === 'past_due'
                      ? 'Oppdater betalingsmetode'
                      : 'Administrer abonnement'
                }
                accent={active && sub.status !== 'past_due' ? '#FF4500' : '#E11D48'}
              />
            </section>
          </>
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

function Toast({ color, text }: { color: string; text: string }) {
  return (
    <div className="mb-4 p-3"
      style={{
        backgroundColor: `${color}14`,
        border: `1px solid ${color}66`,
        borderLeft: `3px solid ${color}`,
      }}>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color, fontSize: '13px' }}>
        {text}
      </p>
    </div>
  )
}
