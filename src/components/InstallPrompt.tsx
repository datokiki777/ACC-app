import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true)
  );
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capture);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios && !isStandalone()) {
      const timer = window.setTimeout(() => setShowIos(true), 3000);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', capture);
      };
    }
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  if (showIos) {
    return (
      <aside aria-label="Install ACC" className="install-banner" role="dialog">
        <strong>Add ACC to your Home Screen</strong>
        <p>In Safari, tap Share and then Add to Home Screen.</p>
        <button onClick={() => setShowIos(false)} type="button">
          Close
        </button>
      </aside>
    );
  }
  if (!installEvent || isStandalone()) return null;
  return (
    <aside aria-label="Install ACC" className="install-banner" role="dialog">
      <strong>Install ACC</strong>
      <p>Use ACC offline from your home screen.</p>
      <div>
        <button onClick={() => setInstallEvent(null)} type="button">
          Later
        </button>
        <button
          onClick={() =>
            void installEvent
              .prompt()
              .then(() => installEvent.userChoice)
              .then(() => setInstallEvent(null))
          }
          type="button"
        >
          Install
        </button>
      </div>
    </aside>
  );
}
