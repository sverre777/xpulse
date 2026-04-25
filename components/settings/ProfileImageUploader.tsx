'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { uploadProfileImage } from '@/app/actions/settings'

interface Props {
  initialUrl: string | null
}

export function ProfileImageUploader({ initialUrl }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [error, setError] = useState<string | null>(null)

  const handleFile = (file: File) => {
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const res = await uploadProfileImage(fd)
      if (res.error) { setError(res.error); return }
      if (res.url) {
        setUrl(res.url)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center gap-4">
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#0E0E10',
        border: '1px solid #262629',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Profilbilde" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#555560', fontSize: '24px' }}>👤</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={pending}
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            background: 'none',
            border: '1px solid #262629',
            color: '#F0F0F2',
            padding: '6px 14px',
            cursor: pending ? 'default' : 'pointer',
            minHeight: '32px',
            alignSelf: 'flex-start',
          }}>
          {pending ? 'Laster opp …' : 'Bytt bilde'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }} />
        {error && (
          <span className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
