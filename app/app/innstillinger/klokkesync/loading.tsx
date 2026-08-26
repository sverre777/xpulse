// Umiddelbar navigasjons-feedback for klokkesync-innstillingene — uten denne
// står telefonen «død» mens server-renderen jobber, og trykket føles som om
// siden ikke åpner. Samme skeleton-språk som øvrige loading.tsx-flater.
export default function Loading() {
  return (
    <div style={{ backgroundColor: 'var(--flate-3)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse">
          <div style={{ width: 180, height: 28, background: 'var(--flate-14)', borderRadius: 8, marginBottom: 24 }} />
          <div style={{ height: 120, background: 'var(--flate-11-alt)', border: '1px solid var(--kant-3)', borderRadius: 14, marginBottom: 16 }} />
          <div style={{ height: 220, background: 'var(--flate-11-alt)', border: '1px solid var(--kant-3)', borderRadius: 14 }} />
        </div>
      </div>
    </div>
  )
}
