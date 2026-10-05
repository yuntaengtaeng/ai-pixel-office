import type { ReactNode } from "react";
import styled from "styled-components";

const Styled = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.x1};
  padding: ${({ theme }) => `2px ${theme.space.x2}`};
  border: 1px solid ${({ $color }) => $color};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ $color }) => $color};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  white-space: nowrap;
`;

/** 색 테두리가 있는 작은 라벨 */
export function Pill({ color, children }: { color: string; children: ReactNode }) {
  return <Styled $color={color}>{children}</Styled>;
}
