import type { ReactNode } from "react";
import styled from "styled-components";

const EmptyState = styled.div`
  padding: ${({ theme }) => `${theme.space.x5} ${theme.space.x2}`};
  display: grid;
  gap: ${({ theme }) => theme.space.x2};
  justify-items: center;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  text-align: center;
`;

const EmptyTitle = styled.strong`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
`;

export function Empty({
  title,
  action,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <EmptyState>
      {title && <EmptyTitle>{title}</EmptyTitle>}
      {children}
      {action}
    </EmptyState>
  );
}
