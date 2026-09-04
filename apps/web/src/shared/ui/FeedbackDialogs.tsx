import { Dialog } from "radix-ui";

export type ConfirmDialogOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

export type AlertDialogOptions = {
  title?: string;
  description: string;
  closeLabel?: string;
  tone?: "default" | "danger";
};

export type ConfirmDialogProps = ConfirmDialogOptions & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export type AlertDialogProps = AlertDialogOptions & {
  open: boolean;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title = "계속할까요?",
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="feedback-dialog-overlay" />
        <Dialog.Content className="feedback-dialog-content" aria-describedby={undefined}>
          <span className={`feedback-dialog-icon ${tone}`} aria-hidden="true">
            {tone === "danger" ? "!" : "?"}
          </span>
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
          </div>
          <div className="feedback-dialog-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={tone === "danger" ? "danger-button" : "primary-button"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AlertDialog({
  open,
  title = "알림",
  description,
  closeLabel = "확인",
  tone = "default",
  onClose,
}: AlertDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="feedback-dialog-overlay" />
        <Dialog.Content className="feedback-dialog-content" aria-describedby={undefined}>
          <span className={`feedback-dialog-icon ${tone}`} aria-hidden="true">
            {tone === "danger" ? "!" : "i"}
          </span>
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
          </div>
          <div className="feedback-dialog-actions single">
            <button type="button" className="primary-button" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
