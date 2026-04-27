'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePassword, requestEmailChange } from '@/app/actions/settings'

interface Props {
  currentEmail: string
  pendingEmail: string | null
}

export function SecuritySection({ currentEmail, pendingEmail }: Props) {
  const router = useRouter()
  const [pwPending, startPwTransition] = useTransition()
  const [emailPending, startEmailTransition] = useTransition()
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwOk, setPwOk] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailOk, setEmailOk] = useState(false)

  const submitPassword = () => {
    setPwError(null); setPwOk(false)
    if (newPw.length < 8) { setPwError('Passord må være minst 8 tegn'); return }
    if (newPw !== confirmPw) { setPwError('Passordene er ikke like'); return }
    startPwTransition(async () => {
      const res = await updatePassword(newPw)
      if (res.error) { setPwError(res.error); return }
      setNewPw(''); setConfirmPw(''); setPwOk(true)
      setTimeout(() => setPwOk(false), 2000)
    })
  }

  const submitEmail = () => {
    setEmailError(null); setEmailOk(false)
    startEmailTransition(async () => {
      const res = await requestEmailChange(newEmail)
      if (res.error) { setEmailError(res.error); return }
      setNewEmail(''); setEmailOk(true)
      router.refresh()
      setTimeout(() => setEmailOk(false), 3000)
    })
  }

  return (
    <div className="p-6 mt-6" style={{ backgroundColor: '#1A1A22', border: '1px solid #1E1E22' }}>
      <p className="text-xs tracking-widest uppercase mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#555560' }}>
        Sikkerhet
      </p>

      <div className="mb-6">
        <p className="text-xs mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          E-post — nåværende: <span style={{ color: '#F0F0F2' }}>{currentEmail}</span>
        </p>
        {pendingEmail && (
          <p className="text-xs mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#D4A017' }}>
            Bekreftelse sendt til {pendingEmail}. Klikk lenken i e-posten for å fullføre.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="email" value={newEmail} placeholder="ny@e-post.com"
            onChange={e => setNewEmail(e.target.value)}
            style={inputStyle} />
          <button type="button" onClick={submitEmail}
            disabled={emailPending || !newEmail.trim()}
            style={buttonStyle(!!newEmail.trim() && !emailPending)}>
            {emailPending ? 'Sender …' : 'Endre e-post'}
          </button>
        </div>
        {emailError && (
          <p className="mt-2 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {emailError}
          </p>
        )}
        {emailOk && !emailError && (
          <p className="mt-2 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
            Bekreftelseslenke sendt
          </p>
        )}
      </div>

      <div>
        <p className="text-xs mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
          Endre passord — minst 8 tegn
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input type="password" value={newPw} placeholder="Nytt passord"
            onChange={e => setNewPw(e.target.value)} style={inputStyle} />
          <input type="password" value={confirmPw} placeholder="Bekreft nytt passord"
            onChange={e => setConfirmPw(e.target.value)} style={inputStyle} />
        </div>
        <button type="button" onClick={submitPassword}
          disabled={pwPending || newPw.length < 8 || newPw !== confirmPw}
          style={{ ...buttonStyle(!pwPending && newPw.length >= 8 && newPw === confirmPw), marginTop: '8px' }}>
          {pwPending ? 'Lagrer …' : 'Bytt passord'}
        </button>
        {pwError && (
          <p className="mt-2 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {pwError}
          </p>
        )}
        {pwOk && !pwError && (
          <p className="mt-2 text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
            Passord oppdatert
          </p>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: '#0E0E10',
  border: '1px solid #262629',
  color: '#F0F0F2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '16px',
  padding: '8px 12px',
  minHeight: '40px',
}

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: "'Barlow Condensed', sans-serif",
    background: active ? '#FF4500' : 'none',
    border: '1px solid ' + (active ? '#FF4500' : '#262629'),
    color: active ? '#0A0A0B' : '#555560',
    padding: '8px 18px',
    cursor: active ? 'pointer' : 'default',
    minHeight: '40px',
    fontSize: '12px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
  }
}
