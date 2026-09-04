import type { ReactNode } from "react";
import styled from "styled-components";

const EmptyState = styled.div`
  padding: ${({ theme }) => `${theme.space.x5} ${theme.space.x2}`};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  text-align: center;
`;

export function Empty({ children }: { children: ReactNode }) {
  return <EmptyState>{children}</EmptyState>;
}
