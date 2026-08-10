// Rute-skeleton vist av Next (loading.tsx) mens serverdata hentes ved
// navigasjon. Nav-en over forblir interaktiv — dette fyller bare
// innholdsflaten så siden ikke føles frossen.

export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6" aria-busy="true" aria-label="Laster innhold">
      <div className="animate-pulse">
        <div style={{ width: 110, height: 12, backgroundColor: '#1A1A22' }} />
        <div className="mt-3" style={{ width: 240, height: 38, backgroundColor: '#1A1A22' }} />
        <div className="mt-8 grid gap-3">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} style={{ height: 150, backgroundColor: '#13131A', border: '1px solid #1E1E22' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
