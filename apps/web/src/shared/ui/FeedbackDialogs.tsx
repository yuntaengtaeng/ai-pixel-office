import { Dialog } from "radix-ui";
import styled, { keyframes } from "styled-components";
import { Button } from "@ai-pixel-office/ui";

const dialogFade = keyframes`
  from {
    opacity: 0;
  }
`;

const dialogPop = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.98);
  }
`;

const Styled = {
  Overlay: styled(Dialog.Overlay)`
    position: fixed;
    inset: 0;
    z-index: ${({ theme }) => theme.zIndex.dialogBackdrop};
    background: rgb(31 38 36 / 62%);
    backdrop-filter: blur(2px);
    animation: ${dialogFade} 0.16s ease-out;
  `,
  Content: styled(Dialog.Content)`
    position: fixed;
    left: 50%;
    top: 50%;
    z-index: ${({ theme }) => theme.zIndex.dialog};
    width: min(440px, calc(100vw - 28px));
    padding: 24px;
    transform: translate(-50%, -50%);
    border: 3px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.surface};
    box-shadow: 8px 8px 0 rgb(20 31 28 / 48%);
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 16px;
    animation: ${dialogPop} 0.18s ease-out;

    h2 {
      margin: 4px 0 8px;
      color: ${({ theme }) => theme.colors.text.primary};
      font-size: ${({ theme }) => theme.typography.fontSize.headingSm};
    }

    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      line-height: 1.6;
      white-space: pre-line;
    }
  `,
  Icon: styled.span<{ $tone: "default" | "danger" }>`
    width: 42px;
    height: 42px;
    border: 2px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    color: ${({ theme }) => theme.colors.text.positive};
    display: grid;
    place-items: center;
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.headingXl};
    font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
    line-height: 1;
    box-shadow: 3px 3px 0 ${({ theme }) => theme.colors.border.positive};

    ${({ $tone, theme }) =>
      $tone === "danger" &&
      `
        border-color: ${theme.colors.border.negative};
        background: ${theme.colors.background.surfaceMuted};
        color: ${theme.colors.text.negative};
        box-shadow: 3px 3px 0 ${theme.colors.shadow.negative};
      `}
  `,
  Actions: styled.div`
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  `,
};

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
        <Styled.Overlay />
        <Styled.Content aria-describedby={undefined}>
          <Styled.Icon $tone={tone} aria-hidden="true">
            {tone === "danger" ? "!" : "?"}
          </Styled.Icon>
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
          </div>
          <Styled.Actions>
            <Button type="button" $variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              $variant={tone === "danger" ? "danger" : "primary"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </Styled.Actions>
        </Styled.Content>
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
        <Styled.Overlay />
        <Styled.Content aria-describedby={undefined}>
          <Styled.Icon $tone={tone} aria-hidden="true">
            {tone === "danger" ? "!" : "i"}
          </Styled.Icon>
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
          </div>
          <Styled.Actions>
            <Button type="button" $variant="primary" onClick={onClose}>
              {closeLabel}
            </Button>
          </Styled.Actions>
        </Styled.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
