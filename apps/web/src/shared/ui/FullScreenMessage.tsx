import type { ReactNode } from "react";
import styled from "styled-components";

const Message = styled.div<{ $error: boolean }>`
  display: grid;
  min-height: 100vh;
  place-content: center;
  justify-items: center;
  gap: 12px;
  background: ${({ theme }) => theme.colors.background.canvas};
  color: ${({ $error, theme }) =>
    $error ? theme.colors.text.negative : theme.colors.text.secondary};

  > span {
    display: grid;
    width: 48px;
    height: 48px;
    place-items: center;
    border: 3px solid ${({ theme }) => theme.colors.border.strong};
    background: ${({ theme }) => theme.colors.semantic.warning};
    box-shadow: 4px 4px 0 ${({ theme }) => theme.colors.border.default};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.displayXs};
    font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
  }
`;

export function FullScreenMessage({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <Message $error={error}>
      <span>{error ? "!" : "…"}</span>
      <strong>{children}</strong>
    </Message>
  );
}
