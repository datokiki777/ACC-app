import { type ReactNode, useEffect, useRef } from 'react';

interface BottomSheetProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export function BottomSheet({ title, children, onClose, wide = false }: BottomSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const sheet = sheetRef.current;
    const viewport = window.visualViewport;

    const keepFocusedFieldVisible = () => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !sheet?.contains(active)) return;
      window.setTimeout(() => active.scrollIntoView?.({ block: 'nearest' }), 80);
    };

    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      overlay?.style.setProperty('--sheet-viewport-height', `${height}px`);
      overlay?.style.setProperty('--sheet-viewport-top', `${offsetTop}px`);
      keepFocusedFieldVisible();
    };

    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    sheet?.addEventListener('focusin', keepFocusedFieldVisible);

    return () => {
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      sheet?.removeEventListener('focusin', keepFocusedFieldVisible);
    };
  }, []);

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="sheet-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={overlayRef}
      role="dialog"
    >
      <div
        className={`bottom-sheet ${wide ? 'bottom-sheet-wide' : ''}`}
        ref={sheetRef}
        tabIndex={-1}
      >
        <div className="sheet-handle" />
        <header className="sheet-title-row">
          <h2>{title}</h2>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="sheet-content">{children}</div>
      </div>
    </div>
  );
}
