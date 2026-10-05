import type { ReactNode } from "react";
import styled from "styled-components";

const Styled = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.space.x3};
  h2 {
    margin: 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    letter-spacing: 0.04em;
  }
`;

/** 제목이 있는 패널 구획 */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Styled aria-label={title}>
      <h2>{title}</h2>
      {children}
    </Styled>
  );
}
