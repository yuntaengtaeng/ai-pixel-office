import { mediaQuery } from "@ai-pixel-office/design-system";
import { useId, useRef, useState, type FormEvent } from "react";
import styled, { keyframes } from "styled-components";
import { Button, Input, Popover } from "@ai-pixel-office/design-system";
import type { Agent, Task, TaskStatus } from "@ai-pixel-office/domain/entities";
import { RUNTIME } from "../../../shared/config/presentation.ts";
import { OFFICE_STATUS_LABEL } from "../utils/pet-personality.ts";

const agentFloat = keyframes`
  from {
    transform: translateY(-1px);
  }
  to {
    transform: translateY(1px);
  }
`;

const StatusLabel = styled.span<{ $hidden: boolean }>`
  position: absolute;
  left: -16.5%;
  top: 0;
  width: 133%;
  height: 27%;
  padding: 0 5%;
  border: 2px solid #748c83;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.background.surface};
  display: grid;
  place-items: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: clamp(5px, 0.82vw, 10px);
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  transition:
    opacity 0.18s ease-out,
    transform 0.18s ease-out;

  ${({ $hidden }) =>
    $hidden &&
    `
      opacity: 0;
      transform: translateY(4px) scale(0.96);
    `}

  @media ${mediaQuery.reducedMotion} {
    animation: none;
  }
`;

const AgentName = styled.button<{ $hasTask: boolean }>`
  position: absolute;
  z-index: ${({ theme }) => theme.zIndex.raised};
  left: 3%;
  bottom: -9%;
  width: 94%;
  min-height: 23%;
  padding: 2% 4%;
  border: 1px solid rgb(109 83 71 / 42%);
  border-radius: ${({ theme }) => theme.radius.sm};
  background: rgb(255 250 240 / 88%);
  box-shadow: 0 2px 0 rgb(109 83 71 / 30%);
  display: grid;
  place-content: center;
  color: #4b4541;
  font: inherit;
  line-height: 1.05;
  pointer-events: auto;
  cursor: pointer;

  strong {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: clamp(6px, 1vw, 12px);
  }

  small {
    margin-top: ${({ theme }) => theme.space.x1};
    color: #6f786e;
    font-size: clamp(4px, 0.62vw, 7px);
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  }

  ${({ $hasTask }) =>
    $hasTask &&
    `
      border-color: #628275;
      background: rgb(239 248 240 / 94%);
    `}

  &:focus-visible {
    outline: 2px dashed #426e60;
    outline-offset: 2px;
  }
`;

const RuntimeChip = styled.span`
  position: absolute;
  top: -22%;
  right: -8%;
  z-index: ${({ theme }) => theme.zIndex.floating};
  padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x1}`};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: #fff;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: clamp(5px, 0.6vw, ${({ theme }) => theme.typography.fontSize.xs});
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  letter-spacing: 0.02em;
  white-space: nowrap;
  box-shadow: 0 1px 0 rgb(0 0 0 / 25%);
`;

const AgentHitbox = styled.button`
  position: absolute;
  z-index: ${({ theme }) => theme.zIndex.content};
  left: 12%;
  top: 28%;
  width: 76%;
  height: 81%;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: transparent;
  pointer-events: auto;
  cursor: pointer;

  &:focus-visible {
    outline: 2px dashed #426e60;
    outline-offset: 2px;
  }
`;

const AgentSlot = styled.div`
  position: absolute;
  width: 16.05%;
  color: #4b4541;
  text-align: center;
  font-family: Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  animation: ${agentFloat} 1.5s ease-in-out infinite alternate;
  pointer-events: none;

  @media ${mediaQuery.reducedMotion} {
    animation: none;
  }

  &:hover ${AgentName}, &:focus-within ${AgentName} {
    border-color: #426e60;
  }

  &[data-status="needs_review"]
    ${AgentName},
    &[data-status="needs_input"]
    ${AgentName},
    &[data-status="blocked"]
    ${AgentName},
    &[data-status="failed"]
    ${AgentName} {
    border-color: #8b68b5;
    box-shadow: 0 2px 0 rgb(92 66 123 / 42%);
  }
`;

const QuickPopover = styled(Popover)`
  z-index: ${({ theme }) => theme.zIndex.popover};
  width: min(320px, calc(100vw - 24px));
  padding: ${({ theme }) => theme.space.x4};
  border: 2px solid #5a766c;
  background: ${({ theme }) => theme.colors.background.surface};
  box-shadow: 5px 5px 0 #9eafa6;

  small {
    color: #7d6f65;
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
  }

  form {
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
  }

  label {
    color: #796b60;
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
  }
