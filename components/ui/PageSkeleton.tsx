// Rute-skeleton vist av Next (loading.tsx) mens serverdata hentes ved
// navigasjon. Nav-en over forblir interaktiv — dette fyller bare
// innholdsflaten så siden ikke føles frossen.

export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-6" aria-busy="true" aria-label="Laster innhold">
      <div className="animate-pulse">
        <div style={{ width: 110, height: 12, backgroundColor: 'var(--flate-14)' }} />
        <div className="mt-3" style={{ width: 240, height: 38, backgroundColor: 'var(--flate-14)' }} />
        <div className="mt-8 grid gap-3">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} style={{ height: 150, backgroundColor: 'var(--flate-12-alt)', border: '1px solid var(--kant-3)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
