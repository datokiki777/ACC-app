import type { ThemeMode } from '../types/shell';
import { BottomSheet } from './BottomSheet';

interface SettingsSheetProps {
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  privacyMode: boolean;
  onChangePrivacyMode: (enabled: boolean) => void;
  onClose: () => void;
}

const THEME_OPTIONS: Array<{ value: ThemeMode; icon: string; label: string }> = [
  { value: 'dark', icon: '🌙', label: 'Dark' },
  { value: 'light', icon: '☀️', label: 'Light' },
  { value: 'system', icon: '🌗', label: 'System' },
];

export function SettingsSheet({
  theme,
  onChangeTheme,
  privacyMode,
  onChangePrivacyMode,
  onClose,
}: SettingsSheetProps) {
  return (
    <BottomSheet onClose={onClose} title="Settings">
      <section className="settings-section">
        <div className="settings-heading">
          <span>Theme</span>
          <small>System follows your device appearance.</small>
        </div>
        <div aria-label="Theme preference" className="settings-icon-row" role="group">
          {THEME_OPTIONS.map((option) => (
            <button
              aria-label={option.label}
              aria-pressed={theme === option.value}
              className={`settings-icon-button ${theme === option.value ? 'is-selected' : ''}`}
              key={option.value}
              onClick={() => onChangeTheme(option.value)}
              type="button"
            >
              <span aria-hidden="true">{option.icon}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-row">
          <div className="settings-heading">
            <span>Hide amounts</span>
            <small>Blurs money on the Home list until you open a person's card.</small>
          </div>
          <button
            aria-checked={privacyMode}
            aria-label="Hide amounts"
            className={`settings-icon-button ${privacyMode ? 'is-selected' : ''}`}
            onClick={() => onChangePrivacyMode(!privacyMode)}
            role="switch"
            type="button"
          >
            <span aria-hidden="true">{privacyMode ? '🙈' : '👁️'}</span>
          </button>
        </div>
      </section>
      <section className="settings-section settings-about">
        <div className="settings-heading">
          <span>ACC</span>
          <small>Your data stays on this device and remains available offline.</small>
        </div>
      </section>
    </BottomSheet>
  );
}
