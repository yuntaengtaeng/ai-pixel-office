import styled from "styled-components";
import { colors } from "@ai-pixel-office/design-token";

export type IconButtonTone = "neutral" | "danger";

const TONE_HOVER: Record<IconButtonTone, { background: string; color: string }> = {
  neutral: { background: colors.background.positiveSubtle, color: colors.text.positive },
  danger: { background: colors.background.negativeSubtle, color: colors.text.negative },
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
  border-radius: ${({ theme }) => theme.radius.circle};
  background: transparent;
  color: ${({ theme }) => theme.colors.text.secondary};
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
