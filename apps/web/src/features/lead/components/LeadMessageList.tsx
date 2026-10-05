import styled from "styled-components";
import type { Agent, LeadMessage, LeadPlan, Task } from "@ai-pixel-office/domain/entities";
import { MarkdownContent } from "../../../shared/ui/MarkdownContent.tsx";
import { replyPoseOf } from "../utils/leadView.ts";
import { LeadPlanCard } from "./LeadPlanCard.tsx";
import { LeadSlime } from "./LeadSlime.tsx";

const Styled = {
  List: styled.ol`
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  User: styled.li`
    justify-self: end;
    max-width: min(560px, 85%);
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x4}`};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    white-space: pre-wrap;
    line-height: 1.6;
  `,
  Lead: styled.li`
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    gap: ${({ theme }) => theme.space.x3};
    align-items: start;
  `,
  Avatar: styled.div`
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
  `,
  Body: styled.div`
    min-width: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
  `,
  Status: styled.span<{ $failed?: boolean }>`
    color: ${({ theme, $failed }) => ($failed ? theme.colors.text.negative : theme.colors.text.muted)};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
  Report: styled.li`
    justify-self: center;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
};

/** 팀장 대화 (사람의 말, 팀장의 답과 계획서, 보고) */
export function LeadMessageList({
  messages,
  plans,
  agents,
  tasks,
  onPlanDecided,
}: {
  messages: LeadMessage[];
  plans: LeadPlan[];
  agents: Agent[];
  /** 이 프로젝트의 기안서 (결재한 계획서의 진행 상황) */
  tasks: Task[];
  onPlanDecided: () => void;
}) {
  const planOf = (planId?: string) => plans.find((plan) => plan.id === planId);
  return (
    <Styled.List aria-label="팀장과의 대화">
      {messages.map((message) => {
        if (message.role === "user")
          return <Styled.User key={message.id}>{message.content}</Styled.User>;
        if (message.role === "report")
          return <Styled.Report key={message.id}>{message.content}</Styled.Report>;
        const plan = planOf(message.planId);
        return (
          <Styled.Lead key={message.id}>
            <Styled.Avatar>
              <LeadSlime pose={replyPoseOf(message.status, plan?.status)} size={32} />
            </Styled.Avatar>
            <Styled.Body>
              {message.status === "pending" && (
                <Styled.Status>계획을 세우는 중이에요…</Styled.Status>
              )}
              {message.status === "failed" && (
                <Styled.Status $failed>{message.content}</Styled.Status>
              )}
              {message.status === "done" && message.content && (
                <MarkdownContent>{message.content}</MarkdownContent>
              )}
              {plan && (
                <LeadPlanCard plan={plan} agents={agents} tasks={tasks} onDecided={onPlanDecided} />
              )}
            </Styled.Body>
          </Styled.Lead>
        );
      })}
    </Styled.List>
  );
}
