import type { ThemeMode } from '../types/shell';
import { BottomSheet } from './BottomSheet';

interface SettingsSheetProps {
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  privacyMode: boolean;
  onChangePrivacyMode: (enabled: boolean) => void;
  onClose: () => void;
}

export function SettingsSheet({
  theme,
  onChangeTheme,
  privacyMode,
  onChangePrivacyMode,
  onClose,
}: SettingsSheetProps) {
  const options: Array<{ value: ThemeMode; label: string }> = [
    { value: 'system', label: 'System' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
  ];

  return (
    <BottomSheet onClose={onClose} title="Settings">
      <section className="settings-section">
        <div className="settings-heading">
          <span>Theme</span>
          <small>System follows your device appearance.</small>
        </div>
        <div aria-label="Theme preference" className="settings-theme-segment" role="group">
          {options.map((option) => (
            <button
              aria-pressed={theme === option.value}
              className={theme === option.value ? 'is-selected' : undefined}
              key={option.value}
              onClick={() => onChangeTheme(option.value)}
              type="button"
            >
              {option.label}
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
            className={`settings-switch ${privacyMode ? 'is-on' : ''}`}
            onClick={() => onChangePrivacyMode(!privacyMode)}
            role="switch"
            type="button"
          >
            <span className="settings-switch-knob" />
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
