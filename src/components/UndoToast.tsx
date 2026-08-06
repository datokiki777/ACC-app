import { useAppStore } from '../store/hooks';

export function UndoToast() {
  const undoAction = useAppStore((state) => state.undoAction);
  const undo = useAppStore((state) => state.undoLastDeletion);
  if (!undoAction) return null;

  return (
    <div aria-live="polite" className="undo-toast">
      <span>{undoAction.kind === 'person' ? 'Person deleted' : 'Entry deleted'}</span>
      <button onClick={() => void undo()} type="button">
        Undo
      </button>
    </div>
  );
}
