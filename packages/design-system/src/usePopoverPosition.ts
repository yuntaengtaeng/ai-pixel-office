import { useCallback, useLayoutEffect, useState } from "react";

export type PopoverSide = "top" | "bottom" | "left" | "right";

export type PopoverPositionOptions = {
  side?: PopoverSide;
  sideOffset?: number;
  collisionPadding?: number;
};

export type PopoverPosition = {
  top: number;
  left: number;
  side: PopoverSide;
};

const OPPOSITE: Record<PopoverSide, PopoverSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function place(
  anchor: DOMRect,
  content: DOMRect,
  side: PopoverSide,
  sideOffset: number,
): { top: number; left: number } {
  switch (side) {
    case "top":
      return {
        top: anchor.top - content.height - sideOffset,
        left: anchor.left + anchor.width / 2 - content.width / 2,
      };
    case "bottom":
      return {
        top: anchor.bottom + sideOffset,
        left: anchor.left + anchor.width / 2 - content.width / 2,
      };
    case "left":
      return {
        top: anchor.top + anchor.height / 2 - content.height / 2,
        left: anchor.left - content.width - sideOffset,
      };
    case "right":
      return {
        top: anchor.top + anchor.height / 2 - content.height / 2,
        left: anchor.right + sideOffset,
      };
  }
}

function fitsInViewport(
  pos: { top: number; left: number },
  content: DOMRect,
  padding: number,
): boolean {
  return (
    pos.top >= padding &&
    pos.left >= padding &&
    pos.top + content.height <= window.innerHeight - padding &&
    pos.left + content.width <= window.innerWidth - padding
  );
}

/** DOM-only geometry: computes where a popover should sit relative to its anchor, with edge collision flip/clamp. No product knowledge. */
export function computePopoverPosition(
  anchorEl: HTMLElement,
  contentEl: HTMLElement,
  { side = "top", sideOffset = 8, collisionPadding = 8 }: PopoverPositionOptions,
): PopoverPosition {
  const anchor = anchorEl.getBoundingClientRect();
  const content = contentEl.getBoundingClientRect();

  let resolvedSide = side;
  let pos = place(anchor, content, side, sideOffset);
  if (!fitsInViewport(pos, content, collisionPadding)) {
    const flipped = place(anchor, content, OPPOSITE[side], sideOffset);
    if (fitsInViewport(flipped, content, collisionPadding)) {
      resolvedSide = OPPOSITE[side];
      pos = flipped;
    }
  }

  const maxLeft = window.innerWidth - content.width - collisionPadding;
  const maxTop = window.innerHeight - content.height - collisionPadding;
  return {
    side: resolvedSide,
    left: Math.min(Math.max(pos.left, collisionPadding), Math.max(maxLeft, collisionPadding)),
    top: Math.min(Math.max(pos.top, collisionPadding), Math.max(maxTop, collisionPadding)),
  };
}

export function usePopoverPosition(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  options: PopoverPositionOptions,
): PopoverPosition | null {
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const recompute = useCallback(() => {
    if (!anchorRef.current || !contentRef.current) return;
    setPosition(computePopoverPosition(anchorRef.current, contentRef.current, options));
  }, [anchorRef, contentRef, options.side, options.sideOffset, options.collisionPadding]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open, recompute]);

  return position;
}
