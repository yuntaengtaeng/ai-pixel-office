import { Link } from "react-router-dom";
import styled from "styled-components";
import { TrashIcon } from "@ai-pixel-office/ui";
import type { Agent, Task } from "@ai-pixel-office/domain/entities";
import { relativeTime } from "../../shared/lib/time.ts";
import { PetPreview } from "../office/PetPreview.tsx";

const PRIORITY_COLORS: Record<NonNullable<Task["priority"]>, string> = {
  high: "#d5685e",
  medium: "#d4ac67",
  low: "#6fa389",
};

const Styled = {
  Row: styled.article`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px;
    border: 1px solid #d9cdbd;
    background: #fffdfa;

    &:hover {
      border-color: #8b7667;
      transform: translateY(-1px);
    }
  `,
  Card: styled(Link)`
    position: relative;
    padding: 11px 10px 10px 16px;
    background: #fffdfa;
    border: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
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
    gap: 4px;

    strong {
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    > span {
      color: ${({ theme }) => theme.colors.muted};
      font-size: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: #9b8e83;
      font-size: 8px;
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
    font-size: 9px;
    color: #9a9188;
  `,
  DeleteButton: styled.button`
    display: grid;
    place-items: center;
    border: 0;
    border-left: 1px solid #e4d8ca;
    background: #faf7f1;
    color: #887871;
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
      color: #9f413d;
      background: #f7dfdc;
      outline: none;
    }

    &:focus-visible {
      box-shadow: inset 0 0 0 2px #b6605a;
    }

    &:disabled {
      cursor: wait;
    }
  `,
  DeleteLoading: styled.span`
    font-size: 14px;
    font-weight: 900;
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
