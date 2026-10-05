import type { ReactNode } from "react";
import styled from "styled-components";
import type { Agent } from "@ai-pixel-office/domain/entities";
import { ColleagueBadge } from "./ColleagueBadge.tsx";

const Styled = {
  Section: styled.section`
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => theme.space.x5};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.xl};
    background: ${({ theme }) => theme.colors.background.surface};
  `,
  Heading: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: ${({ theme }) => theme.space.x3};
    h2 {
      font-size: ${({ theme }) => theme.typography.fontSize.headingSm};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
    span {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.base};
    }
  `,
  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: ${({ theme }) => theme.space.x3};
  `,
};

/** 팀 하나와 그 팀 동료들의 사원증 */
export function TeamMembers({
  title,
  subtitle,
  members,
}: {
  title: string;
  subtitle?: ReactNode;
  members: Agent[];
}) {
  return (
    <Styled.Section aria-label={title}>
      <Styled.Heading>
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
      </Styled.Heading>
      <Styled.Grid>
        {members.map((agent) => (
          <ColleagueBadge key={agent.id} agent={agent} />
        ))}
      </Styled.Grid>
    </Styled.Section>
  );
}
