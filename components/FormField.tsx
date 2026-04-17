interface FormFieldProps {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
}

export function FormField({
  label,
  name,
  type = 'text',
  placeholder,
  required,
  autoComplete,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-sm tracking-widest uppercase"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#8A8A96' }}
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="w-full px-4 py-3 text-base transition-colors"
        style={{
          backgroundColor: '#1C1C21',
          border: '1px solid #222228',
          color: '#F0F0F2',
          fontFamily: "'Barlow Condensed', sans-serif",
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#FF4500')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#222228')}
      />
    </div>
  )
}
