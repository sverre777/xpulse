export default function AnalysePage() {
  return (
    <div style={{ backgroundColor: '#0A0A0B', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <span style={{ width: '32px', height: '3px', backgroundColor: '#FF4500', display: 'inline-block' }} />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '36px', letterSpacing: '0.08em' }}>
            Analyse
          </h1>
        </div>
        <div className="p-12 text-center" style={{ border: '1px dashed #1E1E22' }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '16px', letterSpacing: '0.05em' }}>
            Kommer snart
          </p>
        </div>
      </div>
    </div>
  )
}
