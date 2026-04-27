'use client'

import { useActionState } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  saveCoachProfile,
  type CoachProfile,
} from '@/app/actions/coach-settings'

const COACH_BLUE = '#1A6FD4'

interface Props {
  initial: CoachProfile
}

interface FormState {
  error?: string
  saved?: boolean
}

async function action(_prev: FormState, formData: FormData): Promise<FormState> {
  const res = await saveCoachProfile(formData)
  if (res.error) return { error: res.error }
  return { saved: true }
}

export function TrenerProfilSection({ initial }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    action,
    {},
  )

  useEffect(() => {
    if (state.saved) router.refresh()
  }, [state.saved, router])

  const inputStyle = {
    backgroundColor: '#0F0F12',
    border: '1px solid #1E1E22',
    color: '#F0F0F2',
    fontFamily: "'Barlow Condensed', sans-serif",
  } as const

  const labelStyle = {
    fontFamily: "'Barlow Condensed', sans-serif",
    color: '#8A8A96',
  } as const

  return (
    <form
      action={formAction}
      className="p-5 flex flex-col gap-4"
      style={{ backgroundColor: '#16161A', border: '1px solid #1E1E22' }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="bio" className="text-[10px] tracking-widest uppercase" style={labelStyle}>
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={initial.bio ?? ''}
          rows={4}
          maxLength={1000}
          placeholder="Kort presentasjon av deg som trener…"
          className="px-3 py-2 text-sm"
          style={inputStyle}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="certifications" className="text-[10px] tracking-widest uppercase" style={labelStyle}>
          Sertifiseringer
        </label>
        <textarea
          id="certifications"
          name="certifications"
          defaultValue={initial.certifications ?? ''}
          rows={3}
          maxLength={500}
          placeholder="F.eks. Norges Skiforbund Trener 2, NIH idrettspedagog"
          className="px-3 py-2 text-sm"
          style={inputStyle}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="specialties" className="text-[10px] tracking-widest uppercase" style={labelStyle}>
          Spesialiteter (komma-separert)
        </label>
        <input
          id="specialties"
          name="specialties"
          type="text"
          defaultValue={initial.specialties.join(', ')}
          maxLength={200}
          placeholder="F.eks. Sprint, Skiteknikk, Junior"
          className="px-3 py-2 text-sm"
          style={inputStyle}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="experience_years" className="text-[10px] tracking-widest uppercase" style={labelStyle}>
          Erfaring (år)
        </label>
        <input
          id="experience_years"
          name="experience_years"
          type="number"
          min="0"
          max="80"
          defaultValue={initial.experienceYears ?? ''}
          className="px-3 py-2 text-sm w-32"
          style={inputStyle}
        />
      </div>

      <label
        className="flex items-center gap-2 px-3 py-2"
        style={{
          cursor: 'pointer',
          border: '1px solid #1E1E22',
        }}
      >
        <input
          type="checkbox"
          name="visible_in_directory"
          defaultChecked={initial.visibleInDirectory}
          style={{ accentColor: COACH_BLUE }}
        />
        <span className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F0F0F2' }}>
          Synlig i trener-katalog
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-xs tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            backgroundColor: COACH_BLUE, color: '#F0F0F2',
            border: 'none', cursor: 'pointer',
          }}
        >
          {isPending ? 'Lagrer…' : 'Lagre'}
        </button>
        {state.error && (
          <span className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#E11D48' }}>
            {state.error}
          </span>
        )}
        {state.saved && !state.error && (
          <span className="text-xs"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#28A86E' }}>
            Lagret
          </span>
        )}
      </div>
    </form>
  )
}
