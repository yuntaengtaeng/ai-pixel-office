import styled from "styled-components";
import { Button, Panel } from "@ai-pixel-office/design-system";
import type { Agent, Task, TaskStatus } from "@ai-pixel-office/domain/entities";
import { STATUS } from "../../../shared/config/presentation.ts";
import { Empty } from "../../../shared/ui/Empty.tsx";
import { SectionHeading, SectionHeadingCount } from "../../../shared/ui/SectionHeading.tsx";
import { TaskCard } from "../../tasks/TaskCard.tsx";

const Styled = {
  Section: styled(Panel).attrs({ as: "section" })<{ $status: TaskStatus }>`
    min-width: 260px;
    min-height: 96px;
    border-top-color: ${({ $status }) => STATUS[$status].color};
  `,
  ScrollArea: styled.div`
    max-height: 420px;
    overflow-y: auto;
  `,
  Heading: styled(SectionHeading)<{ $status: TaskStatus }>`
    position: sticky;
    top: 0;
    padding: ${({ theme }) => `${theme.space.x4} ${theme.space.x4} ${theme.space.x3}`};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    border-bottom: 2px solid ${({ $status }) => STATUS[$status].color};
    z-index: ${({ theme }) => theme.zIndex.content};
  `,
  TaskList: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `0 ${theme.space.x4} ${theme.space.x4}`};
  `,
  EmptyAction: styled.div`
    display: grid;
    justify-items: center;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `${theme.space.x5} ${theme.space.x2}`};

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
  `,
};

export function TaskSection({
  status,
  title,
  tasks,
  agents,
  onDelete,
  deletingId,
  onCreate,
}: {
  status: TaskStatus;
  title?: string;
  tasks: Task[];
  agents: Agent[];
  onDelete: (task: Task) => void;
  deletingId?: string;
  onCreate?: () => void;
}) {
  return (
    <Styled.Section $status={status}>
      <Styled.ScrollArea>
        <Styled.Heading $status={status} $compact>
          <h2>
            <span>{STATUS[status].icon}</span> {title ?? STATUS[status].label}
          </h2>
          <SectionHeadingCount>{tasks.length}</SectionHeadingCount>
        </Styled.Heading>
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
          {tasks.length === 0 &&
            (status === "todo" && onCreate ? (
              <Styled.EmptyAction>
                <span>아직 할 일이 없습니다.</span>
                <Button type="button" $variant="secondary" onClick={onCreate}>
                  + 작업 만들기
                </Button>
              </Styled.EmptyAction>
            ) : (
              <Empty>비어 있습니다.</Empty>
            ))}
        </Styled.TaskList>
      </Styled.ScrollArea>
    </Styled.Section>
  );
}
