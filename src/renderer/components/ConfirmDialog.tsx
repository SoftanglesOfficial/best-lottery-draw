import Modal from './Modal';
import { Button } from './ui';

type ConfirmDialogProps = {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
};

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
}: ConfirmDialogProps) {
  return (
    <Modal title="Confirm" onClose={onCancel}>
      <p className="mb-6 text-sm leading-6 text-content-muted">{message}</p>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="danger" data-modal-primary onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
