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
    z-index: 120;
    background: rgb(31 38 36 / 62%);
    backdrop-filter: blur(2px);
    animation: ${dialogFade} 0.16s ease-out;
  `,
  Content: styled(Dialog.Content)`
    position: fixed;
    left: 50%;
    top: 50%;
    z-index: 121;
    width: min(440px, calc(100vw - 28px));
    padding: 22px;
    transform: translate(-50%, -50%);
    border: 3px solid #4d5f58;
    background: #fffaf0;
    box-shadow: 8px 8px 0 rgb(20 31 28 / 48%);
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 14px;
    animation: ${dialogPop} 0.18s ease-out;

    h2 {
      margin: 1px 0 7px;
      color: #3d3632;
      font-size: 19px;
    }

    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.muted};
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-line;
    }
  `,
  Icon: styled.span<{ $tone: "default" | "danger" }>`
    width: 42px;
    height: 42px;
    border: 2px solid #426e60;
    background: #dcece3;
    color: #31594d;
    display: grid;
    place-items: center;
    font: 900 22px/1 monospace;
    box-shadow: 3px 3px 0 #a7c2b5;

    ${({ $tone }) =>
      $tone === "danger" &&
      `
        border-color: #8e4844;
        background: #f2d9d4;
        color: #9f413d;
        box-shadow: 3px 3px 0 #d4aaa4;
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
