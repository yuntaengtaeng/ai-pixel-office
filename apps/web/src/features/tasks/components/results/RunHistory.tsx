import type { TaskDetail } from "../../api.ts";
import { Empty } from "../../../../shared/ui/Empty.tsx";
import { SectionHeading } from "../../../../shared/ui/SectionHeading.tsx";
import { TaskResultView } from "./TaskResultView.tsx";

import * as DS from "@ai-pixel-office/design-system";
import styled from "styled-components";

const RUN_DOT_COLOR: Record<TaskDetail["runs"][number]["status"], string> = {
  queued: DS.colors.runStatus.queued,
  running: DS.colors.runStatus.running,
  completed: DS.colors.runStatus.completed,
  waiting: DS.colors.runStatus.queued,
  failed: DS.colors.runStatus.failed,
  cancelled: DS.colors.runStatus.failed,
};

const RunRow = styled.summary`
  display: grid;
  grid-template-columns: 12px 90px 1fr auto;
  align-items: center;
  gap: ${({ theme }) => theme.space.x2};
  padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x1}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};

  time {
    color: ${({ theme }) => theme.colors.text.muted};
  }

  @media ${DS.mediaQuery.md} {
    grid-template-columns: 12px 70px 1fr;

    time {
      display: none;
    }
  }
`;

const RunDot = styled.span<{ $status: TaskDetail["runs"][number]["status"] }>`
  width: 8px;
  height: 8px;
  background: ${({ $status }) => RUN_DOT_COLOR[$status]};

  ${({ $status, theme }) =>
    $status === "running" &&
    `
      box-shadow: 0 0 0 3px ${theme.colors.border.positive};
    `}
`;

const RunExpandIcon = styled.span`
  position: absolute;
  right: 6px;
  color: ${({ theme }) => theme.colors.text.negative};
  font-size: ${({ theme }) => theme.typography.fontSize.headingMd};
  line-height: 1;
  transition: transform 0.15s ease-out;
`;

const RunEntry = styled.details<{ $failed: boolean }>`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};

  ${RunRow} {
    position: relative;
    padding-right: ${({ theme }) => theme.space.x6};
    border-bottom: 0;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }

  &[open] ${RunExpandIcon} {
    transform: rotate(90deg);
  }

  &[open] ${RunRow} {
    background: ${({ $failed, theme }) =>
      $failed ? theme.colors.background.negativeSubtle : theme.colors.background.positiveSubtle};
  }
`;

