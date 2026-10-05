import styled from "styled-components";
import type { Agent } from "@ai-pixel-office/domain/entities";
import type { DeskItem } from "../utils/deskItems.ts";
import { DeskItemCard } from "./DeskItemCard.tsx";

const Styled = {
  Panel: styled.section`
    display: grid;
    align-content: start;
    gap: ${({ theme }) => theme.space.x3};
  `,
  Heading: styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x2};
    h2 {
      font-family: ${({ theme }) => theme.typography.fontFamily.serif};
      font-size: ${({ theme }) => theme.typography.fontSize.headingMd};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
  `,
  Empty: styled.p`
    padding: ${({ theme }) => theme.space.x5};
    border: 1px dashed ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    line-height: 1.5;
  `,
};

/** 결재함 (사람의 판단이 필요한 서류 목록) */
export function DeskPanel({
  items,
  agents,
  now,
}: {
  items: DeskItem[];
  agents: Agent[];
  now: Date;
}) {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  return (
    <Styled.Panel aria-label="결재함">
      <Styled.Heading>
        <h2>결재함 {items.length}</h2>
        <span>막고 있는 일부터</span>
      </Styled.Heading>
      {items.length === 0 ? (
        <Styled.Empty>결재할 서류가 없어요. 팀이 전결로 일을 이어가고 있어요.</Styled.Empty>
      ) : (
        items.map((item) => (
          <DeskItemCard
            key={item.task.id}
            item={item}
            assignee={
              item.task.assigneeAgentId ? agentById.get(item.task.assigneeAgentId) : undefined
            }
            now={now}
          />
        ))
      )}
    </Styled.Panel>
  );
}
