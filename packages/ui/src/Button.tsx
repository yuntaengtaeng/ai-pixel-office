import styled from "styled-components";
import { Label } from "./typography.ts";

export type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_STYLES: Record<
  ButtonVariant,
  { color: string; background: string; border: string; shadow: string }
> = {
  primary: {
    color: "#fff9ec",
    background: "#4e8874",
    border: "#2f5448",
    shadow: "#294d42",
  },
  secondary: {
    color: "#59483d",
    background: "#f1dfbc",
    border: "#8d704f",
    shadow: "#b59876",
  },
  danger: {
    color: "#fff",
    background: "#c45d58",
    border: "#763c39",
    shadow: "#783d39",
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
  padding: 10px 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 2px solid ${({ $variant = "primary" }) => VARIANT_STYLES[$variant].border};
  background: ${({ $variant = "primary" }) => VARIANT_STYLES[$variant].background};
  color: ${({ $variant = "primary" }) => VARIANT_STYLES[$variant].color};
  box-shadow: 3px 3px 0 ${({ $variant = "primary" }) => VARIANT_STYLES[$variant].shadow};
  cursor: pointer;
  transition:
    transform 0.12s,
    box-shadow 0.12s;

  &:hover:not(:disabled) {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 currentColor;
  }

  &:disabled {
    opacity: 0.47;
    cursor: not-allowed;
  }
`;