`;

const PopoverHeading = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.space.x3};
`;

const TaskListPopover = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.x1};
  max-height: 180px;
  margin-bottom: ${({ theme }) => theme.space.x3};
  overflow: auto;

  button {
    min-width: 0;
    padding: ${({ theme }) => theme.space.x2};
    border: 1px solid #d5c8b5;
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.space.x2};
    align-items: center;
    color: #4b4541;
    text-align: left;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      border-color: #4c7b6b;
      background: #eaf2ec;
      outline: none;
    }

    > span,
    > small {
      color: #756960;
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }

    > strong {
      overflow: hidden;
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
`;

const Styled = {
  AgentSlot,
  StatusLabel,
  AgentName,
  RuntimeChip,
  AgentHitbox,
  QuickPopover,
  PopoverHeading,
  TaskList: TaskListPopover,
};

export function AgentQuickAssign({
  agent,
  message,
  tasks,
  status,
  left,
  top,
  height,
  onAssign,
  onOpenTask,
}: {
  agent: Agent;
  message?: string;
  tasks: Task[];
  status: TaskStatus | "idle";
  left: string;
  top: string;
  height: string;
  onAssign?: (agentId: string, title: string, description?: string) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !onAssign) return;
    onAssign(agent.id, title.trim(), description.trim() || undefined);
    setTitle("");
    setDescription("");
    setOpen(false);
  };
  const runtime = RUNTIME[agent.model];
  const labelContents = (
    <>
      <Styled.RuntimeChip data-model={agent.model} style={{ background: runtime.color }}>
        {runtime.label}
      </Styled.RuntimeChip>
      <strong>{agent.name}</strong>
      <small>{tasks.length > 0 ? `작업 ${tasks.length}개 보기` : "바로 맡기기 +"}</small>
    </>
  );
  const bubble = (
    <Styled.StatusLabel $hidden={!message} aria-hidden={!message}>
      {message ?? "대화 없음"}
    </Styled.StatusLabel>
  );

  return (
    <Styled.AgentSlot style={{ left, top, height }} data-status={status}>
      {bubble}
      <Styled.AgentName
        ref={triggerRef}
        type="button"
        $hasTask={tasks.length > 0}
        aria-expanded={open}
        aria-controls={popoverId}
        title={
          tasks.length > 0 ? `${agent.name}의 작업 목록 열기` : `${agent.name}에게 바로 작업 맡기기`
        }
        aria-label={
          tasks.length > 0 ? `${agent.name}의 작업 목록 열기` : `${agent.name}에게 바로 작업 맡기기`
        }
        onClick={() => setOpen(true)}
      >
        {labelContents}
      </Styled.AgentName>
      <Styled.AgentHitbox
        type="button"
        title={
          tasks.length > 0 ? `${agent.name}의 작업 목록 열기` : `${agent.name}에게 바로 작업 맡기기`
        }
        aria-label={
          tasks.length > 0 ? `${agent.name}의 작업 목록 열기` : `${agent.name}에게 바로 작업 맡기기`
        }
        onClick={() => setOpen(true)}
      />
      <Styled.QuickPopover
        id={popoverId}
        open={open}
        onOpenChange={setOpen}
        anchorRef={triggerRef}
        side="top"
        sideOffset={10}
        collisionPadding={16}
      >
        <Styled.PopoverHeading>
          <small>{tasks.length > 0 ? `진행할 작업 ${tasks.length}개` : "바로 맡기기"}</small>
          <strong>{agent.name}</strong>
        </Styled.PopoverHeading>
        {tasks.length > 0 && (
          <Styled.TaskList>
            {tasks.map((task) => (
              <button
                type="button"
                key={task.id}
                onClick={() => {
                  setOpen(false);
                  onOpenTask?.(task.id);
                }}
              >
                <span>{OFFICE_STATUS_LABEL[task.status]}</span>
                <strong>{task.title}</strong>
                <small>열기 →</small>
              </button>
            ))}
          </Styled.TaskList>
        )}
        <form onSubmit={submit}>
          <label>
            할 일
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 화면 문구 검토"
              autoFocus
            />
          </label>
          <label>
            원하는 결과 · 선택
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="비워도 괜찮아요"
            />
          </label>
          <Button $variant="primary" disabled={!title.trim()}>
            작업 만들기
          </Button>
        </form>
      </Styled.QuickPopover>
    </Styled.AgentSlot>
  );
}
