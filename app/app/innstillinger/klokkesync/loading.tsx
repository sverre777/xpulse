// Umiddelbar navigasjons-feedback for klokkesync-innstillingene — uten denne
// står telefonen «død» mens server-renderen jobber, og trykket føles som om
// siden ikke åpner. Samme skeleton-språk som øvrige loading.tsx-flater.
export default function Loading() {
  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse">
          <div style={{ width: 180, height: 28, background: '#1A1A22', borderRadius: 8, marginBottom: 24 }} />
          <div style={{ height: 120, background: '#121218', border: '1px solid #1E1E22', borderRadius: 14, marginBottom: 16 }} />
          <div style={{ height: 220, background: '#121218', border: '1px solid #1E1E22', borderRadius: 14 }} />
        </div>
      </div>
    </div>
  )
}
