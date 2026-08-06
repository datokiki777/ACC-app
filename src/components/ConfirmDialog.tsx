import { BottomSheet } from './BottomSheet';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <BottomSheet onClose={onCancel} title={title}>
      <p className="sheet-message">{message}</p>
      <div className="form-actions">
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="danger-button"
          onClick={() => {
            void onConfirm();
          }}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
