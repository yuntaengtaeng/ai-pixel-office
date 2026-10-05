import { Link } from "react-router-dom";
import styled from "styled-components";
import type { Agent, LeadMessage, Task } from "@ai-pixel-office/domain/entities";
import { TaskStatusPill } from "../../tasks/components/TaskStatusPill.tsx";
import { relativeTime } from "../../../shared/lib/time.ts";
import { PanelSection } from "../../../shared/ui/PanelSection.tsx";

const Styled = {
  Panel: styled.aside`
    display: grid;
    gap: ${({ theme }) => theme.space.x6};
    align-content: start;
  `,
  List: styled.ul`
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    a {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
      padding: ${({ theme }) => theme.space.x3};
      border-radius: ${({ theme }) => theme.radius.md};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      color: ${({ theme }) => theme.colors.text.primary};
    }
    small {
      color: ${({ theme }) => theme.colors.text.muted};
    }
  `,
  Empty: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
};

/** 팀장이 맡긴 기안서와 쌓인 보고 */
export function LeadDelegatedPanel({
  tasks,
  reports,
  agents,
}: {
  tasks: Task[];
  reports: LeadMessage[];
  agents: Agent[];
}) {
  const nameOf = (agentId?: string) => agents.find((agent) => agent.id === agentId)?.name ?? "담당";
  return (
    <Styled.Panel>
      <PanelSection title="팀장이 맡긴 기안">
        {tasks.length === 0 ? (
          <Styled.Empty>계획서를 결재하면 여기에 기안서가 생겨요.</Styled.Empty>
        ) : (
          <Styled.List>
            {tasks.map((task) => (
              <li key={task.id}>
                <Link to={`/tasks/${task.id}`}>
                  <strong>{task.title}</strong>
                  <small>
                    {nameOf(task.assigneeAgentId)} · <TaskStatusPill task={task} />
                  </small>
                </Link>
              </li>
            ))}
          </Styled.List>
        )}
      </PanelSection>
      {reports.length > 0 && (
        <PanelSection title="쌓인 보고">
          <Styled.List>
            {[...reports].reverse().map((report) => (
              <li key={report.id}>
                <small>{relativeTime(report.createdAt)}</small> {report.content}
              </li>
            ))}
          </Styled.List>
        </PanelSection>
      )}
    </Styled.Panel>
  );
}
