import { type ReactNode, useEffect, useRef } from 'react';

interface BottomSheetProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export function BottomSheet({ title, children, onClose, wide = false }: BottomSheetProps) {
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

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="sheet-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
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
