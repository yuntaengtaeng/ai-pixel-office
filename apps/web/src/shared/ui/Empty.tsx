import type { ReactNode } from "react";
import styled from "styled-components";

const EmptyState = styled.div`
  padding: 20px 8px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  text-align: center;
`;

export function Empty({ children }: { children: ReactNode }) {
  return <EmptyState>{children}</EmptyState>;
}
