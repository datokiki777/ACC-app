import { useEffect, useRef, useState } from 'react';

import type { ThemeMode } from '../types/shell';

interface ThemeSelectorProps {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const options: Array<{ value: ThemeMode; label: string }> = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'Auto' },
  ];
  const currentLabel = options.find((option) => option.value === value)?.label ?? 'Auto';

  return (
    <div className="header-popover theme-selector" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Theme: ${currentLabel}`}
        className="icon-button theme-toggle"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <ThemeIcon mode={value} />
      </button>
      {open && (
        <div aria-label="Theme" className="popover-panel theme-menu" role="menu">
          {options.map((option) => (
            <button
              aria-checked={value === option.value}
              className={value === option.value ? 'is-selected' : undefined}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="menuitemradio"
              type="button"
            >
              <ThemeIcon mode={option.value} />
              <span>{option.label}</span>
              <span aria-hidden="true" className="theme-check">
                {value === option.value ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'dark') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" />
      </svg>
    );
  }
  if (mode === 'light') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="14" rx="2" width="20" x="2" y="3" />
      <path d="M8 21h8M12 17v4M12 6v8M12 6a4 4 0 0 0 0 8" />
    </svg>
  );
}
