import type { ThemeMode } from '../types/shell';
import { BottomSheet } from './BottomSheet';

interface SettingsSheetProps {
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  onClose: () => void;
}

export function SettingsSheet({ theme, onChangeTheme, onClose }: SettingsSheetProps) {
  const options: Array<{ value: ThemeMode; label: string; detail: string }> = [
    { value: 'dark', label: 'Dark', detail: 'Dark navy appearance' },
    { value: 'light', label: 'Light', detail: 'Bright, clean appearance' },
    { value: 'system', label: 'Auto', detail: 'Follow your device setting' },
  ];

  return (
    <BottomSheet onClose={onClose} title="Settings">
      <section className="settings-section">
        <div className="settings-heading">
          <span>Appearance</span>
          <small>Choose how ACC looks on this device.</small>
        </div>
        <div aria-label="Theme preference" className="settings-theme-options" role="group">
          {options.map((option) => (
            <button
              aria-pressed={theme === option.value}
              className={theme === option.value ? 'is-selected' : undefined}
              key={option.value}
              onClick={() => onChangeTheme(option.value)}
              type="button"
            >
              <span className={`theme-preview theme-preview-${option.value}`} />
              <span>
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </span>
              <span aria-hidden="true" className="settings-check">
                {theme === option.value ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section settings-about">
        <div className="settings-heading">
          <span>ACC PWA</span>
          <small>Your data stays on this device and remains available offline.</small>
        </div>
      </section>
    </BottomSheet>
  );
}
