import styled from "styled-components";
import type { Agent, Task } from "@ai-pixel-office/domain/entities";
import { TaskCard } from "../../tasks/TaskCard.tsx";

const IN_PROGRESS_STATUSES = new Set<Task["status"]>(["working", "todo"]);

const Styled = {
  Section: styled.section`
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
    h2 {
      font-size: ${({ theme }) => theme.typography.fontSize.subtitle};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
  `,
  List: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: ${({ theme }) => theme.space.x3};
  `,
};

/** 팀이 진행 중이거나 시작 전인 일 목록 */
export function InProgressList({ tasks, agents }: { tasks: Task[]; agents: Agent[] }) {
  const inProgress = tasks.filter((task) => IN_PROGRESS_STATUSES.has(task.status));
  if (inProgress.length === 0) return null;
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  return (
    <Styled.Section aria-label="진행 중인 일">
      <h2>진행 중인 일 {inProgress.length}</h2>
      <Styled.List>
        {inProgress.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            agent={task.assigneeAgentId ? agentById.get(task.assigneeAgentId) : undefined}
          />
        ))}
      </Styled.List>
    </Styled.Section>
  );
}
