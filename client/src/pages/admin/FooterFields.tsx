import { useId } from "react";

interface FooterFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  destination?: boolean;
  required?: boolean;
}

export function FooterField({ label, value, onChange, error, hint, placeholder, maxLength, multiline, destination, required }: FooterFieldProps) {
  const id = useId();
  const attributes = {
    id,
    value,
    placeholder,
    maxLength,
    required,
    "aria-invalid": Boolean(error),
    "aria-describedby": [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined,
  };

  return (
    <div className="af-field">
      <div className="af-field-label">
        <label htmlFor={id}>{label}</label>
        {maxLength && <span>{value.length} / {maxLength}</span>}
      </div>
      {multiline
        ? <textarea {...attributes} rows={3} onChange={(event) => onChange(event.target.value)} />
        : <input
            {...attributes}
            inputMode={destination ? "url" : undefined}
            spellCheck={destination ? false : undefined}
            onChange={(event) => onChange(event.target.value)}
          />}
      {hint && <p id={`${id}-hint`} className="af-field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="af-field-error" role="alert">{error}</p>}
    </div>
  );
}

export function FooterSwitch({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      className="af-switch"
      onClick={onClick}
    >
      <span className="af-switch-track" aria-hidden="true" />
      {checked ? "Active" : "Inactive"}
    </button>
  );
}
