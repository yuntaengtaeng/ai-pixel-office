import type { ReactNode } from "react";
import styled from "styled-components";

const Banner = styled.div`
  grid-column: 1 / -1;
  padding: ${({ theme }) => theme.space.x3};
  border: 2px solid ${({ theme }) => theme.colors.border.negative};
  background: ${({ theme }) => theme.colors.background.negativeSubtle};
  color: ${({ theme }) => theme.colors.text.negative};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`;

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <Banner>! {children}</Banner>;
}
