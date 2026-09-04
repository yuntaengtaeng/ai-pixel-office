import { Link } from "react-router-dom";
import styled from "styled-components";
import { TrashIcon } from "@ai-pixel-office/design-system";
import type { Agent, Task } from "@ai-pixel-office/domain/entities";
import { PRIORITY_COLORS } from "../../shared/config/presentation.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { PetPreview } from "../office/PetPreview.tsx";

const Styled = {
  Row: styled.article`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    &:hover {
      border-color: ${({ theme }) => theme.colors.border.default};
      transform: translateY(-1px);
    }
  `,
  Card: styled(Link)`
    position: relative;
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3} ${theme.space.x3} ${theme.space.x4}`};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    border: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.space.x2};
    align-items: center;
    min-width: 0;
  `,
  Priority: styled.span<{ $priority: NonNullable<Task["priority"]> }>`
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    background: ${({ $priority }) => PRIORITY_COLORS[$priority]};
  `,
  Copy: styled.div`
    min-width: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x1};

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.base};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    > span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }
  `,
  MiniAgent: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 39px;

    span {
      display: none;
    }
  `,
  Unassigned: styled.span`
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    color: ${({ theme }) => theme.colors.text.muted};
  `,
  DeleteButton: styled.button`
    display: grid;
    place-items: center;
    border: 0;
    border-left: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.negative};
    cursor: pointer;
    transition:
      color 0.14s,
      background 0.14s;

    svg {
      width: 15px;
      height: 15px;
      fill: currentColor;
    }

    &:hover:not(:disabled),
    &:focus-visible {
      color: ${({ theme }) => theme.colors.text.negative};
      background: ${({ theme }) => theme.colors.background.negativeSubtle};
      outline: none;
    }

    &:focus-visible {
      box-shadow: inset 0 0 0 2px ${({ theme }) => theme.colors.border.negative};
    }

    &:disabled {
      cursor: wait;
    }
  `,
  DeleteLoading: styled.span`
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
  `,
};

export function TaskCard({
  task,
  agent,
  onDelete,
  deleting = false,
}: {
  task: Task;
  agent?: Agent;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <Styled.Row>
      <Styled.Card to={`/tasks/${task.id}`}>
        <Styled.Priority $priority={task.priority ?? "medium"} />
        <Styled.Copy>
          <strong>{task.title}</strong>
          <span>{task.description || "설명이 없습니다."}</span>
          <small>
            {task.priority === "high" ? "높은 우선순위 · " : ""}
            {relativeTime(task.updatedAt)} 업데이트
          </small>
        </Styled.Copy>
        {agent ? (
          <Styled.MiniAgent>
            <PetPreview petId={agent.avatarId ?? ""} size={36} />
            <span>{agent.name}</span>
          </Styled.MiniAgent>
        ) : (
          <Styled.Unassigned>배치하기 →</Styled.Unassigned>
        )}
      </Styled.Card>
      {onDelete && (
        <Styled.DeleteButton
          type="button"
          disabled={deleting}
          onClick={onDelete}
          aria-label={`${task.title} 삭제`}
          title="할 일 삭제"
        >
          {deleting ? <Styled.DeleteLoading>…</Styled.DeleteLoading> : <TrashIcon size={15} />}
        </Styled.DeleteButton>
      )}
    </Styled.Row>
  );
}
