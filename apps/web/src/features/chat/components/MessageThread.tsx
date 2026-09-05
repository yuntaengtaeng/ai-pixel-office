import styled from "styled-components";
import type { Agent } from "@ai-pixel-office/domain/entities";
import type { TaskDetail } from "../../tasks/api.ts";
import { TaskResultView } from "../../tasks/components/results/TaskResultView.tsx";
import { PetPreview } from "../../office/PetPreview.tsx";

const Styled = {
  Thread: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  Row: styled.div<{ $from: "user" | "agent" }>`
    display: flex;
    justify-content: ${({ $from }) => ($from === "user" ? "flex-end" : "flex-start")};
    align-items: flex-start;
    gap: ${({ theme }) => theme.space.x2};
  `,
  Bubble: styled.div<{ $from: "user" | "agent"; $failed?: boolean; $markdown?: boolean }>`
    max-width: ${({ $from }) => ($from === "user" ? "78%" : "100%")};
    padding: ${({ $from, theme }) =>
      $from === "user" ? `${theme.space.x2} ${theme.space.x4}` : "0"};
    border: ${({ $failed, theme }) => ($failed ? `1px solid ${theme.colors.border.negative}` : "0")};
    border-radius: ${({ $from, theme }) => ($from === "user" ? theme.radius.xl : "0")};
    background: ${({ $from, $failed, theme }) =>
      $failed
        ? theme.colors.background.negativeSubtle
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
      animation: pulse 1s infinite ease-in-out;
    }
    span:nth-child(2) {
      animation-delay: 0.15s;
    }
    span:nth-child(3) {
      animation-delay: 0.3s;
    }

    @keyframes pulse {
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

/** run.request/result가 각각 사용자/에이전트 메시지 한 쌍이라 실행 기록을 그대로 채팅 말풍선으로 매핑 */
export function MessageThread({
  runs,
  activeRunStatus,
  agent,
}: {
  runs: TaskDetail["runs"];
  activeRunStatus?: "queued" | "running" | "waiting";
  agent?: Agent;
}) {
  const chronological = [...runs].reverse();
  return (
    <Styled.Thread>
      {chronological.map((run) => (
        <div key={run.id}>
          {run.request && (
            <Styled.Row $from="user">
              <Styled.Bubble $from="user">{run.request}</Styled.Bubble>
            </Styled.Row>
          )}
          {run.status === "completed" && run.result && (
            <Styled.Row $from="agent">
              <PetPreview petId={agent?.avatarId ?? ""} size={28} />
              <Styled.Bubble $from="agent" $markdown>
                <TaskResultView result={run.result} size="compact" />
              </Styled.Bubble>
            </Styled.Row>
          )}
          {run.status === "failed" && (
            <Styled.Row $from="agent">
              <PetPreview petId={agent?.avatarId ?? ""} size={28} />
              <Styled.Bubble $from="agent" $failed>
                {run.error || "실행이 예기치 않게 종료되었어요"}
              </Styled.Bubble>
            </Styled.Row>
          )}
        </div>
      ))}
      {activeRunStatus && (
        <Styled.Row $from="agent">
          <PetPreview petId={agent?.avatarId ?? ""} size={28} />
          <Styled.Pending>
            <Styled.Dots aria-hidden="true">
              <span />
              <span />
              <span />
            </Styled.Dots>
            {activeRunStatus === "waiting" ? "승인을 기다리는 중" : "답변을 준비하는 중"}
          </Styled.Pending>
        </Styled.Row>
      )}
    </Styled.Thread>
  );
}
