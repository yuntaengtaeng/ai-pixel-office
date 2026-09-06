import type { Agent, TaskWorkflowStep } from "@ai-pixel-office/domain/entities";

import styled from "styled-components";

const Styled = {
  WorkflowStepJump: styled.button`
    position: absolute;
    z-index: ${({ theme }) => theme.zIndex.raised};
    inset: 0;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;

    &:focus-visible {
      outline: 2px dashed ${({ theme }) => theme.colors.border.positive};
      outline-offset: 3px;
    }
  `,
};

export function WorkflowProgressStep({ step, agent }: { step: TaskWorkflowStep; agent?: Agent }) {
  const labels: Record<TaskWorkflowStep["status"], string> = {
    pending: "대기",
    working: "작업 중",
    completed: "완료",
    failed: "실패",
  };
  return (
    <li data-status={step.status} className={step.result ? "has-result" : undefined}>
      <span>{step.position + 1}</span>
      <div>
        <strong>{agent?.name ?? "삭제된 에이전트"}</strong>
        <small>{labels[step.status]}</small>
      </div>
      {step.result && step.runId && (
        <Styled.WorkflowStepJump
          type="button"
          aria-label={`${step.position + 1}단계 ${agent?.name ?? "에이전트"} 결과로 이동`}
          title="대화에서 이 단계 결과 보기"
          onClick={() => revealWorkflowResult(step.runId!)}
        />
      )}
    </li>
  );
}

function revealWorkflowResult(runId: string): void {
  const target = document.getElementById(`run-${runId}`);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}
