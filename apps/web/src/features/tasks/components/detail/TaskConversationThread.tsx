import styled from "styled-components";
import type { Agent, AgentRun } from "@ai-pixel-office/domain/entities";
import { TaskResultView } from "../results/TaskResultView.tsx";
import { PetPreview } from "../../../office/PetPreview.tsx";

const Styled = {
  Thread: styled.div`
    display: grid;
    min-width: 0;
    gap: ${({ theme }) => theme.space.x4};
  `,
  RunGroup: styled.div`
    display: grid;
    min-width: 0;
    gap: ${({ theme }) => theme.space.x3};
  `,
  Row: styled.div<{ $from: "user" | "agent" }>`
    display: flex;
    min-width: 0;
    justify-content: ${({ $from }) => ($from === "user" ? "flex-end" : "flex-start")};
    align-items: flex-start;
    gap: ${({ theme }) => theme.space.x2};
  `,
  AgentColumn: styled.div`
    min-width: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
  `,
  AgentLabel: styled.small`
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};

    span {
      font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
    }
  `,
  Bubble: styled.div<{
    $from: "user" | "agent";
    $failed?: boolean;
    $markdown?: boolean;
    $emphasize?: boolean;
  }>`
    min-width: 0;
    max-width: ${({ $from }) => ($from === "user" ? "78%" : "100%")};
    padding: ${({ $from, $emphasize, theme }) =>
      $from === "user"
        ? `${theme.space.x2} ${theme.space.x4}`
        : $emphasize
          ? theme.space.x3
          : "0"};
    border: ${({ $failed, $emphasize, theme }) =>
      $failed
        ? `1px solid ${theme.colors.border.negative}`
        : $emphasize
          ? `2px solid ${theme.colors.border.positive}`
          : "0"};
    border-radius: ${({ $from, theme }) => ($from === "user" ? theme.radius.xl : "0")};
    background: ${({ $from, $failed, $emphasize, theme }) =>
      $failed
        ? theme.colors.background.negativeSubtle
        : $emphasize
          ? theme.colors.background.positiveSubtle
          : $from === "user"
            ? theme.colors.background.positiveSubtle
            : "transparent"};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    line-height: 1.6;
    /* 마크다운은 <p>/<li>가 자체적으로 줄바꿈을 표현하므로 pre-wrap을 상속하면 원문 개행이 중복 표시됨 */
    white-space: ${({ $markdown }) => ($markdown ? "normal" : "pre-wrap")};
    overflow-wrap: anywhere;
  `,
  Pending: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
  `,
  Dots: styled.span`
    display: inline-flex;
    gap: 3px;

    span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: ${({ theme }) => theme.colors.text.muted};
      animation: task-thread-pulse 1s infinite ease-in-out;
    }
    span:nth-child(2) {
      animation-delay: 0.15s;
    }
    span:nth-child(3) {
      animation-delay: 0.3s;
    }

    @keyframes task-thread-pulse {
      0%,
      80%,
      100% {
        opacity: 0.25;
      }
      40% {
        opacity: 1;
      }
    }
  `,
};

/**
 * Task 전용 대화 스레드. Chat의 MessageThread와 시각적으로 닮았지만 별도 컴포넌트로 소유한다 —
 * 순차 협업(Workflow)에서는 run마다 담당 에이전트가 달라져 발신자 라벨이 필요한데, 이건 Chat의
 * 1:1 대화에는 없는 요구라 공유 컴포넌트에 조건부로 얹기보다 Task가 직접 소유하는 편이 낫다.
 */
export function TaskConversationThread({
  runs,
  agents,
  showAgentLabels,
  activeRunStatus,
  emphasizeLastAgentBubble,
}: {
  runs: AgentRun[];
  agents: Agent[];
  showAgentLabels?: boolean;
  activeRunStatus?: "queued" | "running" | "waiting";
  emphasizeLastAgentBubble?: boolean;
}) {
  const chronological = [...runs].reverse();
  const lastAgentRunIndex = chronological.findLastIndex(
    (run) => run.status === "completed" && run.result,
  );
  const pendingAgent = agents.find((candidate) => candidate.id === chronological.at(-1)?.agentId);
  return (
    <Styled.Thread>
      {chronological.map((run, index) => {
        const runAgent = agents.find((candidate) => candidate.id === run.agentId);
        return (
          <Styled.RunGroup key={run.id} id={`run-${run.id}`}>
            {run.request && (
              <Styled.Row $from="user">
                <Styled.Bubble $from="user">{run.request}</Styled.Bubble>
              </Styled.Row>
            )}
            {run.status === "completed" && run.result && (
              <Styled.Row $from="agent">
                <PetPreview petId={runAgent?.avatarId ?? ""} size={28} />
                <Styled.AgentColumn>
                  {showAgentLabels && (
                    <Styled.AgentLabel>
                      {runAgent?.name ?? "에이전트"}
                      {runAgent?.role && <span> · {runAgent.role}</span>}
                    </Styled.AgentLabel>
                  )}
                  <Styled.Bubble
                    $from="agent"
                    $markdown
                    $emphasize={emphasizeLastAgentBubble && index === lastAgentRunIndex}
                  >
                    <TaskResultView result={run.result} size="compact" />
                  </Styled.Bubble>
                </Styled.AgentColumn>
              </Styled.Row>
            )}
            {run.status === "failed" && (
              <Styled.Row $from="agent">
                <PetPreview petId={runAgent?.avatarId ?? ""} size={28} />
                <Styled.AgentColumn>
                  {showAgentLabels && (
                    <Styled.AgentLabel>
                      {runAgent?.name ?? "에이전트"}
                      {runAgent?.role && <span> · {runAgent.role}</span>}
                    </Styled.AgentLabel>
                  )}
                  <Styled.Bubble $from="agent" $failed>
                    {run.error || "실행이 예기치 않게 종료되었어요"}
                  </Styled.Bubble>
                </Styled.AgentColumn>
              </Styled.Row>
            )}
          </Styled.RunGroup>
        );
      })}
      {activeRunStatus && (
        <Styled.Row $from="agent">
          <PetPreview petId={pendingAgent?.avatarId ?? ""} size={28} />
          <Styled.AgentColumn>
            {showAgentLabels && (
              <Styled.AgentLabel>
                {chronological.length}단계 · {pendingAgent?.name ?? "에이전트"}
                {pendingAgent?.role && <span> · {pendingAgent.role}</span>}
              </Styled.AgentLabel>
            )}
            <Styled.Pending>
              <Styled.Dots aria-hidden="true">
                <span />
                <span />
                <span />
              </Styled.Dots>
              {activeRunStatus === "waiting" ? "승인을 기다리는 중" : "답변을 준비하는 중"}
            </Styled.Pending>
          </Styled.AgentColumn>
        </Styled.Row>
      )}
    </Styled.Thread>
  );
}
