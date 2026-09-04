import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import {
  usePopoverPosition,
  type PopoverPositionOptions,
} from "./usePopoverPosition.ts";

const Panel = styled.div`
  position: fixed;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  inset: auto;
  z-index: ${({ theme }) => theme.zIndex.popover};
`;

export type PopoverProps = PopoverPositionOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  id?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Position and open/close plumbing only. The caller owns the trigger element
 * and is responsible for wiring `aria-expanded`/`aria-controls` to `id`.
 */
export function Popover({
  open,
  onOpenChange,
  anchorRef,
  id,
  side,
  sideOffset,
  collisionPadding,
  children,
  className,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const panelId = id ?? generatedId;
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const position = usePopoverPosition(open, anchorRef, ref, {
    side,
    sideOffset,
    collisionPadding,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.matches(":popover-open")) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      el.showPopover();
    } else if (!open && el.matches(":popover-open")) {
      el.hidePopover();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onToggle = (event: Event) => {
      const toggleEvent = event as ToggleEvent;
      const isOpen = toggleEvent.newState === "open";
      onOpenChange(isOpen);
      if (!isOpen) {
        restoreFocusRef.current?.focus();
        restoreFocusRef.current = null;
      }
    };

    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, [onOpenChange]);

  return createPortal(
    <Panel
      ref={ref}
      id={panelId}
      popover="auto"
      className={className}
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      {children}
    </Panel>,
    document.body,
  );
}
