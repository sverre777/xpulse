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
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--tekst-5-app)' }}
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
          backgroundColor: 'var(--flate-15)',
          border: '1px solid var(--kant-4)',
          color: 'var(--tekst-1-app)',
          fontFamily: "'Barlow Condensed', sans-serif",
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#FF4500')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--kant-4)')}
      />
    </div>
  )
}
