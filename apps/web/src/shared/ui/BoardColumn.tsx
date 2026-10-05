import type { ReactNode } from "react";
import styled from "styled-components";

const Styled = {
  Column: styled.section`
    min-width: 0;
    display: grid;
    align-content: start;
    gap: ${({ theme }) => theme.space.x2};
  `,
  Heading: styled.h3<{ $color: string }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `0 2px ${theme.space.x1}`};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    &::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: ${({ theme }) => theme.radius.circle};
      background: ${({ $color }) => $color};
    }
    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    }
  `,
  Empty: styled.p`
    margin: 0;
    padding: ${({ theme }) => `${theme.space.x2} 2px`};
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
};

/** 보드의 한 칸 (제목, 점 색, 개수, 카드 목록) */
export function BoardColumn({
  title,
  color,
  count,
  emptyText,
  children,
}: {
  title: string;
  color: string;
  count: number;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <Styled.Column aria-label={title}>
      <Styled.Heading $color={color}>
        {title}
        <span>{count}</span>
      </Styled.Heading>
      {count === 0 ? <Styled.Empty>{emptyText}</Styled.Empty> : children}
    </Styled.Column>
  );
}
