import type { ThemeMode } from '../types/shell';

interface ThemeSelectorProps {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <label className="theme-selector">
      <span className="sr-only">Theme</span>
      <select
        aria-label="Theme"
        onChange={(event) => onChange(event.target.value as ThemeMode)}
        value={value}
      >
        <option value="system">System theme</option>
        <option value="dark">Dark theme</option>
        <option value="light">Light theme</option>
      </select>
    </label>
  );
}
