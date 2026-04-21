'use client'

import { ModalShell } from '@/components/periodization/ModalShell'

export type CreateChoice = 'workout' | 'hviledag' | 'sykdom'

interface ChoiceOption {
  key: CreateChoice
  icon: string
  label: string
  description: string
  accent: string
}

export function CreateChoiceModal({
  open, onClose, date, mode, onPick,
}: {
  open: boolean
  onClose: () => void
  date: string
  // 'plan' → framtid/planlegging: hviledag er tillatt, sykdom skjules
  // 'dagbok' → logging i dag/fortid: både hviledag og sykdom vises
  mode: 'plan' | 'dagbok'
  onPick: (choice: CreateChoice) => void
}) {
  const title = mode === 'plan' ? 'Planlegg for dagen' : 'Logg for dagen'

  const options: ChoiceOption[] = [
    {
      key: 'workout',
      icon: '🏃',
      label: mode === 'plan' ? 'Planlegg trening' : 'Logg trening',
      description: mode === 'plan'
        ? 'Planlegg en økt med detaljer, soner og mål.'
        : 'Registrer en gjennomført økt med aktiviteter og soner.',
      accent: '#FF4500',
    },
    {
      key: 'hviledag',
      icon: '🛌',
      label: mode === 'plan' ? 'Planlegg hviledag' : 'Markér hviledag',
      description: 'Egen markering som ikke blokkerer eventuelle økter.',
      accent: '#28A86E',
    },
  ]
  if (mode === 'dagbok') {
    options.push({
      key: 'sykdom',
      icon: '🤒',
      label: 'Markér sykdom',
      description: 'Logg sykdom eller skade. Blokkerer ikke andre aktiviteter.',
      accent: '#E11D48',
    })
  }

  return (
    <ModalShell open={open} onClose={onClose} title={title}>
      <p className="text-xs mb-4"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
        {date} — velg hva du vil legge til. Du kan legge til flere ting samme dag.
      </p>
      <div className="space-y-2">
        {options.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onPick(opt.key)}
            className="w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-[#16161A]"
            style={{
              backgroundColor: '#0F0F12',
              border: '1px solid #1E1E22',
              borderLeft: `3px solid ${opt.accent}`,
              cursor: 'pointer',
            }}
          >
            <span aria-hidden style={{ fontSize: '22px', lineHeight: 1 }}>{opt.icon}</span>
            <span className="flex-1">
              <span className="block"
                style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#F0F0F2', fontSize: '18px', letterSpacing: '0.04em' }}>
                {opt.label}
              </span>
              <span className="block text-xs mt-0.5"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}>
                {opt.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </ModalShell>
  )
}
