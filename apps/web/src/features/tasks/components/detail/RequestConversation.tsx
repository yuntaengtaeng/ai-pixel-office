import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import type { ActivityLog, Agent, AgentRun } from "@ai-pixel-office/domain/entities";
import type { ApprovalDecision } from "@ai-pixel-office/runtime-protocol";
import { taskApi, type TaskDetail } from "../../api.ts";
import { sessionLimitFrom } from "../../utils/sessionLimit.ts";
import { isRunActive } from "../../utils/pendingApproval.ts";
import { openQuestionsOf } from "../../utils/requestResult.ts";
import { TaskConversationThread } from "./TaskConversationThread.tsx";
import { RuntimeApproval } from "../execution/RuntimeApproval.tsx";
import { RunProgress } from "../execution/RunProgress.tsx";
import { SessionLimitState } from "../execution/SessionLimitState.tsx";
import { FailureState } from "../execution/FailureState.tsx";
import { messageOf } from "../../../../shared/lib/errors.ts";
import { josa } from "../../../../shared/lib/korean.ts";
import { Empty } from "../../../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../../../shared/ui/ErrorBanner.tsx";

const Styled = {
  Questions: styled.section`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x4};
    border: 1px solid ${({ theme }) => theme.colors.semantic.warning};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.feedback.warning.background};
    ol {
      margin: 0;
      padding-left: ${({ theme }) => theme.space.x5};
      display: grid;
      gap: ${({ theme }) => theme.space.x2};
      line-height: 1.6;
    }
    span {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
  `,
  Stream: styled.div`
    min-height: 0;
    display: grid;
    align-content: start;
    gap: ${({ theme }) => theme.space.x4};
    overflow-y: auto;
  `,
  Notice: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    color: ${({ theme }) => theme.colors.text.secondary};
  `,
};

/** 기안서 대화 (주고받은 말, 권한 요청, 진행 상황, 멈춘 이유와 다음 행동) */
export function RequestConversation({
  task,
  agents,
  latestRun,
  pendingApproval,
  onChanged,
}: {
  task: TaskDetail;
  agents: Agent[];
  latestRun?: AgentRun;
  pendingApproval?: ActivityLog;
  onChanged: () => void;
}) {
  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [task.runs.length, latestRun?.status, pendingApproval?.id]);
  const sessionLimit = sessionLimitFrom(latestRun?.error);
  const questions = openQuestionsOf(task, task.runs);
  const activeRunStatus = isRunActive(latestRun)
    ? (latestRun!.status as "queued" | "running" | "waiting")
    : undefined;

  return (
    <Styled.Stream ref={streamRef}>
      {task.runs.length === 0 ? (
        <Empty>시작하면 여기에서 동료와 주고받은 말이 보여요.</Empty>
      ) : (
        <TaskConversationThread
          runs={task.runs}
          agents={agents}
          attachmentsByRun={task.attachmentsByRun}
          emphasizeLastAgentBubble={task.status === "needs_review"}
          activeRunStatus={activeRunStatus}
        />
      )}
      {pendingApproval && latestRun && (
        <PendingApprovalCard
          activity={pendingApproval}
          agent={agents.find((agent) => agent.id === latestRun.agentId)}
          runId={latestRun.id}
          onChanged={onChanged}
        />
      )}
      {activeRunStatus && <RunProgress events={task.progress} />}
      {task.status === "needs_input" && sessionLimit && (
        <SessionLimitCard
          taskId={task.id}
          reason={sessionLimit}
          canExtend={Boolean(latestRun?.runtimeThreadId)}
          onChanged={onChanged}
        />
      )}
      {questions.length > 0 && <QuestionCard questions={questions} />}
      {task.status === "failed" && <FailureCard task={task} onChanged={onChanged} />}
      {task.status === "todo" && task.queuedBehind && (
        <QueuedCard
          taskId={task.id}
          holderTitle={task.queuedBehind}
          waitsForEarlierRequest={Boolean(task.waitsFor?.length)}
          onChanged={onChanged}
        />
      )}
      {task.status === "blocked" && (
        <Styled.Notice>
          멈춘 이유를 확인하고 아래 입력창으로 이어서 맡길 내용을 보내 주세요.
        </Styled.Notice>
      )}
    </Styled.Stream>
  );
}

/** 동료가 사람에게 물은 질문 (아래 입력창으로 답하면 같은 동료가 이어서 함) */
function QuestionCard({ questions }: { questions: string[] }) {
  return (
    <Styled.Questions aria-label="동료의 질문">
      <strong>질문 {questions.length}개에 답해 주세요</strong>
      <ol>
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ol>
      <span>아래 입력창에 답을 적어 보내면 같은 동료가 이어서 결과를 다시 내요.</span>
    </Styled.Questions>
  );
}

function QueuedCard({
  taskId,
  holderTitle,
  waitsForEarlierRequest,
  onChanged,
}: {
  taskId: string;
  holderTitle: string;
  /** 계획서의 앞 기안을 기다리는 기안서 (직접 시작할 수 없음) */
  waitsForEarlierRequest: boolean;
  onChanged: () => void;
}) {
  const start = useMutation({ mutationFn: () => taskApi.run(taskId), onSuccess: onChanged });
  return (
    <>
      <Styled.Notice>
        <span>
          '{holderTitle}'{josa(holderTitle, "이/가")} 끝나기를 기다리는 중이에요. 차례가 오면
          자동으로 이어가요.
        </span>
        {!waitsForEarlierRequest && (
          <Button $variant="secondary" disabled={start.isPending} onClick={() => start.mutate()}>
            지금 시작해 보기
          </Button>
        )}
      </Styled.Notice>
      {start.isError && <ErrorBanner>{messageOf(start.error)}</ErrorBanner>}
    </>
  );
}

function PendingApprovalCard({
  activity,
  agent,
  runId,
  onChanged,
}: {
  activity: ActivityLog;
  agent?: Agent;
  runId: string;
  onChanged: () => void;
}) {
  const resolve = useMutation({
    mutationFn: (decision: ApprovalDecision) =>
      taskApi.resolveApproval(runId, String(activity.metadata?.requestId), decision),
    onSuccess: onChanged,
  });
  return (
    <>
      <RuntimeApproval
        activity={activity}
        agent={agent}
        pending={resolve.isPending}
        onDecision={(decision) => resolve.mutate(decision)}
      />
      {resolve.isError && <ErrorBanner>{messageOf(resolve.error)}</ErrorBanner>}
    </>
  );
}

function SessionLimitCard({
  taskId,
  reason,
  canExtend,
  onChanged,
}: {
  taskId: string;
  reason: NonNullable<ReturnType<typeof sessionLimitFrom>>;
  canExtend: boolean;
  onChanged: () => void;
}) {
  const extend = useMutation({
    mutationFn: () => taskApi.extendSession(taskId),
    onSuccess: onChanged,
  });
  const fresh = useMutation({ mutationFn: () => taskApi.continue(taskId), onSuccess: onChanged });
  const error = extend.error ?? fresh.error;
  return (
    <>
      <SessionLimitState
        reason={reason}
        canExtend={canExtend}
        extendPending={extend.isPending}
        newSessionPending={fresh.isPending}
        onExtend={() => extend.mutate()}
        onNewSession={() => fresh.mutate()}
      />
      {error && <ErrorBanner>{messageOf(error)}</ErrorBanner>}
    </>
  );
}

function FailureCard({ task, onChanged }: { task: TaskDetail; onChanged: () => void }) {
  const retry = useMutation({ mutationFn: () => taskApi.retry(task.id), onSuccess: onChanged });
  return (
    <>
      <FailureState error={task.runs[0]?.error} />
      <Styled.Notice>
        실패 원인을 확인한 뒤 같은 조건으로 다시 실행할 수 있어요.
        <Button $variant="primary" disabled={retry.isPending} onClick={() => retry.mutate()}>
          {retry.isPending ? "다시 실행하는 중" : "다시 실행"}
        </Button>
      </Styled.Notice>
      {retry.isError && <ErrorBanner>{messageOf(retry.error)}</ErrorBanner>}
    </>
  );
}
