import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import type { AgentRun, Workspace } from "@ai-pixel-office/domain/entities";
import { taskApi, type TaskDetail } from "../../api.ts";
import { isRunActive } from "../../utils/pendingApproval.ts";
import { sessionLimitFrom } from "../../utils/sessionLimit.ts";
import {
  ComposerAttachments,
  ComposerForm,
  ComposerTextArea,
} from "../../../../shared/ui/composer/Composer.tsx";
import { useAttachmentDraft } from "../../../../shared/hooks/useAttachmentDraft.ts";
import { messageOf } from "../../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../../shared/ui/ErrorBanner.tsx";

const Styled = {
  Bar: styled.form`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x4}`};
    border: 1px solid ${({ theme }) => theme.colors.border.strong};
    border-radius: ${({ theme }) => theme.radius.xl};
    background: ${({ theme }) => theme.colors.background.surface};
    &:focus-within {
      border-color: ${({ theme }) => theme.colors.brand.primary};
    }
    textarea {
      min-height: 52px;
      border: 0;
      padding: 0;
      background: transparent;
      resize: none;
      box-shadow: none;
    }
  `,
  Row: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    select {
      width: auto;
      min-height: 32px;
      border-radius: ${({ theme }) => theme.radius.pill};
    }
    small {
      color: ${({ theme }) => theme.colors.text.muted};
    }
    button:last-child {
      margin-left: auto;
    }
  `,
};

/** 지금 상태에서 입력창으로 할 수 있는 일 (보낼 수 없으면 이유) */
function composerMode(task: TaskDetail, latestRun?: AgentRun) {
  if (task.status === "todo" && task.queuedBehind)
    return { kind: "blocked", reason: "순서가 오면 자동으로 시작해요." } as const;
  if (task.status === "todo")
    return { kind: "blocked", reason: "오른쪽에서 기안서를 시작해 주세요." } as const;
  if (task.status === "failed")
    return { kind: "blocked", reason: "다시 실행한 뒤 이어서 말할 수 있어요." } as const;
  if (latestRun?.status === "waiting")
    return { kind: "blocked", reason: "권한 요청에 먼저 답해 주세요." } as const;
  if (task.status === "needs_input" && sessionLimitFrom(latestRun?.error))
    return {
      kind: "blocked",
      reason: "세션 한도로 멈췄어요. 위에서 이어갈 방법을 골라 주세요.",
    } as const;
  if (task.status === "needs_review") return { kind: "revise" } as const;
  return { kind: "message" } as const;
}

/** 기안서 입력창 (담당 동료에게 이어서 말하기, 결재 대기 중이면 반려하고 다시 맡기기) */
export function RequestMessageBar({
  task,
  workspace,
  latestRun,
  onChanged,
}: {
  task: TaskDetail;
  workspace: Workspace;
  latestRun?: AgentRun;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState("");
  const attachments = useAttachmentDraft();
  const mode = composerMode(task, latestRun);
  const running = isRunActive(latestRun);
  const sendable = mode.kind !== "blocked" && !running;

  const send = useMutation({
    mutationFn: async () => {
      const uploaded = attachments.files.length
        ? await taskApi.uploadAttachments(workspace.id, task.id, attachments.files)
        : [];
      const attachmentIds = uploaded.map((attachment) => attachment.id);
      if (mode.kind === "revise")
        return taskApi.requestChanges(task.id, draft.trim(), attachmentIds);
      return taskApi.sendMessage(task.id, draft.trim(), attachmentIds);
    },
    onSuccess: () => {
      setDraft("");
      attachments.clear();
      onChanged();
    },
  });
  const submit = () => {
    if (draft.trim() && sendable && !send.isPending) send.mutate();
  };

  return (
    <>
      <ComposerForm
        component={Styled.Bar}
        attachments={attachments}
        pending={send.isPending}
        onSubmit={submit}
      >
        <ComposerTextArea
          attachments={attachments}
          onSubmit={submit}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={mode.kind === "blocked"}
          aria-label={mode.kind === "revise" ? "반려 사유" : "보낼 말"}
          placeholder={
            mode.kind === "blocked"
              ? mode.reason
              : mode.kind === "revise"
                ? "고칠 점을 적으면 담당 동료가 같은 흐름에서 다시 고쳐요"
                : task.status === "needs_input"
                  ? "질문에 답하기"
                  : "이어서 말하기"
          }
        />
        <ComposerAttachments attachments={attachments} />
        <Styled.Row>
          <Button
            $variant={mode.kind === "revise" ? "secondary" : "primary"}
            type="submit"
            disabled={!draft.trim() || !sendable || send.isPending}
          >
            {send.isPending
              ? "보내는 중"
              : mode.kind === "revise"
                ? "반려하고 다시 맡기기"
                : "보내기"}
          </Button>
        </Styled.Row>
      </ComposerForm>
      {send.isError && <ErrorBanner>{messageOf(send.error)}</ErrorBanner>}
    </>
  );
}