const Styled = {
  RunHistory: styled(DS.Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x5};
    margin-top: 0;
  `,
  RunRow,
  RunDot,
  RunExpandIcon,
  RunEntry,
  RunEntryBody: styled.div<{ $failed: boolean }>`
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x3} ${theme.space.x3} ${theme.space.x5}`};
    background: ${({ $failed, theme }) =>
      $failed ? theme.colors.background.negativeSubtle : theme.colors.background.positiveSubtle};

    section {
      display: grid;
      gap: ${({ theme }) => theme.space.x2};

      > strong {
        color: ${({ theme }) => theme.colors.text.positive};
        font-size: ${({ theme }) => theme.typography.fontSize.sm};
      }
    }

    dl {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
      margin: 0;

      div {
        min-width: 0;
        display: grid;
        grid-template-columns: 65px minmax(0, 1fr);
        gap: ${({ theme }) => theme.space.x2};
        font-size: ${({ theme }) => theme.typography.fontSize.xs};
      }

      dt {
        color: ${({ theme }) => theme.colors.text.muted};
      }

      dd {
        margin: 0;
        overflow-wrap: anywhere;
        font-family: monospace;
      }
    }

    > small {
      color: ${({ theme }) => theme.colors.text.secondary};
    }
  `,
  RunRequestSnapshot: styled.section`
    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      line-height: 1.55;
      white-space: pre-wrap;
    }
  `,
  RunResultSnapshot: styled.section`
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
  `,
  RunErrorSnapshot: styled.section`
    > strong {
      color: ${({ theme }) => theme.colors.text.negative};
    }

    pre {
      max-height: 220px;
      margin: 0;
      padding: ${({ theme }) => theme.space.x3};
      overflow: auto;
      border: 1px solid ${({ theme }) => theme.colors.border.negative};
      background: ${({ theme }) => theme.colors.semantic.negative};
      color: ${({ theme }) => theme.colors.text.inverse};
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      line-height: 1.55;
    }
  `,
  RunEntryEvents: styled.div`
    max-height: 180px;
    overflow: auto;
    border: 1px solid ${({ theme }) => theme.colors.border.negative};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    > div {
      display: grid;
      grid-template-columns: 70px minmax(0, 1fr);
      gap: ${({ theme }) => theme.space.x2};
      padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x2}`};
      border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      line-height: 1.45;

      &:last-child {
        border-bottom: 0;
      }
    }

    time {
      color: ${({ theme }) => theme.colors.text.muted};
    }

    span {
      overflow-wrap: anywhere;
      color: ${({ theme }) => theme.colors.text.secondary};
    }
  `,
};

export function RunHistory({
  runs,
  progressByRun,
}: {
  runs: TaskDetail["runs"];
  progressByRun: TaskDetail["progressByRun"];
}) {
  const statusLabel: Record<TaskDetail["runs"][number]["status"], string> = {
    queued: "대기",
    running: "실행 중",
    waiting: "입력 대기",
    completed: "완료",
    failed: "실패",
    cancelled: "취소",
  };
  return (
    <Styled.RunHistory>
      <SectionHeading $compact>
        <h2>실행 기록</h2>
        <span>{runs.length}</span>
      </SectionHeading>
      {runs.map((entry) => {
        const progress = progressByRun[entry.id] ?? [];
        return (
          <Styled.RunEntry $failed={entry.status === "failed"} key={entry.id}>
            <Styled.RunRow>
              <Styled.RunDot $status={entry.status} />
              <strong>{entry.runtime.toUpperCase()}</strong>
              <span>{statusLabel[entry.status]}</span>
              <time>{new Date(entry.createdAt).toLocaleString("ko-KR")}</time>
              <Styled.RunExpandIcon aria-hidden="true">›</Styled.RunExpandIcon>
            </Styled.RunRow>
            <Styled.RunEntryBody $failed={entry.status === "failed"}>
              {entry.request && (
                <Styled.RunRequestSnapshot>
                  <strong>요청</strong>
                  <p>{entry.request}</p>
                </Styled.RunRequestSnapshot>
              )}
              {entry.result && (
                <Styled.RunResultSnapshot>
                  <strong>이 실행의 결과</strong>
                  <TaskResultView result={entry.result} size="small" />
                </Styled.RunResultSnapshot>
              )}
              {entry.status === "failed" && (
                <Styled.RunErrorSnapshot>
                  <strong>실패 로그</strong>
                  <pre>{entry.error || "기록된 오류 메시지가 없습니다."}</pre>
                </Styled.RunErrorSnapshot>
              )}
              {progress.length > 0 && (
                <Styled.RunEntryEvents>
                  {progress.slice(-12).map((event) => (
                    <div key={event.id}>
                      <time>{new Date(event.createdAt).toLocaleTimeString("ko-KR")}</time>
                      <span>{event.message}</span>
                    </div>
                  ))}
                </Styled.RunEntryEvents>
              )}
              <dl>
                {entry.workingDirectory && (
                  <div>
                    <dt>작업 폴더</dt>
                    <dd>{entry.workingDirectory}</dd>
                  </div>
                )}
                <div>
                  <dt>실행 ID</dt>
                  <dd>{entry.id}</dd>
                </div>
                {entry.runtimeThreadId && (
                  <div>
                    <dt>세션 ID</dt>
                    <dd>{entry.runtimeThreadId}</dd>
                  </div>
                )}
                {entry.eventLogRef && (
                  <div>
                    <dt>상세 로그</dt>
                    <dd>{entry.eventLogRef}</dd>
                  </div>
                )}
              </dl>
              {!entry.request &&
                !entry.result &&
                entry.status !== "failed" &&
                progress.length === 0 && (
                  <small>이전 버전에서 생성되어 상세 스냅샷이 없는 실행입니다.</small>
                )}
            </Styled.RunEntryBody>
          </Styled.RunEntry>
        );
      })}
      {runs.length === 0 && <Empty>실행 기록이 없습니다.</Empty>}
    </Styled.RunHistory>
  );
}
