import styled from "styled-components";

export type IconButtonTone = "neutral" | "danger";

const TONE_HOVER: Record<IconButtonTone, { background: string; color: string }> = {
  neutral: { background: "#e8f1ec", color: "#3f6b5c" },
  danger: { background: "#f7dfdc", color: "#9f413d" },
};

/**
 * Square icon-only button (close, delete, dismiss). Unlike `Button`, both
 * dimensions come from the same `size` prop — an icon button has no
 * "fill the row" case, so there's nothing that needs to vary independently
 * of the other.
 */
export const IconButton = styled.button<{ $size?: number; $tone?: IconButtonTone }>`
  width: ${({ $size = 32 }) => `${$size}px`};
  height: ${({ $size = 32 }) => `${$size}px`};
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #786c63;
  cursor: pointer;
  transition:
    color 0.14s,
    background 0.14s;

  svg {
    width: 55%;
    height: 55%;
  }

  &:hover:not(:disabled),
  &:focus-visible {
    background: ${({ $tone = "neutral" }) => TONE_HOVER[$tone].background};
    color: ${({ $tone = "neutral" }) => TONE_HOVER[$tone].color};
    outline: none;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
