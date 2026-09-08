import { useMemo, useState } from "react";
import { Select } from "@ai-pixel-office/design-system";
import type { Agent, Project } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";
import { Empty } from "../../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ChatFrame, ChatHeader, ChatScroll } from "./ChatFrame.tsx";
import { MessageComposer } from "./MessageComposer.tsx";
import { RecipientChips } from "./RecipientChips.tsx";

const ContextBar = styled.label`
  flex: 0 0 auto;
  width: fit-content;
  max-width: 100%;
  min-height: 32px;
  padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colors.background.surfaceMuted};
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.x1};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.micro};
  white-space: nowrap;

  select {
    width: 180px;
    max-width: 32vw;
    padding: 0 ${({ theme }) => theme.space.x1};
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.secondary};
    font: inherit;
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.border.positive};
      outline-offset: 2px;
    }
  }
`;

const ContextRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const ContextSelect = styled(Select)`
  min-height: auto;
`;

export function NewChatComposer({
  agents,
  projects,
  initialProjectId,
  defaultAgentId,
  onStart,
  pending,
  error,
}: {
  agents: Agent[];
  projects: Project[];
  initialProjectId?: string;
  defaultAgentId?: string;
  onStart: (input: { agentId: string; message: string; projectId?: string; files?: File[] }) => Promise<unknown>;
  pending: boolean;
  error?: unknown;
}) {
  const [pickedAgentId, setPickedAgentId] = useState<string>();
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const resolvedProjectId = projects.some((project) => project.id === projectId) ? projectId : "";
  const selectedProject = projects.find((project) => project.id === resolvedProjectId);

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
        <RecipientChips
          agents={runnableAgents}
          selectedId={resolvedAgentId}
          onSelect={setPickedAgentId}
        />
      </ChatHeader>
      <ContextRow>
        <ContextBar htmlFor="chat-project" title={selectedProject?.path}>
          <span>프로젝트</span>
          <ContextSelect
            id="chat-project"
            value={resolvedProjectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">일반 작업 공간</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </ContextSelect>
        </ContextBar>
      </ContextRow>
      <ChatScroll>
        <Empty>
          {runnableAgents.length === 0
            ? "대화 가능한 동료가 없어요, 에이전트 설정에서 권한을 확인해 주세요"
            : "메시지를 보내 대화를 시작하세요"}
        </Empty>
      </ChatScroll>
      <MessageComposer
        onSend={(message, files) => {
          if (resolvedAgentId)
            return onStart({
              agentId: resolvedAgentId,
              message,
              projectId: resolvedProjectId || undefined,
              files,
            });
          return Promise.reject(new Error("대화할 동료를 선택해 주세요"));
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
