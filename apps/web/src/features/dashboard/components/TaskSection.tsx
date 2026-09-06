import styled from "styled-components";
import { Panel } from "@ai-pixel-office/design-system";
import type { Agent, Task, TaskStatus } from "@ai-pixel-office/domain/entities";
import { STATUS } from "../../../shared/config/presentation.ts";
import { Empty } from "../../../shared/ui/Empty.tsx";
import { SectionHeading, SectionHeadingCount } from "../../../shared/ui/SectionHeading.tsx";
import { TaskCard } from "../../tasks/TaskCard.tsx";

const Styled = {
  Section: styled(Panel).attrs({ as: "section" })<{ $status: TaskStatus }>`
    min-height: 96px;
    padding: ${({ theme }) => theme.space.x4};
    border-top-color: ${({ $status }) => STATUS[$status].color};
  `,
  TaskList: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    max-height: 360px;
    overflow: auto;
  `,
};

export function TaskSection({
  status,
  title,
  tasks,
  agents,
  onDelete,
  deletingId,
}: {
  status: TaskStatus;
  title?: string;
  tasks: Task[];
  agents: Agent[];
  onDelete: (task: Task) => void;
  deletingId?: string;
}) {
  return (
    <Styled.Section $status={status}>
      <SectionHeading $compact>
        <h2>
          <span>{STATUS[status].icon}</span> {title ?? STATUS[status].label}
        </h2>
        <SectionHeadingCount>{tasks.length}</SectionHeadingCount>
      </SectionHeading>
      <Styled.TaskList>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            agent={agents.find((agent) => agent.id === task.assigneeAgentId)}
            onDelete={
              ["working", "needs_input"].includes(task.status) ? undefined : () => onDelete(task)
            }
            deleting={deletingId === task.id}
          />
        ))}
        {tasks.length === 0 && <Empty>비어 있습니다.</Empty>}
      </Styled.TaskList>
    </Styled.Section>
  );
}
