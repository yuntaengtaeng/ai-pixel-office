import styled from "styled-components";
import { Button, Dialog, useDialogIds } from "@ai-pixel-office/design-system";

const Styled = {
  Content: styled(Dialog)`
    .dialog-content {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: ${({ theme }) => theme.space.x4};

      h2 {
        margin: ${({ theme }) => `${theme.space.x1} 0 ${theme.space.x2}`};
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
    gap: ${({ theme }) => theme.space.x2};
    margin-top: ${({ theme }) => theme.space.x2};
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
  const { titleId, descriptionId } = useDialogIds();
  return (
    <Styled.Content
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onCancel()}
      titleId={titleId}
      descriptionId={descriptionId}
    >
      <Styled.Icon $tone={tone} aria-hidden="true">
        {tone === "danger" ? "!" : "?"}
      </Styled.Icon>
      <div>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
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
  const { titleId, descriptionId } = useDialogIds();
  return (
    <Styled.Content
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      titleId={titleId}
      descriptionId={descriptionId}
    >
      <Styled.Icon $tone={tone} aria-hidden="true">
        {tone === "danger" ? "!" : "i"}
      </Styled.Icon>
      <div>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
      </div>
      <Styled.Actions>
        <Button type="button" $variant="primary" onClick={onClose}>
          {closeLabel}
        </Button>
      </Styled.Actions>
    </Styled.Content>
  );
}
