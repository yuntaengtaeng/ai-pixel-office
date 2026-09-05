import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mediaQuery } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { FullScreenMessage } from "../../shared/ui/FullScreenMessage.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { messageOf } from "../../shared/lib/errors.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { agentApi } from "../agents/api.ts";
import { taskApi } from "../tasks/api.ts";
import { chatApi } from "./api.ts";
import { ChatList } from "./components/ChatList.tsx";
import { ChatThread } from "./components/ChatThread.tsx";
import { NewChatComposer } from "./components/NewChatComposer.tsx";

const Styled = {
  Grid: styled.div`
    display: grid;
    grid-template-columns: minmax(220px, 0.3fr) minmax(0, 0.7fr);
    gap: ${({ theme }) => theme.space.x4};
    height: calc(100vh - 260px);
    min-height: 420px;

    > * {
      min-height: 0;
    }

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
      height: auto;
    }
  `,
};

export function ChatPage({ workspace }: { workspace: Workspace }) {
  const { taskId } = useParams<{ taskId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();

  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const chats = useQuery({
    queryKey: ["tasks", workspace.id, "chat"],
    queryFn: () => chatApi.listRecent(workspace.id),
  });
  const task = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => taskApi.get(taskId as string),
    enabled: Boolean(taskId),
    refetchInterval: (query) =>
      ["working", "needs_input"].includes(query.state.data?.status ?? "") ? 1500 : false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
  };

  const startChat = useMutation({
    mutationFn: (input: { agentId: string; message: string }) =>
      chatApi.start({ workspaceId: workspace.id, agentId: input.agentId, message: input.message }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/chat/${created.id}`);
    },
  });
  const sendMessage = useMutation({
    mutationFn: (message: string) => chatApi.sendMessage(taskId as string, message),
    onSuccess: invalidate,
  });
  const retry = useMutation({ mutationFn: () => taskApi.retry(taskId as string), onSuccess: invalidate });
  const continueSession = useMutation({
    mutationFn: () => taskApi.continue(taskId as string),
    onSuccess: invalidate,
  });
  const extendSession = useMutation({
    mutationFn: () => taskApi.extendSession(taskId as string),
    onSuccess: invalidate,
  });
  const endChat = useMutation({
    mutationFn: () => taskApi.approve(taskId as string),
    onSuccess: invalidate,
  });
  const deleteChat = useMutation({
    mutationFn: () => taskApi.remove(taskId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate("/chat");
    },
  });

  if (agents.isPending || chats.isPending) return <FullScreenMessage>대화를 준비하는 중...</FullScreenMessage>;
  if (agents.isError) return <FullScreenMessage error>{messageOf(agents.error)}</FullScreenMessage>;

  const activeAgent = agents.data?.find((agent) => agent.id === task.data?.assigneeAgentId);

  return (
    <BaseLayout>
      <PageHeader eyebrow="동료와 대화하기" title="메신저" />
      <Styled.Grid>
        <ChatList
          chats={chats.data ?? []}
          agents={agents.data ?? []}
          activeTaskId={taskId}
          onSelect={(id) => navigate(`/chat/${id}`)}
          onNewChat={() => navigate("/chat")}
        />
        {taskId ? (
          task.isPending ? (
            <FullScreenMessage>대화를 불러오는 중...</FullScreenMessage>
          ) : task.isError || !task.data ? (
            <ErrorBanner>{messageOf(task.error)}</ErrorBanner>
          ) : (
            <ChatThread
              task={task.data}
              agent={activeAgent}
              onSendMessage={(message) => sendMessage.mutate(message)}
              sending={sendMessage.isPending}
              sendError={sendMessage.error}
              onRetry={() => retry.mutate()}
              onContinueSession={() => continueSession.mutate()}
              onExtendSession={() => extendSession.mutate()}
              sessionActionPending={continueSession.isPending || extendSession.isPending}
              onEndChat={() => endChat.mutate()}
              endPending={endChat.isPending}
              onDelete={async () => {
                if (
                  await confirm({
                    title: "이 대화를 삭제할까요?",
                    description: `'${task.data.title}'의 실행 기록과 결과도 함께 삭제됩니다`,
                    confirmLabel: "대화 삭제",
                    tone: "danger",
                  })
                )
                  deleteChat.mutate();
              }}
              deletePending={deleteChat.isPending}
            />
          )
        ) : (
          <NewChatComposer
            agents={agents.data ?? []}
            defaultAgentId={workspace.defaultAgentId}
            onStart={(input) => startChat.mutate(input)}
            pending={startChat.isPending}
            error={startChat.error}
          />
        )}
      </Styled.Grid>
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
  );
}
