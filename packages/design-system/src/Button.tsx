import styled from "styled-components";
import { colors } from "@ai-pixel-office/design-token";
import { Label } from "./typography.ts";

/** stamp는 최종 결재 행동 전용 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "stamp";

const VARIANT_STYLES: Record<
  ButtonVariant,
  { color: string; background: string; border: string; shadow: string }
> = {
  primary: {
    color: colors.action.primary.foreground,
    background: colors.action.primary.background,
    border: colors.action.primary.border,
    shadow: colors.action.primary.shadow,
  },
  secondary: {
    color: colors.action.secondary.foreground,
    background: colors.action.secondary.background,
    border: colors.action.secondary.border,
    shadow: colors.action.secondary.shadow,
  },
  danger: {
    color: colors.action.danger.foreground,
    background: colors.action.danger.background,
    border: colors.action.danger.border,
    shadow: colors.action.danger.shadow,
  },
  stamp: {
    color: colors.stamp.onStamp,
    background: colors.stamp.ink,
    border: colors.stamp.ink,
    shadow: colors.action.primary.shadow,
  },
};

/**
 * Height is fixed by the button itself (`min-height`, driven by padding, not
 * by `size` yet — there's only one size in the product today). Width is
 * intrinsic (fits its label) unless `fullWidth` is set, which is the one
 * dimension callers actually need to vary — a form's submit button spanning
 * its container vs. an inline action next to other controls.
 */
export const Button = styled.button<{ $variant?: ButtonVariant; $fullWidth?: boolean }>`
  ${Label.md}
  min-height: 40px;
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
  padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x4}`};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space.x2};
  border: 1px solid ${({ $variant = "primary" }) => VARIANT_STYLES[$variant].border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ $variant = "primary" }) => VARIANT_STYLES[$variant].background};
  color: ${({ $variant = "primary" }) => VARIANT_STYLES[$variant].color};
  cursor: pointer;
  transition:
    filter 0.12s,
    background 0.12s;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.shadow.focus};
  }

  &:disabled {
    opacity: 0.47;
    cursor: not-allowed;
  }
`;
