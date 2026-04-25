'use client'

import { useState, useTransition } from 'react'
import { exportAllUserData } from '@/app/actions/settings'

type Format = 'json' | 'csv'

export function DataExportButton() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<Format>('json')

  const handleExport = () => {
    setError(null)
    startTransition(async () => {
      const res = await exportAllUserData()
      if (res.error || !res.payload) { setError(res.error ?? 'Ukjent feil'); return }
      if (format === 'json') {
        downloadJson(res.payload)
      } else {
        await downloadCsvZip(res.payload)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        Last ned alle dine data. Inkluderer profil, økter, planer, mål, helse-logg, mm.
      </p>
      <div className="flex gap-2 flex-wrap">
        <FormatButton active={format === 'json'} onClick={() => setFormat('json')}>JSON</FormatButton>
        <FormatButton active={format === 'csv'} onClick={() => setFormat('csv')}>CSV (zip)</FormatButton>
        <button type="button" onClick={handleExport} disabled={pending}
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            background: pending ? 'none' : '#FF4500',
            border: '1px solid ' + (pending ? '#262629' : '#FF4500'),
            color: pending ? '#555560' : '#0A0A0B',
            padding: '8px 18px',
            cursor: pending ? 'default' : 'pointer',
            minHeight: '40px',
          }}>
          {pending ? 'Eksporterer …' : 'Last ned'}
        </button>
      </div>
      {error && (
        <p className="text-xs"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function FormatButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick}
      className="text-xs tracking-widest uppercase"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        background: active ? '#1A1A1E' : 'none',
        border: '1px solid ' + (active ? '#FF4500' : '#262629'),
        color: active ? '#FF4500' : '#8A8A96',
        padding: '8px 14px',
        cursor: 'pointer',
        minHeight: '40px',
      }}>
      {children}
    </button>
  )
}

function downloadJson(payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `x-pulse-data-${dateStamp()}.json`)
}

async function downloadCsvZip(payload: { data: Record<string, unknown[]>; profile: unknown; user_id: string; email: string | null; exported_at: string }) {
  const files: { name: string; content: string }[] = []
  files.push({
    name: 'metadata.csv',
    content: toCsv([{
      exported_at: payload.exported_at,
      user_id: payload.user_id,
      email: payload.email ?? '',
    }]),
  })
  if (payload.profile) {
    files.push({ name: 'profile.csv', content: toCsv([payload.profile as Record<string, unknown>]) })
  }
  for (const [table, rows] of Object.entries(payload.data)) {
    if (Array.isArray(rows) && rows.length > 0) {
      files.push({ name: `${table}.csv`, content: toCsv(rows as Record<string, unknown>[]) })
    }
  }
  const blob = await makeZip(files)
  triggerDownload(blob, `x-pulse-data-${dateStamp()}.zip`)
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Array.from(rows.reduce((acc, r) => {
    Object.keys(r).forEach(k => acc.add(k))
    return acc
  }, new Set<string>()))
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map(h => escape(r[h])).join(','))
  return lines.join('\n')
}

// Minimal zip-builder (uncompressed STORE method) — unngår å pulle inn et bibliotek
// for én funksjon. Tar inn små CSV-filer; ikke optimal for store binærfiler.
async function makeZip(files: { name: string; content: string }[]): Promise<Blob> {
  const enc = new TextEncoder()
  const fileChunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const data = enc.encode(f.content)
    const crc = crc32(data)
    const size = data.length

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length + size)
    const dvLocal = new DataView(local.buffer)
    dvLocal.setUint32(0, 0x04034b50, true)
    dvLocal.setUint16(4, 20, true)        // version
    dvLocal.setUint16(6, 0, true)         // flags
    dvLocal.setUint16(8, 0, true)         // method = store
    dvLocal.setUint16(10, 0, true)        // mod time
    dvLocal.setUint16(12, 0, true)        // mod date
    dvLocal.setUint32(14, crc, true)
    dvLocal.setUint32(18, size, true)
    dvLocal.setUint32(22, size, true)
    dvLocal.setUint16(26, nameBytes.length, true)
    dvLocal.setUint16(28, 0, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    fileChunks.push(local)

    // Central directory entry
    const cd = new Uint8Array(46 + nameBytes.length)
    const dvCd = new DataView(cd.buffer)
    dvCd.setUint32(0, 0x02014b50, true)
    dvCd.setUint16(4, 20, true)
    dvCd.setUint16(6, 20, true)
    dvCd.setUint16(8, 0, true)
    dvCd.setUint16(10, 0, true)
    dvCd.setUint16(12, 0, true)
    dvCd.setUint16(14, 0, true)
    dvCd.setUint32(16, crc, true)
    dvCd.setUint32(20, size, true)
    dvCd.setUint32(24, size, true)
    dvCd.setUint16(28, nameBytes.length, true)
    dvCd.setUint16(30, 0, true)
    dvCd.setUint16(32, 0, true)
    dvCd.setUint16(34, 0, true)
    dvCd.setUint16(36, 0, true)
    dvCd.setUint32(38, 0, true)
    dvCd.setUint32(42, offset, true)
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const cdOffset = offset

  const eocd = new Uint8Array(22)
  const dvEnd = new DataView(eocd.buffer)
  dvEnd.setUint32(0, 0x06054b50, true)
  dvEnd.setUint16(4, 0, true)
  dvEnd.setUint16(6, 0, true)
  dvEnd.setUint16(8, files.length, true)
  dvEnd.setUint16(10, files.length, true)
  dvEnd.setUint32(12, cdSize, true)
  dvEnd.setUint32(16, cdOffset, true)
  dvEnd.setUint16(20, 0, true)

  const parts = [...fileChunks, ...central, eocd]
  return new Blob(parts as BlobPart[], { type: 'application/zip' })
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
