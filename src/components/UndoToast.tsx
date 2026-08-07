import { useEffect, useState } from 'react';

import { useAppStore } from '../store/hooks';

const UNDO_VISIBLE_MS = 4500;
const UNDO_EXIT_MS = 200;

interface UndoNoticeProps {
  message: string;
  onDismiss: () => void;
  onUndo: () => Promise<void>;
}

function UndoNotice({ message, onDismiss, onUndo }: UndoNoticeProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setIsExiting(true), UNDO_VISIBLE_MS);
    const dismissTimer = window.setTimeout(onDismiss, UNDO_VISIBLE_MS + UNDO_EXIT_MS);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <div aria-live="polite" className={`undo-toast ${isExiting ? 'is-exiting' : ''}`} role="status">
      <span>{message}</span>
      <button
        onClick={() => {
          setIsExiting(true);
          void onUndo();
        }}
        type="button"
      >
        Undo
      </button>
    </div>
  );
}

export function UndoToast() {
  const undoAction = useAppStore((state) => state.undoAction);
  const undo = useAppStore((state) => state.undoLastDeletion);
  const dismissUndo = useAppStore((state) => state.dismissUndo);
  if (!undoAction) return null;

  const noticeKey =
    undoAction.kind === 'person'
      ? `person:${undoAction.person.id}`
      : `entry:${undoAction.entry.id}`;

  return (
    <UndoNotice
      key={noticeKey}
      message={undoAction.kind === 'person' ? 'Person deleted' : 'Entry deleted'}
      onDismiss={dismissUndo}
      onUndo={undo}
    />
  );
}
