import { useEffect, useId, useRef } from "react";
import styled from "styled-components";
import { fadeIn, popIn } from "./animation.ts";

const StyledDialog = styled.dialog`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.dialog};
  margin: auto;
  padding: 0;
  border: none;
  background: transparent;
  max-width: none;
  max-height: none;

  &::backdrop {
    background: ${({ theme }) => theme.colors.overlay.scrim};
    backdrop-filter: blur(2px);
    animation: ${fadeIn} 0.16s ease-out;
  }

  &[open] .dialog-content {
    animation: ${popIn} 0.18s ease-out;
  }
`;

const Content = styled.div`
  width: min(440px, calc(100vw - 28px));
  padding: ${({ theme }) => theme.space.x6};
  border: 3px solid ${({ theme }) => theme.colors.border.positive};
  background: ${({ theme }) => theme.colors.background.surface};
  box-shadow: 8px 8px 0 ${({ theme }) => theme.colors.shadow.dialog};
`;

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId?: string;
  closeOnBackdropClick?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onOpenChange,
  titleId,
  descriptionId,
  closeOnBackdropClick = true,
  children,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onCancel = (event: Event) => {
      event.preventDefault();
      onOpenChange(false);
    };
    const onClose = () => {
      onOpenChange(false);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
    const onClick = (event: MouseEvent) => {
      if (!closeOnBackdropClick) return;
      if (event.target === el) onOpenChange(false);
    };

    el.addEventListener("cancel", onCancel);
    el.addEventListener("close", onClose);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("cancel", onCancel);
      el.removeEventListener("close", onClose);
      el.removeEventListener("click", onClick);
    };
  }, [onOpenChange, closeOnBackdropClick]);

  return (
    <StyledDialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <Content className="dialog-content">{children}</Content>
    </StyledDialog>
  );
}

export function useDialogIds() {
  const titleId = useId();
  const descriptionId = useId();
  return { titleId, descriptionId };
}
