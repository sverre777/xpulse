'use client'

import { ShootingBlock, SHOOTING_BLOCK_TYPES } from '@/lib/types'

interface ShootingSectionProps {
  blocks: ShootingBlock[]
  onChange: (b: ShootingBlock[]) => void
}

const numSt: React.CSSProperties = {
  background: '#111115', border: '1px solid #1E1E22', outline: 'none',
  color: '#F0F0F2', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '14px', padding: '4px 8px', width: '60px', textAlign: 'center' as const,
}

const wideSt: React.CSSProperties = { ...numSt, width: '80px' }

function pct(hits: string, shots: string): number | null {
  const s = parseInt(shots), h = parseInt(hits)
  if (!s || s === 0) return null
  return Math.round((h / s) * 100)
}

function PctBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const color = value >= 90 ? '#28A86E' : value >= 70 ? '#FF8C00' : '#FF4500'
  return (
    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px', color, minWidth: '40px' }}>
      {value}%
    </span>
  )
}

function makeBlock(): ShootingBlock {
  return {
    id: crypto.randomUUID(), shooting_type: '',
    prone_shots: '', prone_hits: '', standing_shots: '', standing_hits: '',
    start_time: '', duration_seconds: '', avg_heart_rate: '',
  }
}

export function ShootingSection({ blocks, onChange }: ShootingSectionProps) {
  const addBlock = () => onChange([...blocks, makeBlock()])
  const removeBlock = (id: string) => onChange(blocks.filter(b => b.id !== id))
  const upd = (id: string, field: keyof ShootingBlock, val: string) =>
    onChange(blocks.map(b => b.id === id ? { ...b, [field]: val } : b))

  const totalShots = blocks.reduce((s, b) => s + (parseInt(b.prone_shots) || 0) + (parseInt(b.standing_shots) || 0), 0)
  const totalHits  = blocks.reduce((s, b) => s + (parseInt(b.prone_hits)  || 0) + (parseInt(b.standing_hits)  || 0), 0)
  const overallPct = totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : null

  return (
    <div>
      {blocks.length === 0 && (
        <p className="mb-3 text-xs" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340' }}>
          Ingen skyteserier lagt til ennå
        </p>
      )}

      {blocks.map((b, bi) => {
        const pronePct    = pct(b.prone_hits, b.prone_shots)
        const standingPct = pct(b.standing_hits, b.standing_shots)
        const blockShots  = (parseInt(b.prone_shots) || 0) + (parseInt(b.standing_shots) || 0)
        const blockHits   = (parseInt(b.prone_hits)  || 0) + (parseInt(b.standing_hits)  || 0)
        const blockPct    = blockShots > 0 ? Math.round((blockHits / blockShots) * 100) : null

        return (
          <div key={b.id} className="mb-4 pb-4" style={{ borderBottom: '1px solid #1A1A1E' }}>
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#8A8A96', fontSize: '14px', letterSpacing: '0.12em' }}>
                SERIE {bi + 1}
              </span>
              {blocks.length > 1 && (
                <button type="button" onClick={() => removeBlock(b.id)}
                  style={{ color: '#555560', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>
                  ×
                </button>
              )}
            </div>

            {/* Type buttons */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {SHOOTING_BLOCK_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => upd(b.id, 'shooting_type', t.value)}
                  className="px-2 py-1 text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    backgroundColor: b.shooting_type === t.value ? '#FF4500' : 'transparent',
                    color: b.shooting_type === t.value ? '#F0F0F2' : '#555560',
                    border: `1px solid ${b.shooting_type === t.value ? '#FF4500' : '#222228'}`,
                    cursor: 'pointer',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Results: Liggende + Stående */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <span className="text-xs tracking-widest uppercase block mb-1.5"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Liggende</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={b.prone_shots} onChange={e => upd(b.id, 'prone_shots', e.target.value)}
                    placeholder="skudd" min="0" max="100" style={numSt} />
                  <span style={{ color: '#333340', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif" }}>treff</span>
                  <input type="number" value={b.prone_hits} onChange={e => upd(b.id, 'prone_hits', e.target.value)}
                    placeholder="treff" min="0" max="100" style={numSt} />
                  <PctBadge value={pronePct} />
                </div>
              </div>

              <div>
                <span className="text-xs tracking-widest uppercase block mb-1.5"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Stående</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={b.standing_shots} onChange={e => upd(b.id, 'standing_shots', e.target.value)}
                    placeholder="skudd" min="0" max="100" style={numSt} />
                  <span style={{ color: '#333340', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif" }}>treff</span>
                  <input type="number" value={b.standing_hits} onChange={e => upd(b.id, 'standing_hits', e.target.value)}
                    placeholder="treff" min="0" max="100" style={numSt} />
                  <PctBadge value={standingPct} />
                </div>
              </div>
            </div>

            {/* Sekundære felt: klokkeslett, tid på serie, snittpuls */}
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <span className="text-xs tracking-widest uppercase block mb-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Klokkeslett</span>
                <input type="time" value={b.start_time} onChange={e => upd(b.id, 'start_time', e.target.value)}
                  style={wideSt} />
              </div>
              <div>
                <span className="text-xs tracking-widest uppercase block mb-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Tid på serie</span>
                <input type="text" value={b.duration_seconds}
                  onChange={e => upd(b.id, 'duration_seconds', e.target.value)}
                  placeholder="MM:SS" pattern="[0-9]{1,2}:[0-5][0-9]"
                  style={wideSt} />
              </div>
              <div>
                <span className="text-xs tracking-widest uppercase block mb-1"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>Snittpuls</span>
                <input type="number" value={b.avg_heart_rate}
                  onChange={e => upd(b.id, 'avg_heart_rate', e.target.value)}
                  placeholder="bpm" min="0" max="250" style={numSt} />
              </div>
            </div>

            {blockPct !== null && (
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
                  Total serie:
                </span>
                <PctBadge value={blockPct} />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#333340', fontSize: '12px' }}>
                  ({blockHits}/{blockShots})
                </span>
              </div>
            )}
          </div>
        )
      })}

      <button type="button" onClick={addBlock}
        className="text-xs tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#FF4500', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        + Legg til ny skyteserie
      </button>

      {overallPct !== null && blocks.length > 1 && (
        <div className="mt-4 pt-3 flex items-baseline gap-2" style={{ borderTop: '1px solid #1A1A1E' }}>
          <span className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
            Samlet total:
          </span>
          <PctBadge value={overallPct} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560', fontSize: '12px' }}>
            ({totalHits}/{totalShots} treff)
          </span>
        </div>
      )}
    </div>
  )
}

