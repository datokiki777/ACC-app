import { useState } from 'react';

import { BottomSheet } from './BottomSheet';

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
}

interface PickerFieldProps {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PickerField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select…',
}: PickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className="field">
      <span>{label}</span>
      <button
        aria-haspopup="listbox"
        className="picker-trigger"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className={selected ? undefined : 'picker-placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <svg aria-hidden="true" className="picker-chevron" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <BottomSheet onClose={() => setOpen(false)} title={label}>
          <div className="picker-options" role="listbox">
            {options.map((option) => (
              <button
                aria-selected={option.value === value}
                className={`picker-option ${option.value === value ? 'is-selected' : ''}`}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                <span className="picker-option-text">
                  <span>{option.label}</span>
                  {option.description && <small>{option.description}</small>}
                </span>
                {option.value === value && (
                  <svg aria-hidden="true" className="picker-check" viewBox="0 0 24 24">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
