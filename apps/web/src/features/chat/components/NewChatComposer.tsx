import { useMemo, useState } from "react";
import type { Agent } from "@ai-pixel-office/domain/entities";
import { Empty } from "../../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ChatFrame, ChatHeader, ChatScroll } from "./ChatFrame.tsx";
import { MessageComposer } from "./MessageComposer.tsx";
import { RecipientChips } from "./RecipientChips.tsx";

export function NewChatComposer({
  agents,
  defaultAgentId,
  onStart,
  pending,
  error,
}: {
  agents: Agent[];
  defaultAgentId?: string;
  onStart: (input: { agentId: string; message: string }) => void;
  pending: boolean;
  error?: unknown;
}) {
  const [pickedAgentId, setPickedAgentId] = useState<string>();

  /** 런타임이 실행 시점에 요구하는 fileRead/terminal 권한이 없는 Agent는 골라도 실행이 실패하므로 미리 제외 */
  const runnableAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          agent.mode === "chat" ||
          (agent.permissions.fileRead === true && agent.permissions.terminal === true),
      ),
    [agents],
  );

  /** 워크스페이스 기본 동료나 유일한 Agent가 있으면 자동 선택, 그 외엔 사용자가 고를 때까지 미확정 */
  const resolvedAgentId = useMemo(() => {
    if (pickedAgentId) return pickedAgentId;
    if (defaultAgentId && runnableAgents.some((agent) => agent.id === defaultAgentId)) {
      return defaultAgentId;
    }
    if (runnableAgents.length === 1) return runnableAgents[0].id;
    return undefined;
  }, [pickedAgentId, runnableAgents, defaultAgentId]);

  return (
    <ChatFrame>
      <ChatHeader>
        {runnableAgents.length > 1 ? (
          <RecipientChips
            agents={runnableAgents}
            selectedId={resolvedAgentId}
            onSelect={setPickedAgentId}
          />
        ) : (
          <strong>새 대화</strong>
        )}
      </ChatHeader>
      <ChatScroll>
        <Empty>
          {runnableAgents.length === 0
            ? "대화 가능한 동료가 없어요, 에이전트 설정에서 권한을 확인해 주세요"
            : "메시지를 보내 대화를 시작하세요"}
        </Empty>
      </ChatScroll>
      <MessageComposer
        onSend={(message) => {
          if (resolvedAgentId) onStart({ agentId: resolvedAgentId, message });
        }}
        placeholder="어떤 일을 도와드릴까요?"
        disabled={!resolvedAgentId}
        pending={pending}
        pendingLabel="대화를 시작하는 중..."
        autoFocus
      />
      {Boolean(error) && <ErrorBanner>{messageOf(error)}</ErrorBanner>}
    </ChatFrame>
  );
}
