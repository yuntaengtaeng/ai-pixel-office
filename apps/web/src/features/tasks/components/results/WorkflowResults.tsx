import type { Agent } from "@ai-pixel-office/domain/entities";
import type { TaskDetail } from "../../api.ts";
import { Empty } from "../../../../shared/ui/Empty.tsx";
import { FailureState } from "../execution/FailureState.tsx";
import { RunProgress } from "../execution/RunProgress.tsx";
import { WorkInProgress } from "../execution/WorkInProgress.tsx";
import { TaskResultView } from "./TaskResultView.tsx";

import styled from "styled-components";

const Styled = {
  WorkflowResults: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x5};
  `,
  WorkflowFinalResult: styled.section`
    padding: ${({ theme }) => theme.space.x4};
    border: 2px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
  `,
  WorkflowResultLabel: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};
    padding-bottom: ${({ theme }) => theme.space.x3};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.positive};

    strong {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
  `,
  WorkflowStepResults: styled.section`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding-top: ${({ theme }) => theme.space.x4};
    border-top: 2px dashed ${({ theme }) => theme.colors.border.subtle};
  `,
  WorkflowStepResultsHeading: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};
    margin-bottom: ${({ theme }) => theme.space.x1};

    strong {
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }

    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
  `,
  WorkflowResultStep: styled.details`
    scroll-margin-top: ${({ theme }) => theme.space.x6};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    summary {
      min-width: 0;
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) auto;
      align-items: center;
      gap: ${({ theme }) => theme.space.x2};
      padding: ${({ theme }) => theme.space.x3};
      cursor: pointer;
      list-style: none;

      &::-webkit-details-marker {
        display: none;
      }

      > span {
        width: 25px;
        height: 25px;
        display: grid;
        place-items: center;
        background: ${({ theme }) => theme.colors.brand.primary};
        color: white;
        font-family: ${({ theme }) => theme.typography.fontFamily.mono};
        font-size: ${({ theme }) => theme.typography.fontSize.micro};
        font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      }

      > div {
        min-width: 0;
        display: grid;
        gap: ${({ theme }) => theme.space.x1};
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        color: ${({ theme }) => theme.colors.text.primary};
        font-size: ${({ theme }) => theme.typography.fontSize.compact};
      }

      small {
        color: ${({ theme }) => theme.colors.text.muted};
        font-size: ${({ theme }) => theme.typography.fontSize.xs};
      }

      b {
        color: ${({ theme }) => theme.colors.text.positive};
        font-size: 0;

        &::after {
          content: "결과 보기";
          font-size: ${({ theme }) => theme.typography.fontSize.micro};
        }
      }
    }

    &[open] summary {
      border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};

      b::after {
        content: "결과 닫기";
      }
    }
  `,
  WorkflowResultBody: styled.div`
    padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x3} ${theme.space.x3}`};
  `,
};

export function WorkflowResults({
  task,
  agents,
  error,
}: {
  task: TaskDetail;
  agents: Agent[];
  error?: string;
}) {
  const completedSteps = task.workflow.filter((step) => step.result);
  const finalReady = ["needs_review", "done"].includes(task.status) && task.result;
  return (
    <Styled.WorkflowResults>
      {finalReady ? (
        <Styled.WorkflowFinalResult>
          <Styled.WorkflowResultLabel>
            <strong>최종 결과</strong>
            <span>{agents.find((agent) => agent.id === task.workflow.at(-1)?.agentId)?.name}</span>
          </Styled.WorkflowResultLabel>
          <TaskResultView result={task.result!} />
        </Styled.WorkflowFinalResult>
      ) : task.status === "failed" ? (
        <FailureState error={error} />
      ) : (
        <>
          <WorkInProgress waiting={task.status === "needs_input"} />
          <RunProgress events={task.progress} />
        </>
      )}
      <Styled.WorkflowStepResults>
        <Styled.WorkflowStepResultsHeading>
          <strong>단계별 결과</strong>
          <span>
            {completedSteps.length}/{task.workflow.length}
          </span>
        </Styled.WorkflowStepResultsHeading>
        {completedSteps.map((step) => {
          const stepAgent = agents.find((agent) => agent.id === step.agentId);
          return (
            <Styled.WorkflowResultStep key={step.id} id={`workflow-result-${step.id}`}>
              <summary>
                <span>{step.position + 1}</span>
                <div>
                  <strong>{stepAgent?.name ?? "삭제된 에이전트"}</strong>
                  <small>{stepAgent?.role ?? "역할 정보 없음"}</small>
                </div>
                <b>결과 보기</b>
              </summary>
              <Styled.WorkflowResultBody>
                <TaskResultView result={step.result!} size="compact" />
              </Styled.WorkflowResultBody>
            </Styled.WorkflowResultStep>
          );
        })}
        {completedSteps.length === 0 && <Empty>첫 번째 단계 결과를 기다리는 중입니다.</Empty>}
      </Styled.WorkflowStepResults>
    </Styled.WorkflowResults>
  );
}
