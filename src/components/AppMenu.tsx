import { useEffect, useRef, useState } from 'react';

interface AppMenuProps {
  onOpenBackup: () => void;
}

export function AppMenu({ onOpenBackup }: AppMenuProps) {
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

  return (
    <div className="header-popover app-menu" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open app menu"
        className="icon-button header-action"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div aria-label="App menu" className="popover-panel app-menu-panel" role="menu">
          <button
            aria-disabled="true"
            className="app-menu-item"
            disabled
            role="menuitem"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />
              <circle cx="10" cy="13" r="2" />
              <path d="M7 18c.8-2 5.2-2 6 0" />
            </svg>
            <span>Export PDF — Person / Team</span>
            <small>Soon</small>
          </button>
          <button
            aria-disabled="true"
            className="app-menu-item"
            disabled
            role="menuitem"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M8 7V3h9l4 4v12H8zM17 3v5h4M4 7v14h13" />
            </svg>
            <span>Export PDF — All</span>
            <small>Soon</small>
          </button>
          <button
            className="app-menu-item"
            onClick={() => {
              setOpen(false);
              onOpenBackup();
            }}
            role="menuitem"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <ellipse cx="12" cy="5" rx="8" ry="3" />
              <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
            </svg>
            <span>Backup &amp; Restore</span>
          </button>
        </div>
      )}
    </div>
  );
}
