import styled from "styled-components";
import type { Agent, Task } from "@ai-pixel-office/domain/entities";
import { REQUEST_STATE, STATUS } from "../../../../shared/config/presentation.ts";
import { relativeTime } from "../../../../shared/lib/time.ts";
import { BoardColumn } from "../../../../shared/ui/BoardColumn.tsx";
import {
  groupRequestsByColumn,
  REQUEST_COLUMNS,
  type RequestColumnId,
} from "../../utils/requestBoard.ts";
import { requestStateOf } from "../../utils/requestState.ts";

const COLUMN_COLOR: Record<RequestColumnId, string> = {
  queued: REQUEST_STATE.queued.color,
  working: STATUS.working.color,
  needs_me: STATUS.needs_input.color,
  review: STATUS.needs_review.color,
  done: STATUS.done.color,
};

const Styled = {
  Scroll: styled.div`
    overflow-x: auto;
    padding-bottom: ${({ theme }) => theme.space.x2};
  `,
  Board: styled.div`
    min-width: 900px;
    display: grid;
    grid-template-columns: repeat(5, minmax(170px, 1fr));
    gap: ${({ theme }) => theme.space.x3};
  `,
  Card: styled.button<{ $selected: boolean }>`
    width: 100%;
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid
      ${({ $selected, theme }) => ($selected ? theme.colors.brand.primary : theme.colors.border.default)};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.background.surface};
    color: ${({ theme }) => theme.colors.text.primary};
    text-align: left;
    cursor: pointer;
    &:hover {
      border-color: ${({ theme }) => theme.colors.border.strong};
    }
    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.base};
      overflow-wrap: anywhere;
    }
    span {
      display: flex;
      justify-content: space-between;
      gap: ${({ theme }) => theme.space.x2};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
  `,
};

/** 프로젝트 기안서 보드 (기다리는 것별 칸, 카드를 고르면 인스펙터로 봄) */
export function RequestBoard({
  tasks,
  agents,
  selectedId,
  onSelect,
}: {
  tasks: Task[];
  agents: Agent[];
  selectedId?: string;
  onSelect: (taskId: string) => void;
}) {
  const columns = groupRequestsByColumn(tasks);
  const nameOf = (agentId?: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? "담당 없음";
  return (
    <Styled.Scroll>
      <Styled.Board>
        {REQUEST_COLUMNS.map((column) => (
          <BoardColumn
            key={column.id}
            title={column.label}
            color={COLUMN_COLOR[column.id]}
            count={columns[column.id].length}
            emptyText="없음"
          >
            {columns[column.id].map((task) => (
              <Styled.Card
                key={task.id}
                type="button"
                $selected={task.id === selectedId}
                aria-pressed={task.id === selectedId}
                onClick={() => onSelect(task.id)}
              >
                <strong>{task.title}</strong>
                <span>
                  {nameOf(task.assigneeAgentId)} · {REQUEST_STATE[requestStateOf(task)].label}
                  <time dateTime={task.updatedAt}>{relativeTime(task.updatedAt)}</time>
                </span>
              </Styled.Card>
            ))}
          </BoardColumn>
        ))}
      </Styled.Board>
    </Styled.Scroll>
  );
}
