import { useEffect, useRef } from "react";
import { Button } from "@ai-pixel-office/design-system";
import type { Agent } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";
import type { TaskDetail } from "../../tasks/api.ts";
import { FailureState } from "../../tasks/components/execution/FailureState.tsx";
import { SessionLimitState } from "../../tasks/components/execution/SessionLimitState.tsx";
import { sessionLimitFrom } from "../../tasks/utils/sessionLimit.ts";
import { PetPreview } from "../../office/PetPreview.tsx";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";
import { ChatFrame, ChatHeader, ChatHeaderActions, ChatScroll, EndedTag } from "./ChatFrame.tsx";
import { MessageComposer } from "./MessageComposer.tsx";
import { MessageThread } from "./MessageThread.tsx";

const EndedNotice = styled.p`
  flex: 0 0 auto;
  margin: 0;
  padding: ${({ theme }) => theme.space.x3};
  text-align: center;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};
`;

export function ChatThread({
  task,
  agent,
  onSendMessage,
  sending,
  sendError,
  onRetry,
  onContinueSession,
  onExtendSession,
  sessionActionPending,
  onEndChat,
  endPending,
  onDelete,
  deletePending,
}: {
  task: TaskDetail;
  agent?: Agent;
  onSendMessage: (message: string) => void;
  sending: boolean;
  sendError?: unknown;
  onRetry: () => void;
  onContinueSession: () => void;
  onExtendSession: () => void;
  sessionActionPending: boolean;
  onEndChat: () => void;
  endPending: boolean;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestRun = task.runs[0];
  const limitReason = sessionLimitFrom(latestRun?.error);
  const canSend = task.status === "needs_review" || task.status === "blocked";
  const activeRunStatus =
    task.status === "working" && latestRun
      ? (latestRun.status as "queued" | "running" | "waiting")
      : undefined;

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [task.runs.length, activeRunStatus]);

  const ended = task.status === "done";

  return (
    <ChatFrame $muted={ended}>
      <ChatHeader>
        <PetPreview petId={agent?.avatarId ?? ""} size={32} />
        <strong>{agent?.name ?? "담당자 미정"}</strong>
        <span>{agent?.role}</span>
        {ended && <EndedTag>종료됨</EndedTag>}
        <ChatHeaderActions>
          {task.status === "needs_review" && (
            <Button $variant="secondary" onClick={onEndChat} disabled={endPending}>
              {endPending ? "종료하는 중..." : "대화 종료"}
            </Button>
          )}
          <Button $variant="danger" onClick={onDelete} disabled={deletePending}>
            {deletePending ? "삭제하는 중..." : "삭제"}
          </Button>
        </ChatHeaderActions>
      </ChatHeader>

      <ChatScroll ref={scrollRef}>
        <MessageThread runs={task.runs} activeRunStatus={activeRunStatus} agent={agent} />

        {task.status === "failed" && !limitReason && (
          <>
            <FailureState error={latestRun?.error} />
            <Button $variant="primary" onClick={onRetry}>
              다시 시도
            </Button>
          </>
        )}
        {task.status === "needs_input" && limitReason && (
          <SessionLimitState
            reason={limitReason}
            canExtend={Boolean(latestRun?.runtimeThreadId)}
            extendPending={sessionActionPending}
            newSessionPending={sessionActionPending}
            onExtend={onExtendSession}
            onNewSession={onContinueSession}
          />
        )}
      </ChatScroll>

      {canSend && (
        <MessageComposer
          onSend={onSendMessage}
          placeholder="메시지를 입력하세요"
          pending={sending}
          pendingLabel="보내는 중..."
        />
      )}
      {ended && <EndedNotice>이 대화는 종료되어 더 이상 메시지를 보낼 수 없어요</EndedNotice>}
      {Boolean(sendError) && <ErrorBanner>{messageOf(sendError)}</ErrorBanner>}
    </ChatFrame>
  );
}
