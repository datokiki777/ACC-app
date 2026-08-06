import type { AppMode } from '../types/shell';

interface ModeSwitchProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div aria-label="Account mode" className="segmented-control" role="group">
      <button
        aria-pressed={mode === 'personal'}
        className={mode === 'personal' ? 'is-active' : undefined}
        onClick={() => onChange('personal')}
        type="button"
      >
        Personal
      </button>
      <button
        aria-pressed={mode === 'work'}
        className={mode === 'work' ? 'is-active' : undefined}
        onClick={() => onChange('work')}
        type="button"
      >
        Work
      </button>
    </div>
  );
}
