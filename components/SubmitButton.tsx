'use client'

import { useFormStatus } from 'react-dom'

interface SubmitButtonProps {
  label: string
  loadingLabel?: string
}

export function SubmitButton({ label, loadingLabel = 'Laster...' }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-4 text-lg font-semibold tracking-widest uppercase transition-opacity"
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        backgroundColor: pending ? '#7A2200' : '#FF4500',
        color: '#F0F0F2',
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
        border: 'none',
      }}
    >
      {pending ? loadingLabel : label}
    </button>
  )
}
